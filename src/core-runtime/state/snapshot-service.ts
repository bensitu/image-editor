import type { Disposable } from '../../plugin-kernel/disposable.js';
import { SnapshotValidationError, StateRegistrationError } from '../errors.js';
import { cloneStateValue, isDangerousStateKey } from './clone-state-value.js';
import type { MementoService } from './memento-service.js';
import type {
    CoreStateAdapter,
    EditorSnapshotV3,
    MissingPluginPolicy,
    PluginMementoEntry,
    StateCaptureContext,
    StateRestoreContext,
    StateWarningSink,
} from './state-types.js';
import type { StateSliceRegistry } from './state-slice-registry.js';

export interface SnapshotLimits {
    readonly maxInputBytes: number;
    readonly maxDepth: number;
    readonly maxPluginCount: number;
    readonly maxPluginPayloadBytes: number;
    readonly maxMetadataBytes: number;
}

export interface SnapshotLoadOptions {
    readonly missingPluginPolicy?: MissingPluginPolicy;
    readonly signal?: AbortSignal;
}

export const DEFAULT_SNAPSHOT_LIMITS: SnapshotLimits = Object.freeze({
    maxInputBytes: 16 * 1024 * 1024,
    maxDepth: 64,
    maxPluginCount: 256,
    maxPluginPayloadBytes: 4 * 1024 * 1024,
    maxMetadataBytes: 256 * 1024,
});

function byteLength(value: string): number {
    return new TextEncoder().encode(value).byteLength;
}

function inspectTree(
    value: unknown,
    limits: SnapshotLimits,
    path = '$',
    depth = 0,
    ancestors = new WeakSet<object>(),
): void {
    if (depth > limits.maxDepth) {
        throw new SnapshotValidationError(`nesting exceeds ${limits.maxDepth}.`, path);
    }
    if (value === null || typeof value !== 'object') {
        if (typeof value === 'number' && !Number.isFinite(value)) {
            throw new SnapshotValidationError('number must be finite.', path);
        }
        if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
            throw new SnapshotValidationError(`unsupported ${typeof value} value.`, path);
        }
        return;
    }
    if (ancestors.has(value)) throw new SnapshotValidationError('cyclic value.', path);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null && !Array.isArray(value)) {
        throw new SnapshotValidationError('only plain objects and arrays are accepted.', path);
    }
    ancestors.add(value);
    for (const key of Object.keys(value)) {
        if (isDangerousStateKey(key)) {
            throw new SnapshotValidationError(
                `dangerous key "${key}" is forbidden.`,
                `${path}.${key}`,
            );
        }
        inspectTree(
            (value as Record<string, unknown>)[key],
            limits,
            `${path}.${key}`,
            depth + 1,
            ancestors,
        );
    }
    ancestors.delete(value);
}

function stableJson(value: unknown, limits: SnapshotLimits): string {
    inspectTree(value, limits);
    const sortValue = (entry: unknown): unknown => {
        if (Array.isArray(entry)) return entry.map(sortValue);
        if (entry && typeof entry === 'object') {
            const result: Record<string, unknown> = {};
            for (const key of Object.keys(entry).sort()) {
                result[key] = sortValue((entry as Record<string, unknown>)[key]);
            }
            return result;
        }
        return entry;
    };
    return JSON.stringify(sortValue(value));
}

