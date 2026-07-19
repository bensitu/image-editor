/**
 * Captures, validates, migrates, and restores the versioned editor snapshot envelope.
 *
 * @module
 */

import type { Disposable } from '../../plugin-kernel/disposable.js';
import { isRuntimeIdentifier } from '../../plugin-kernel/plugin-identifier.js';
import {
    SnapshotValidationError,
    SnapshotVersionUnsupportedError,
    StateRegistrationError,
} from '../errors.js';
import { cloneStateValue, isDangerousStateKey } from './clone-state-value.js';
import { inspectEncodedImageDataUrl } from './image-data-url.js';
import type { MementoService } from './memento-service.js';
import type {
    CoreStateAdapter,
    EditorSnapshot,
    MissingPluginPolicy,
    PluginMementoEntry,
    SnapshotMigration,
    SnapshotMigrationContext,
    StateCaptureContext,
    StateRestoreContext,
    StateWarningSink,
} from './state-types.js';
import type { StateSliceRegistry } from './state-slice-registry.js';

export interface SnapshotLimits {
    readonly maxInputBytes: number;
    readonly maxDepth: number;
    readonly maxObjectCount: number;
    readonly maxPluginCount: number;
    readonly maxPluginPayloadBytes: number;
    readonly maxMetadataBytes: number;
    readonly maxStringLength: number;
    readonly maxDataUrlBytes: number;
    readonly maxDecodedPixels: number;
    readonly maxImageDimension: number;
    readonly externalUrlPolicy: 'reject' | 'allow';
}

export interface SnapshotLoadOptions {
    readonly missingPluginPolicy?: MissingPluginPolicy;
    readonly migrations?: readonly SnapshotMigration[];
    readonly signal?: AbortSignal;
    readonly rollbackOnFailure?: boolean;
}

