import { SnapshotValidationError, StateRegistrationError } from '../errors.js';
import { cloneStateValue, isDangerousStateKey } from './clone-state-value.js';
export const DEFAULT_SNAPSHOT_LIMITS = Object.freeze({
    maxInputBytes: 16 * 1024 * 1024,
    maxDepth: 64,
    maxPluginCount: 256,
    maxPluginPayloadBytes: 4 * 1024 * 1024,
    maxMetadataBytes: 256 * 1024,
});
function byteLength(value) {
    return new TextEncoder().encode(value).byteLength;
}
function inspectTree(value, limits, path = '$', depth = 0, ancestors = new WeakSet()) {
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
    if (ancestors.has(value))
        throw new SnapshotValidationError('cyclic value.', path);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null && !Array.isArray(value)) {
        throw new SnapshotValidationError('only plain objects and arrays are accepted.', path);
    }
    ancestors.add(value);
    for (const key of Object.keys(value)) {
        if (isDangerousStateKey(key)) {
            throw new SnapshotValidationError(`dangerous key "${key}" is forbidden.`, `${path}.${key}`);
        }
        inspectTree(value[key], limits, `${path}.${key}`, depth + 1, ancestors);
    }
    ancestors.delete(value);
}
function stableJson(value, limits) {
    inspectTree(value, limits);
    const sortValue = (entry) => {
        if (Array.isArray(entry))
            return entry.map(sortValue);
        if (entry && typeof entry === 'object') {
            const result = {};
            for (const key of Object.keys(entry).sort()) {
                result[key] = sortValue(entry[key]);
            }
            return result;
        }
        return entry;
    };
    return JSON.stringify(sortValue(value));
}
function parseInput(input, limits) {
    if (typeof input !== 'string') {
        inspectTree(input, limits);
        return input;
    }
    if (byteLength(input) > limits.maxInputBytes) {
        throw new SnapshotValidationError(`input exceeds ${limits.maxInputBytes} bytes.`);
    }
    try {
        const parsed = JSON.parse(input);
        inspectTree(parsed, limits);
        return parsed;
    }
    catch (error) {
        if (error instanceof SnapshotValidationError)
            throw error;
        throw new SnapshotValidationError('input is not valid JSON.', '$', error);
    }
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export class SnapshotService {
    constructor(coreAdapter, slices, mementos, warningSink, limits = DEFAULT_SNAPSHOT_LIMITS) {
        Object.defineProperty(this, "coreAdapter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: coreAdapter
        });
        Object.defineProperty(this, "slices", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: slices
        });
        Object.defineProperty(this, "mementos", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: mementos
        });
        Object.defineProperty(this, "warningSink", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: warningSink
        });
        Object.defineProperty(this, "limits", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: limits
        });
        Object.defineProperty(this, "opaque", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    capture() {
        this.assertActive('capture a public snapshot');
        const capturedAt = Date.now();
        const context = Object.freeze({ mode: 'snapshot', capturedAt });
        const plugins = Object.create(null);
        for (const [id, entry] of this.opaque)
            plugins[id] = cloneStateValue(entry);
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
    stringify() {
        return stableJson(this.capture(), this.limits);
    }
    async load(input, options = {}) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        this.assertActive('load a public snapshot');
        const snapshot = this.validateEnvelope(parseInput(input, this.limits));
        const policy = (_a = options.missingPluginPolicy) !== null && _a !== void 0 ? _a : 'warn-and-skip';
        const before = this.mementos.capture();
        const controller = new AbortController();
        const abort = () => { var _a; return controller.abort((_a = options.signal) === null || _a === void 0 ? void 0 : _a.reason); };
        (_b = options.signal) === null || _b === void 0 ? void 0 : _b.addEventListener('abort', abort, { once: true });
        if ((_c = options.signal) === null || _c === void 0 ? void 0 : _c.aborted)
            abort();
        const context = Object.freeze({
            mode: 'public-snapshot',
            signal: controller.signal,
        });
        const validatedSlices = new Map();
        const nextOpaque = new Map();
        try {
            const coreValidation = this.coreAdapter.validateSnapshot(snapshot.core);
            if (!coreValidation.valid) {
                throw new SnapshotValidationError(coreValidation.message, (_d = coreValidation.path) !== null && _d !== void 0 ? _d : '$.core');
            }
            for (const [id, entry] of Object.entries(snapshot.plugins)) {
                const serializedBytes = byteLength(stableJson(entry.data, this.limits));
                if (serializedBytes > this.limits.maxPluginPayloadBytes) {
                    throw new SnapshotValidationError(`plugin payload exceeds ${this.limits.maxPluginPayloadBytes} bytes.`, `$.plugins.${id}.data`);
                }
                const slice = this.slices.get(id);
                if (!slice) {
                    if (policy === 'error') {
                        throw new SnapshotValidationError('required plugin is not installed.', `$.plugins.${id}`);
                    }
                    if (policy === 'preserve-opaque')
                        nextOpaque.set(id, cloneStateValue(entry));
                    (_e = this.warningSink) === null || _e === void 0 ? void 0 : _e.call(this, {
                        code: 'SNAPSHOT_PLUGIN_MISSING',
                        message: `Snapshot data for missing plugin "${id}" was ${policy === 'preserve-opaque' ? 'preserved opaquely' : 'skipped'}.`,
                        sliceId: id,
                    });
                    continue;
                }
                if (entry.version !== slice.version) {
                    throw new SnapshotValidationError(`version ${entry.version} is incompatible with installed version ${slice.version}.`, `$.plugins.${id}.version`);
                }
                const validation = slice.validate(entry.data, {
                    sliceId: id,
                    version: entry.version,
                });
                if (!validation.valid) {
                    throw new SnapshotValidationError(validation.message, (_f = validation.path) !== null && _f !== void 0 ? _f : `$.plugins.${id}.data`);
                }
                validatedSlices.set(id, cloneStateValue(validation.value));
            }
            await this.coreAdapter.restore(cloneStateValue(coreValidation.value), context);
            for (const slice of this.slices.list()) {
                if (validatedSlices.has(slice.id)) {
                    await slice.restore(validatedSlices.get(slice.id), context);
                }
                else {
                    await ((_g = slice.clearState) === null || _g === void 0 ? void 0 : _g.call(slice, context));
                }
            }
            this.opaque = nextOpaque;
        }
        catch (error) {
            try {
                await this.mementos.restore(before, { rollbackOnFailure: false });
            }
            catch (rollbackError) {
                const combinedError = new Error('Snapshot load and rollback both failed.');
                combinedError.causes = Object.freeze([error, rollbackError]);
                throw new SnapshotValidationError('load failed and rollback could not restore the previous state.', '$', combinedError);
            }
            throw error;
        }
        finally {
            (_h = options.signal) === null || _h === void 0 ? void 0 : _h.removeEventListener('abort', abort);
        }
    }
    dispose() {
        this.opaque.clear();
        this.disposed = true;
    }
    validateEnvelope(value) {
        if (!isRecord(value))
            throw new SnapshotValidationError('snapshot must be an object.');
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
            throw new SnapshotValidationError(`plugin count exceeds ${this.limits.maxPluginCount}.`, '$.plugins');
        }
        const plugins = Object.create(null);
        for (const [id, entry] of entries) {
            if (id.trim().length === 0 || isDangerousStateKey(id)) {
                throw new SnapshotValidationError('plugin id is invalid.', `$.plugins.${id}`);
            }
            if (!isRecord(entry) ||
                !Number.isSafeInteger(entry.version) ||
                Number(entry.version) <= 0) {
                throw new SnapshotValidationError('plugin entry requires a positive integer version and data.', `$.plugins.${id}`);
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
    assertActive(operation) {
        if (this.disposed)
            throw new StateRegistrationError(`Cannot ${operation} after disposal.`);
    }
}
export function migrateV2SnapshotToV3(input, migratePlugins = () => Object.freeze({})) {
    if (!isRecord(input))
        throw new SnapshotValidationError('v2 snapshot must be an object.');
    if ('schema' in input && input.schema === 'image-editor.state' && input.version === 3) {
        if (!isRecord(input.core) || !isRecord(input.plugins)) {
            throw new SnapshotValidationError('v3 snapshot envelope is incomplete.');
        }
        const plugins = Object.create(null);
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
        schema: 'image-editor.state',
        version: 3,
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
//# sourceMappingURL=snapshot-service.js.map