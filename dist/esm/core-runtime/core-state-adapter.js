import { SnapshotValidationError } from './errors.js';
const DEFAULT_SECURITY_LIMITS = Object.freeze({
    maxDecodedPixels: 50000000,
    maxImageDimension: 32768,
    decodeTimeoutMs: 15000,
});
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isPositiveFinite(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
function isImageMimeType(value) {
    return value === 'image/jpeg' || value === 'image/png' || value === 'image/webp';
}
function isBaseImage(object) {
    return (object.editorObjectKind ===
        'baseImage');
}
export class CanvasCoreStateAdapter {
    constructor(access, properties, transientObjects, externalObjects, securityLimits = DEFAULT_SECURITY_LIMITS) {
        Object.defineProperty(this, "access", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: access
        });
        Object.defineProperty(this, "properties", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: properties
        });
        Object.defineProperty(this, "transientObjects", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: transientObjects
        });
        Object.defineProperty(this, "externalObjects", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: externalObjects
        });
        Object.defineProperty(this, "securityLimits", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: securityLimits
        });
    }
    capture(context) {
        const canvas = this.access.getCanvas();
        if (!canvas) {
            return {
                initialized: false,
                canvasWidth: 0,
                canvasHeight: 0,
                canvas: null,
                imageMimeType: null,
                baseImageScale: 1,
                geometryRevision: this.access.getGeometryRevision(),
            };
        }
        const serializableCanvas = canvas;
        const serializedValue = serializableCanvas.toJSON(this.properties.listKeys());
        if (!isRecord(serializedValue)) {
            throw new SnapshotValidationError('Fabric canvas serialization must be an object.');
        }
        const serialized = { ...serializedValue };
        const serializedObjects = Array.isArray(serialized.objects) ? serialized.objects : [];
        const liveObjects = canvas.getObjects();
        const propertyKeys = this.properties.listKeys();
        for (let index = 0; index < serializedObjects.length; index += 1) {
            const serializedObject = serializedObjects[index];
            const liveObject = liveObjects[index];
            if (!isRecord(serializedObject) || !liveObject)
                continue;
            const liveRecord = liveObject;
            for (const key of propertyKeys) {
                if (liveRecord[key] !== undefined)
                    serializedObject[key] = liveRecord[key];
            }
        }
        serialized.objects = serializedObjects.filter((entry, index) => {
            const liveObject = liveObjects[index];
            if (!entry ||
                !liveObject ||
                this.transientObjects.isTransient(liveObject) ||
                this.externalObjects.isTransient(liveObject))
                return false;
            if (context.mode === 'snapshot')
                return isBaseImage(liveObject);
            return true;
        });
        return {
            initialized: true,
            canvasWidth: canvas.getWidth(),
            canvasHeight: canvas.getHeight(),
            canvas: serialized,
            imageMimeType: this.access.getImageMimeType(),
            baseImageScale: this.access.getBaseImageScale(),
            geometryRevision: this.access.getGeometryRevision(),
        };
    }
    async restore(state, context) {
        var _a, _b, _c;
        if (this.access.isDisposed()) {
            throw new Error('Cannot restore Core state after disposal.');
        }
        const validated = this.validateState(state, context.mode === 'public-snapshot');
        if (!validated.valid)
            throw new SnapshotValidationError(validated.message, validated.path);
        const next = validated.value;
        if (!next.initialized) {
            const canvas = this.access.getCanvas();
            canvas === null || canvas === void 0 ? void 0 : canvas.clear();
            this.access.setBaseImage(null);
            this.access.setImageMimeType(null);
            this.access.setBaseImageScale(1);
            this.access.setGeometryRevision(next.geometryRevision);
            return;
        }
        if (context.signal.aborted)
            throw (_a = context.signal.reason) !== null && _a !== void 0 ? _a : new Error('State restore aborted.');
        const canvas = this.access.getCanvas();
        if (!canvas)
            throw new Error('Core Canvas must be initialized before state restore.');
        this.access.setCanvasSize(next.canvasWidth, next.canvasHeight);
        if (!next.canvas)
            throw new Error('Initialized Core state requires Canvas JSON.');
        const controller = new AbortController();
        const abort = () => controller.abort(context.signal.reason);
        context.signal.addEventListener('abort', abort, { once: true });
        if (context.signal.aborted)
            abort();
        const timeout = setTimeout(() => {
            controller.abort(new SnapshotValidationError(`Canvas decode timed out after ${this.securityLimits.decodeTimeoutMs}ms.`, '$.core.canvas'));
        }, this.securityLimits.decodeTimeoutMs);
        try {
            await canvas.loadFromJSON(next.canvas, undefined, { signal: controller.signal });
        }
        catch (error) {
            if (controller.signal.aborted && controller.signal.reason) {
                throw controller.signal.reason;
            }
            throw error;
        }
        finally {
            clearTimeout(timeout);
            context.signal.removeEventListener('abort', abort);
        }
        if (context.signal.aborted)
            throw (_b = context.signal.reason) !== null && _b !== void 0 ? _b : new Error('State restore aborted.');
        const baseImages = canvas.getObjects().filter(isBaseImage);
        if (baseImages.length > 1)
            throw new Error('Restored Core state contains multiple base images.');
        const baseImage = (_c = baseImages[0]) !== null && _c !== void 0 ? _c : null;
        if (baseImage) {
            baseImage.set({ selectable: false, evented: false });
            baseImage.setCoords();
            canvas.sendObjectToBack(baseImage);
        }
        this.access.setBaseImage(baseImage);
        this.access.setImageMimeType(next.imageMimeType);
        this.access.setBaseImageScale(next.baseImageScale);
        this.access.setGeometryRevision(next.geometryRevision);
    }
    validateSnapshot(value) {
        return this.validateState(value, true);
    }
    validateState(value, publicInput) {
        if (!isRecord(value))
            return { valid: false, message: 'Core state must be an object.' };
        if (typeof value.initialized !== 'boolean') {
            return {
                valid: false,
                message: 'initialized must be boolean.',
                path: '$.core.initialized',
            };
        }
        if (!Number.isSafeInteger(value.geometryRevision) || Number(value.geometryRevision) < 0) {
            return {
                valid: false,
                message: 'geometryRevision must be a non-negative integer.',
                path: '$.core.geometryRevision',
            };
        }
        if (!value.initialized) {
            return {
                valid: true,
                value: {
                    initialized: false,
                    canvasWidth: 0,
                    canvasHeight: 0,
                    canvas: null,
                    imageMimeType: null,
                    baseImageScale: 1,
                    geometryRevision: Number(value.geometryRevision),
                },
            };
        }
        if (!isPositiveFinite(value.canvasWidth) || !isPositiveFinite(value.canvasHeight)) {
            return {
                valid: false,
                message: 'Canvas dimensions must be positive finite numbers.',
                path: '$.core.canvasWidth',
            };
        }
        if (Number(value.canvasWidth) > this.securityLimits.maxImageDimension ||
            Number(value.canvasHeight) > this.securityLimits.maxImageDimension ||
            Number(value.canvasWidth) * Number(value.canvasHeight) >
                this.securityLimits.maxDecodedPixels) {
            return {
                valid: false,
                message: 'Canvas dimensions exceed the configured Snapshot budget.',
                path: '$.core.canvasWidth',
            };
        }
        if (!isRecord(value.canvas)) {
            return { valid: false, message: 'canvas must be an object.', path: '$.core.canvas' };
        }
        if (publicInput) {
            const objects = value.canvas.objects;
            if (!Array.isArray(objects)) {
                return {
                    valid: false,
                    message: 'Canvas objects must be an array.',
                    path: '$.core.canvas.objects',
                };
            }
            for (let index = 0; index < objects.length; index += 1) {
                const object = objects[index];
                if (!isRecord(object)) {
                    return {
                        valid: false,
                        message: 'Canvas object must be a record.',
                        path: `$.core.canvas.objects.${index}`,
                    };
                }
                if (object.type !== 'Image') {
                    return {
                        valid: false,
                        message: `unknown Fabric class "${String(object.type)}".`,
                        path: `$.core.canvas.objects.${index}.type`,
                    };
                }
                if (object.editorObjectKind !== 'baseImage') {
                    return {
                        valid: false,
                        message: 'persistent Canvas objects require an installed Object Codec.',
                        path: `$.core.canvas.objects.${index}.editorObjectKind`,
                    };
                }
                if ('filters' in object &&
                    (!Array.isArray(object.filters) || object.filters.length > 0)) {
                    return {
                        valid: false,
                        message: 'Base Image Fabric filters are not accepted in public Snapshots.',
                        path: `$.core.canvas.objects.${index}.filters`,
                    };
                }
            }
            if (objects.length > 1) {
                return {
                    valid: false,
                    message: 'Public Core Snapshot may contain at most one base image.',
                    path: '$.core.canvas.objects',
                };
            }
        }
        if (value.imageMimeType !== null &&
            value.imageMimeType !== undefined &&
            !isImageMimeType(value.imageMimeType)) {
            return {
                valid: false,
                message: 'imageMimeType is unsupported.',
                path: '$.core.imageMimeType',
            };
        }
        if (!isPositiveFinite(value.baseImageScale)) {
            return {
                valid: false,
                message: 'baseImageScale must be positive and finite.',
                path: '$.core.baseImageScale',
            };
        }
        return {
            valid: true,
            value: {
                initialized: true,
                canvasWidth: value.canvasWidth,
                canvasHeight: value.canvasHeight,
                canvas: value.canvas,
                imageMimeType: isImageMimeType(value.imageMimeType) ? value.imageMimeType : null,
                baseImageScale: value.baseImageScale,
                geometryRevision: Number(value.geometryRevision),
            },
        };
    }
}
//# sourceMappingURL=core-state-adapter.js.map