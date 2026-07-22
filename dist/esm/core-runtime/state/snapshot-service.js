import { isRuntimeIdentifier } from '../../plugin-kernel/plugin-identifier.js';
import { SnapshotValidationError, SnapshotVersionUnsupportedError, StateRegistrationError, } from '../errors.js';
import { cloneStateValue, isDangerousStateKey } from './clone-state-value.js';
import { inspectEncodedImageDataUrl } from './image-data-url.js';
const EXTERNAL_RESOURCE_KEYS = new Set(['href', 'source', 'src', 'url']);
function isExternalResourceKey(propertyName) {
    if (!propertyName)
        return false;
    const normalized = propertyName.toLowerCase();
    return EXTERNAL_RESOURCE_KEYS.has(normalized) || normalized.endsWith('url');
}
export const DEFAULT_SNAPSHOT_LIMITS = Object.freeze({
    maxInputBytes: 16 * 1024 * 1024,
    maxDepth: 64,
    maxObjectCount: 100000,
    maxPluginCount: 256,
    maxPluginPayloadBytes: 4 * 1024 * 1024,
    maxMetadataBytes: 256 * 1024,
    maxStringLength: 16 * 1024 * 1024,
    maxDataUrlBytes: 16 * 1024 * 1024,
    maxDecodedPixels: 50000000,
    maxImageDimension: 32768,
    externalUrlPolicy: 'reject',
});
function byteLength(value) {
    return new TextEncoder().encode(value).byteLength;
}
function inspectTree(value, limits, path = '$', depth = 0, ancestors = new WeakSet(), counter = { count: 0 }, propertyName) {
    if (depth > limits.maxDepth) {
        throw new SnapshotValidationError(`nesting exceeds ${limits.maxDepth}.`, path);
    }
    if (value === null || typeof value !== 'object') {
        if (typeof value === 'number' && !Number.isFinite(value)) {
            throw new SnapshotValidationError('number must be finite.', path);
        }
        if (typeof value === 'string') {
            if (value.length > limits.maxStringLength) {
                throw new SnapshotValidationError(`string length exceeds ${limits.maxStringLength}.`, path);
            }
            if (value.startsWith('data:')) {
                const inspection = inspectEncodedImageDataUrl(value);
                if (!inspection) {
                    throw new SnapshotValidationError('Data URL must be a base64 PNG, JPEG, or WebP image.', path);
                }
                if (inspection.encodedBytes > limits.maxDataUrlBytes) {
                    throw new SnapshotValidationError(`Data URL exceeds ${limits.maxDataUrlBytes} bytes.`, path);
                }
                if (inspection.dimensions) {
                    const { width, height } = inspection.dimensions;
                    if (width * height > limits.maxDecodedPixels) {
                        throw new SnapshotValidationError(`decoded pixel count exceeds ${limits.maxDecodedPixels}.`, path);
                    }
                    if (width > limits.maxImageDimension || height > limits.maxImageDimension) {
                        throw new SnapshotValidationError(`image dimensions exceed ${limits.maxImageDimension}.`, path);
                    }
                }
            }
            else if (limits.externalUrlPolicy === 'reject' &&
                isExternalResourceKey(propertyName) &&
                /^(?:[a-z][a-z\d+.-]*:|\/\/)/iu.test(value)) {
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
    if (ancestors.has(value))
        throw new SnapshotValidationError('cyclic value.', path);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null && !Array.isArray(value)) {
        throw new SnapshotValidationError('only plain objects and arrays are accepted.', path);
    }
    if (Object.prototype.hasOwnProperty.call(value, 'toJSON') ||
        Object.getOwnPropertySymbols(value).length > 0) {
        throw new SnapshotValidationError('toJSON hooks and symbol properties are forbidden.', path);
    }
    ancestors.add(value);
    for (const key of Object.keys(value)) {
        if (isDangerousStateKey(key)) {
            throw new SnapshotValidationError(`dangerous key "${key}" is forbidden.`, `${path}.${key}`);
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !('value' in descriptor)) {
            throw new SnapshotValidationError('accessor properties are forbidden.', `${path}.${key}`);
        }
        const nestedValue = descriptor.value;
        inspectTree(nestedValue, limits, `${path}.${key}`, depth + 1, ancestors, counter, key);
        if (key === 'metadata' || key.endsWith('Metadata')) {
            const metadataBytes = byteLength(JSON.stringify(nestedValue));
            if (metadataBytes > limits.maxMetadataBytes) {
                throw new SnapshotValidationError(`metadata exceeds ${limits.maxMetadataBytes} bytes.`, `${path}.${key}`);
            }
        }
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
function isUnsupportedCanvasEnvelope(value) {
    if ('schema' in value || !Array.isArray(value.objects) || !isRecord(value._editorState)) {
        return false;
    }
    const editorState = value._editorState;
    return ['currentScale', 'currentRotation', 'baseImageScale'].every((key) => typeof editorState[key] === 'number');
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
        Object.defineProperty(this, "prepared", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new WeakSet()
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
        this.assertActive('load a public snapshot');
        const prepared = await this.prepareForLoad(input, options);
        await this.loadPrepared(prepared, options);
    }
    prepare(input, options = {}) {
        this.assertActive('prepare a public snapshot');
        return this.prepareParsed(parseInput(input, this.limits), options);
    }
    async prepareForLoad(input, options = {}) {
        var _a;
        this.assertActive('prepare a public snapshot');
        const parsed = parseInput(input, this.limits);
        if (!((_a = options.migrations) === null || _a === void 0 ? void 0 : _a.length) ||
            (isRecord(parsed) && parsed.schema === 'image-editor.state' && parsed.version === 3)) {
            return this.prepareParsed(parsed, options);
        }
        const immutableInput = cloneStateValue(parsed);
        const migration = options.migrations.find((candidate) => candidate.canMigrate(immutableInput));
        if (!migration)
            return this.prepareParsed(parsed, options);
        const context = { signal: options.signal };
        const migrated = await migration.migrate(immutableInput, context);
        return this.prepareParsed(parseInput(migrated, this.limits), options);
    }
    prepareParsed(input, options) {
        var _a, _b, _c, _d;
        const snapshot = this.validateEnvelope(input);
        const policy = (_a = options.missingPluginPolicy) !== null && _a !== void 0 ? _a : 'warn-and-skip';
        const coreValidation = this.coreAdapter.validateSnapshot(snapshot.core);
        if (!coreValidation.valid) {
            throw new SnapshotValidationError(coreValidation.message, (_b = coreValidation.path) !== null && _b !== void 0 ? _b : '$.core');
        }
        const validatedSlices = [];
        const opaqueSlices = [];
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
                if (policy === 'preserve-opaque') {
                    opaqueSlices.push(Object.freeze({ id, entry: cloneStateValue(entry) }));
                }
                (_c = this.warningSink) === null || _c === void 0 ? void 0 : _c.call(this, {
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
                throw new SnapshotValidationError(validation.message, (_d = validation.path) !== null && _d !== void 0 ? _d : `$.plugins.${id}.data`);
            }
            validatedSlices.push(Object.freeze({ id, value: cloneStateValue(validation.value) }));
        }
        const prepared = Object.freeze({
            core: cloneStateValue(coreValidation.value),
            validatedSlices: Object.freeze(validatedSlices),
            opaqueSlices: Object.freeze(opaqueSlices),
        });
        this.prepared.add(prepared);
        return prepared;
    }
    async loadPrepared(prepared, options = {}) {
        var _a, _b, _c, _d;
        this.assertActive('load a prepared public snapshot');
        if (!this.prepared.has(prepared)) {
            throw new SnapshotValidationError('prepared snapshot is not trusted.');
        }
        const before = options.rollbackOnFailure === false ? null : this.mementos.capture();
        const controller = new AbortController();
        const abort = () => { var _a; return controller.abort((_a = options.signal) === null || _a === void 0 ? void 0 : _a.reason); };
        (_a = options.signal) === null || _a === void 0 ? void 0 : _a.addEventListener('abort', abort, { once: true });
        if ((_b = options.signal) === null || _b === void 0 ? void 0 : _b.aborted)
            abort();
        const context = Object.freeze({
            mode: 'public-snapshot',
            signal: controller.signal,
        });
        const validatedSlices = new Map(prepared.validatedSlices.map(({ id, value }) => [id, value]));
        const nextOpaque = new Map(prepared.opaqueSlices.map(({ id, entry }) => [id, entry]));
        try {
            await this.coreAdapter.restore(cloneStateValue(prepared.core), context);
            for (const slice of this.slices.list()) {
                if (validatedSlices.has(slice.id)) {
                    await slice.restore(validatedSlices.get(slice.id), context);
                }
                else {
                    await ((_c = slice.clearState) === null || _c === void 0 ? void 0 : _c.call(slice, context));
                }
            }
            this.opaque = nextOpaque;
        }
        catch (error) {
            if (!before)
                throw error;
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
            (_d = options.signal) === null || _d === void 0 ? void 0 : _d.removeEventListener('abort', abort);
        }
    }
    dispose() {
        this.opaque.clear();
        this.disposed = true;
    }
    reset() {
        this.assertActive('reset SnapshotService');
        this.opaque.clear();
        this.prepared = new WeakSet();
    }
    validateEnvelope(value) {
        if (!isRecord(value))
            throw new SnapshotValidationError('snapshot must be an object.');
        if (isUnsupportedCanvasEnvelope(value)) {
            throw new SnapshotVersionUnsupportedError(typeof value.version === 'number' ? value.version : 'unversioned');
        }
        if (value.schema !== 'image-editor.state') {
            throw new SnapshotValidationError('schema must be "image-editor.state".', '$.schema');
        }
        if (value.version !== 3) {
            throw new SnapshotVersionUnsupportedError(typeof value.version === 'number' ? value.version : 'unversioned');
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
            if (!isRuntimeIdentifier(id) || isDangerousStateKey(id)) {
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
//# sourceMappingURL=snapshot-service.js.map