export const DEFAULT_SNAPSHOT_LIMITS: SnapshotLimits = Object.freeze({
    maxInputBytes: 16 * 1024 * 1024,
    maxDepth: 64,
    maxObjectCount: 100_000,
    maxPluginCount: 256,
    maxPluginPayloadBytes: 4 * 1024 * 1024,
    maxMetadataBytes: 256 * 1024,
    maxStringLength: 16 * 1024 * 1024,
    maxDataUrlBytes: 16 * 1024 * 1024,
    maxDecodedPixels: 50_000_000,
    maxImageDimension: 32_768,
    externalUrlPolicy: 'reject',
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
    counter: { count: number } = { count: 0 },
    propertyName?: string,
): void {
    if (depth > limits.maxDepth) {
        throw new SnapshotValidationError(`nesting exceeds ${limits.maxDepth}.`, path);
    }
    if (value === null || typeof value !== 'object') {
        if (typeof value === 'number' && !Number.isFinite(value)) {
            throw new SnapshotValidationError('number must be finite.', path);
        }
        if (typeof value === 'string') {
            if (value.length > limits.maxStringLength) {
                throw new SnapshotValidationError(
                    `string length exceeds ${limits.maxStringLength}.`,
                    path,
                );
            }
            if (value.startsWith('data:')) {
                const inspection = inspectEncodedImageDataUrl(value);
                if (!inspection) {
                    throw new SnapshotValidationError(
                        'Data URL must be a base64 PNG, JPEG, or WebP image.',
                        path,
                    );
                }
                if (inspection.encodedBytes > limits.maxDataUrlBytes) {
                    throw new SnapshotValidationError(
                        `Data URL exceeds ${limits.maxDataUrlBytes} bytes.`,
                        path,
                    );
                }
                if (inspection.dimensions) {
                    const { width, height } = inspection.dimensions;
                    if (width * height > limits.maxDecodedPixels) {
                        throw new SnapshotValidationError(
                            `decoded pixel count exceeds ${limits.maxDecodedPixels}.`,
                            path,
                        );
                    }
                    if (width > limits.maxImageDimension || height > limits.maxImageDimension) {
                        throw new SnapshotValidationError(
                            `image dimensions exceed ${limits.maxImageDimension}.`,
                            path,
                        );
                    }
                }
            } else if (
                limits.externalUrlPolicy === 'reject' &&
                (propertyName === 'src' || propertyName === 'url') &&
                /^(?:https?:)?\/\//i.test(value)
            ) {
                throw new SnapshotValidationError('external URL references are forbidden.', path);
            }
        }
        if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
            throw new SnapshotValidationError(`unsupported ${typeof value} value.`, path);
        }
        return;
    }
    counter.count += 1;
    if (counter.count > limits.maxObjectCount) {
        throw new SnapshotValidationError(`object count exceeds ${limits.maxObjectCount}.`, path);
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
            counter,
            key,
        );
        if (key === 'metadata') {
            const metadataBytes = byteLength(
                JSON.stringify((value as Record<string, unknown>)[key]),
            );
            if (metadataBytes > limits.maxMetadataBytes) {
                throw new SnapshotValidationError(
                    `metadata exceeds ${limits.maxMetadataBytes} bytes.`,
                    `${path}.${key}`,
                );
            }
        }
    }
    if (!Array.isArray(value)) {
        const record = value as Record<string, unknown>;
        if (typeof record.width === 'number' && typeof record.height === 'number') {
            const width = record.width;
            const height = record.height;
            if (width > 0 && height > 0 && width * height > limits.maxDecodedPixels) {
                throw new SnapshotValidationError(
                    `decoded pixel count exceeds ${limits.maxDecodedPixels}.`,
                    path,
                );
            }
            if (width > limits.maxImageDimension || height > limits.maxImageDimension) {
                throw new SnapshotValidationError(
                    `image dimensions exceed ${limits.maxImageDimension}.`,
                    path,
                );
            }
        }
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
        const serialized = JSON.stringify(input);
        if (byteLength(serialized) > limits.maxInputBytes) {
            throw new SnapshotValidationError(`input exceeds ${limits.maxInputBytes} bytes.`);
        }
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

function isUnsupportedCanvasEnvelope(value: Record<string, unknown>): boolean {
    if ('schema' in value || !Array.isArray(value.objects) || !isRecord(value._editorState)) {
        return false;
    }
    const editorState = value._editorState;
    return ['currentScale', 'currentRotation', 'baseImageScale'].every(
        (key) => typeof editorState[key] === 'number',
    );
}

declare const preparedSnapshotBrand: unique symbol;

export interface PreparedSnapshotLoad {
    readonly core: Readonly<Record<string, unknown>>;
    readonly validatedSlices: readonly Readonly<{ id: string; value: unknown }>[];
    readonly opaqueSlices: readonly Readonly<{ id: string; entry: PluginMementoEntry }>[];
    readonly [preparedSnapshotBrand]: true;
}

export class SnapshotService implements Disposable {
    private opaque = new Map<string, PluginMementoEntry>();
    private prepared = new WeakSet<object>();
    private disposed = false;

    constructor(
        private readonly coreAdapter: CoreStateAdapter,
        private readonly slices: StateSliceRegistry,
        private readonly mementos: MementoService,
        private readonly warningSink?: StateWarningSink,
        private readonly limits: SnapshotLimits = DEFAULT_SNAPSHOT_LIMITS,
    ) {}

    capture(): EditorSnapshot {
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
        const prepared = await this.prepareForLoad(input, options);
        await this.loadPrepared(prepared, options);
    }

    prepare(
        input: string | unknown,
        options: Pick<SnapshotLoadOptions, 'missingPluginPolicy'> = {},
    ): PreparedSnapshotLoad {
        this.assertActive('prepare a public snapshot');
        return this.prepareParsed(parseInput(input, this.limits), options);
    }

    async prepareForLoad(
        input: string | unknown,
        options: Pick<SnapshotLoadOptions, 'migrations' | 'missingPluginPolicy' | 'signal'> = {},
    ): Promise<PreparedSnapshotLoad> {
        this.assertActive('prepare a public snapshot');
        const parsed = parseInput(input, this.limits);
        if (
            !options.migrations?.length ||
            (isRecord(parsed) && parsed.schema === 'image-editor.state' && parsed.version === 3)
        ) {
            return this.prepareParsed(parsed, options);
        }
        const immutableInput = cloneStateValue(parsed);
        const migration = options.migrations.find((candidate) =>
            candidate.canMigrate(immutableInput),
        );
        if (!migration) return this.prepareParsed(parsed, options);
        const context: SnapshotMigrationContext = { signal: options.signal };
        const migrated = await migration.migrate(immutableInput, context);
        return this.prepareParsed(parseInput(migrated, this.limits), options);
    }

    private prepareParsed(
        input: unknown,
        options: Pick<SnapshotLoadOptions, 'missingPluginPolicy'>,
    ): PreparedSnapshotLoad {
        const snapshot = this.validateEnvelope(input);
        const policy = options.missingPluginPolicy ?? 'warn-and-skip';
        const coreValidation = this.coreAdapter.validateSnapshot(snapshot.core);
        if (!coreValidation.valid) {
            throw new SnapshotValidationError(
                coreValidation.message,
                coreValidation.path ?? '$.core',
            );
        }
        const validatedSlices: Array<Readonly<{ id: string; value: unknown }>> = [];
        const opaqueSlices: Array<Readonly<{ id: string; entry: PluginMementoEntry }>> = [];
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
                if (policy === 'preserve-opaque') {
                    opaqueSlices.push(Object.freeze({ id, entry: cloneStateValue(entry) }));
                }
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
            validatedSlices.push(Object.freeze({ id, value: cloneStateValue(validation.value) }));
        }
        const prepared = Object.freeze({
            core: cloneStateValue(coreValidation.value),
            validatedSlices: Object.freeze(validatedSlices),
            opaqueSlices: Object.freeze(opaqueSlices),
        }) as PreparedSnapshotLoad;
        this.prepared.add(prepared);
        return prepared;
    }

    async loadPrepared(
        prepared: PreparedSnapshotLoad,
        options: Omit<SnapshotLoadOptions, 'missingPluginPolicy'> = {},
    ): Promise<void> {
        this.assertActive('load a prepared public snapshot');
        if (!this.prepared.has(prepared)) {
            throw new SnapshotValidationError('prepared snapshot is not trusted.');
        }
        const before = options.rollbackOnFailure === false ? null : this.mementos.capture();
        const controller = new AbortController();
        const abort = (): void => controller.abort(options.signal?.reason);
        options.signal?.addEventListener('abort', abort, { once: true });
        if (options.signal?.aborted) abort();
        const context: StateRestoreContext = Object.freeze({
            mode: 'public-snapshot',
            signal: controller.signal,
        });
        const validatedSlices = new Map(
            prepared.validatedSlices.map(({ id, value }) => [id, value] as const),
        );
        const nextOpaque = new Map(
            prepared.opaqueSlices.map(({ id, entry }) => [id, entry] as const),
        );

        try {
            await this.coreAdapter.restore(cloneStateValue(prepared.core), context);

            for (const slice of this.slices.list()) {
                if (validatedSlices.has(slice.id)) {
                    await slice.restore(validatedSlices.get(slice.id), context);
                } else {
                    await slice.clearState?.(context);
                }
            }
            this.opaque = nextOpaque;
        } catch (error) {
            if (!before) throw error;
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

    reset(): void {
        this.assertActive('reset SnapshotService');
        this.opaque.clear();
        this.prepared = new WeakSet<object>();
    }

    private validateEnvelope(value: unknown): EditorSnapshot {
        if (!isRecord(value)) throw new SnapshotValidationError('snapshot must be an object.');
        if (isUnsupportedCanvasEnvelope(value)) {
            throw new SnapshotVersionUnsupportedError(
                typeof value.version === 'number' ? value.version : 'unversioned',
            );
        }
        if (value.schema !== 'image-editor.state') {
            throw new SnapshotValidationError('schema must be "image-editor.state".', '$.schema');
        }
        if (value.version !== 3) {
            throw new SnapshotVersionUnsupportedError(
                typeof value.version === 'number' ? value.version : 'unversioned',
            );
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
            if (!isRuntimeIdentifier(id) || isDangerousStateKey(id)) {
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