function parseInput(input: string | unknown, limits: SnapshotLimits): unknown {
    if (typeof input !== 'string') {
        inspectTree(input, limits);
        return input;
    }
    if (byteLength(input) > limits.maxInputBytes) {
        throw new SnapshotValidationError(`input exceeds ${limits.maxInputBytes} bytes.`);
    }
    try {
        const parsed: unknown = JSON.parse(input);
        inspectTree(parsed, limits);
        return parsed;
    } catch (error) {
        if (error instanceof SnapshotValidationError) throw error;
        throw new SnapshotValidationError('input is not valid JSON.', '$', error);
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class SnapshotService implements Disposable {
    private opaque = new Map<string, PluginMementoEntry>();
    private disposed = false;

    constructor(
        private readonly coreAdapter: CoreStateAdapter,
        private readonly slices: StateSliceRegistry,
        private readonly mementos: MementoService,
        private readonly warningSink?: StateWarningSink,
        private readonly limits: SnapshotLimits = DEFAULT_SNAPSHOT_LIMITS,
    ) {}

    capture(): EditorSnapshotV3 {
        this.assertActive('capture a public snapshot');
        const capturedAt = Date.now();
        const context: StateCaptureContext = Object.freeze({ mode: 'snapshot', capturedAt });
        const plugins: Record<string, PluginMementoEntry> = Object.create(null) as Record<
            string,
            PluginMementoEntry
        >;
        for (const [id, entry] of this.opaque) plugins[id] = cloneStateValue(entry);
        for (const slice of this.slices.list()) {
            plugins[slice.id] = Object.freeze({
                version: slice.version,
                data: cloneStateValue(slice.capture(context)),
            });
        }
        return Object.freeze({
            schema: 'image-editor.state',
            version: 3,
            core: cloneStateValue(this.coreAdapter.capture(context)),
            plugins: Object.freeze(plugins),
        });
    }

    stringify(): string {
        return stableJson(this.capture(), this.limits);
    }

    async load(input: string | unknown, options: SnapshotLoadOptions = {}): Promise<void> {
        this.assertActive('load a public snapshot');
        const snapshot = this.validateEnvelope(parseInput(input, this.limits));
        const policy = options.missingPluginPolicy ?? 'warn-and-skip';
        const before = this.mementos.capture();
        const controller = new AbortController();
        const abort = (): void => controller.abort(options.signal?.reason);
        options.signal?.addEventListener('abort', abort, { once: true });
        if (options.signal?.aborted) abort();
        const context: StateRestoreContext = Object.freeze({
            mode: 'public-snapshot',
            signal: controller.signal,
        });
        const validatedSlices = new Map<string, unknown>();
        const nextOpaque = new Map<string, PluginMementoEntry>();

        try {
            const coreValidation = this.coreAdapter.validateSnapshot(snapshot.core);
            if (!coreValidation.valid) {
                throw new SnapshotValidationError(
                    coreValidation.message,
                    coreValidation.path ?? '$.core',
                );
            }
            for (const [id, entry] of Object.entries(snapshot.plugins)) {
                const serializedBytes = byteLength(stableJson(entry.data, this.limits));
                if (serializedBytes > this.limits.maxPluginPayloadBytes) {
                    throw new SnapshotValidationError(
                        `plugin payload exceeds ${this.limits.maxPluginPayloadBytes} bytes.`,
                        `$.plugins.${id}.data`,
                    );
                }
                const slice = this.slices.get(id);
                if (!slice) {
                    if (policy === 'error') {
                        throw new SnapshotValidationError(
                            'required plugin is not installed.',
                            `$.plugins.${id}`,
                        );
                    }
                    if (policy === 'preserve-opaque') nextOpaque.set(id, cloneStateValue(entry));
                    this.warningSink?.({
                        code: 'SNAPSHOT_PLUGIN_MISSING',
                        message: `Snapshot data for missing plugin "${id}" was ${
                            policy === 'preserve-opaque' ? 'preserved opaquely' : 'skipped'
                        }.`,
                        sliceId: id,
                    });
                    continue;
                }
                if (entry.version !== slice.version) {
                    throw new SnapshotValidationError(
                        `version ${entry.version} is incompatible with installed version ${slice.version}.`,
                        `$.plugins.${id}.version`,
                    );
                }
                const validation = slice.validate(entry.data, {
                    sliceId: id,
                    version: entry.version,
                });
                if (!validation.valid) {
                    throw new SnapshotValidationError(
                        validation.message,
                        validation.path ?? `$.plugins.${id}.data`,
                    );
                }
                validatedSlices.set(id, cloneStateValue(validation.value));
            }

            await this.coreAdapter.restore(cloneStateValue(coreValidation.value), context);
            for (const slice of this.slices.list()) {
                if (validatedSlices.has(slice.id)) {
                    await slice.restore(validatedSlices.get(slice.id), context);
                } else {
                    await slice.clearState?.(context);
                }
            }
            this.opaque = nextOpaque;
        } catch (error) {
            try {
                await this.mementos.restore(before, { rollbackOnFailure: false });
            } catch (rollbackError) {
                const combinedError = new Error(
                    'Snapshot load and rollback both failed.',
                ) as Error & { causes?: readonly unknown[] };
                combinedError.causes = Object.freeze([error, rollbackError]);
                throw new SnapshotValidationError(
                    'load failed and rollback could not restore the previous state.',
                    '$',
                    combinedError,
                );
            }
            throw error;
        } finally {
            options.signal?.removeEventListener('abort', abort);
        }
    }

    dispose(): void {
        this.opaque.clear();
        this.disposed = true;
    }

    private validateEnvelope(value: unknown): EditorSnapshotV3 {
        if (!isRecord(value)) throw new SnapshotValidationError('snapshot must be an object.');
        if (value.schema !== 'image-editor.state') {
            throw new SnapshotValidationError('schema must be "image-editor.state".', '$.schema');
        }
        if (value.version !== 3) {
            throw new SnapshotValidationError('version must be 3.', '$.version');
        }
        if (!isRecord(value.core))
            throw new SnapshotValidationError('core must be an object.', '$.core');
        if (!isRecord(value.plugins)) {
            throw new SnapshotValidationError('plugins must be an object.', '$.plugins');
        }
        const entries = Object.entries(value.plugins);
        if (entries.length > this.limits.maxPluginCount) {
            throw new SnapshotValidationError(
                `plugin count exceeds ${this.limits.maxPluginCount}.`,
                '$.plugins',
            );
        }
        const plugins: Record<string, PluginMementoEntry> = Object.create(null) as Record<
            string,
            PluginMementoEntry
        >;
        for (const [id, entry] of entries) {
            if (id.trim().length === 0 || isDangerousStateKey(id)) {
                throw new SnapshotValidationError('plugin id is invalid.', `$.plugins.${id}`);
            }
            if (
                !isRecord(entry) ||
                !Number.isSafeInteger(entry.version) ||
                Number(entry.version) <= 0
            ) {
                throw new SnapshotValidationError(
                    'plugin entry requires a positive integer version and data.',
                    `$.plugins.${id}`,
                );
            }
            plugins[id] = Object.freeze({ version: Number(entry.version), data: entry.data });
        }
        return Object.freeze({
            schema: 'image-editor.state',
            version: 3,
            core: cloneStateValue(value.core),
            plugins: Object.freeze(plugins),
        });
    }

    private assertActive(operation: string): void {
        if (this.disposed) throw new StateRegistrationError(`Cannot ${operation} after disposal.`);
    }
}

export interface SnapshotMigrationResult {
    readonly snapshot: EditorSnapshotV3;
    readonly warnings: readonly string[];
}

/** Phase 2 dispatcher. Feature-specific field migration is supplied through hooks in later phases. */
export function migrateV2SnapshotToV3(
    input: unknown,
    migratePlugins: (
        source: Readonly<Record<string, unknown>>,
    ) => Readonly<Record<string, PluginMementoEntry>> = () => Object.freeze({}),
): SnapshotMigrationResult {
    if (!isRecord(input)) throw new SnapshotValidationError('v2 snapshot must be an object.');
    if ('schema' in input && input.schema === 'image-editor.state' && input.version === 3) {
        if (!isRecord(input.core) || !isRecord(input.plugins)) {
            throw new SnapshotValidationError('v3 snapshot envelope is incomplete.');
        }
        const plugins: Record<string, PluginMementoEntry> = Object.create(null) as Record<
            string,
            PluginMementoEntry
        >;
        for (const [id, entry] of Object.entries(input.plugins)) {
            if (!isRecord(entry) || !Number.isSafeInteger(entry.version)) {
                throw new SnapshotValidationError('v3 plugin entry is invalid.', `$.plugins.${id}`);
            }
            plugins[id] = Object.freeze({
                version: Number(entry.version),
                data: cloneStateValue(entry.data),
            });
        }
        return {
            snapshot: Object.freeze({
                schema: 'image-editor.state',
                version: 3,
                core: cloneStateValue(input.core),
                plugins: Object.freeze(plugins),
            }),
            warnings: Object.freeze([]),
        };
    }
    const editorState = isRecord(input._editorState) ? input._editorState : {};
    const snapshot = Object.freeze({
        schema: 'image-editor.state' as const,
        version: 3 as const,
        core: cloneStateValue({ canvas: input, legacyEditorState: editorState }),
        plugins: cloneStateValue(migratePlugins(input)),
    });
    return {
        snapshot,
        warnings: Object.freeze([
            'A v2 Canvas JSON snapshot was migrated to the v3 envelope; feature fields require installed migration hooks.',
        ]),
    };
}
