import type * as FabricNS from 'fabric';

import { SnapshotValidationError } from './errors.js';
import type { CoreCanvasState, ImageMimeType } from './public-types.js';
import type {
    CoreStateAdapter,
    ObjectPropertyRegistry,
    StateCaptureContext,
    StateRestoreContext,
    StateValidationResult,
    TransientObjectRegistry,
} from './state/index.js';

interface CoreStateAccess {
    getCanvas(): FabricNS.Canvas | null;
    getBaseImage(): FabricNS.FabricImage | null;
    setBaseImage(image: FabricNS.FabricImage | null): void;
    getImageMimeType(): ImageMimeType | null;
    setImageMimeType(value: ImageMimeType | null): void;
    getBaseImageScale(): number;
    setBaseImageScale(value: number): void;
    getGeometryRevision(): number;
    setGeometryRevision(value: number): void;
    setCanvasSize(width: number, height: number): void;
    isDisposed(): boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveFinite(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isImageMimeType(value: unknown): value is ImageMimeType {
    return value === 'image/jpeg' || value === 'image/png' || value === 'image/webp';
}

function isBaseImage(object: FabricNS.FabricObject): object is FabricNS.FabricImage {
    return (
        (object as FabricNS.FabricObject & { editorObjectKind?: unknown }).editorObjectKind ===
        'baseImage'
    );
}

export class CanvasCoreStateAdapter implements CoreStateAdapter {
    constructor(
        private readonly access: CoreStateAccess,
        private readonly properties: ObjectPropertyRegistry,
        private readonly transientObjects: TransientObjectRegistry<FabricNS.FabricObject>,
        private readonly externalObjects: TransientObjectRegistry<FabricNS.FabricObject>,
    ) {}

    capture(context: StateCaptureContext): Record<string, unknown> {
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
            } satisfies CoreCanvasState;
        }
        const serializableCanvas = canvas as FabricNS.Canvas & {
            toJSON(propertiesToInclude: readonly string[]): unknown;
        };
        const serializedValue: unknown = serializableCanvas.toJSON(this.properties.listKeys());
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
            if (!isRecord(serializedObject) || !liveObject) continue;
            const liveRecord = liveObject as FabricNS.FabricObject & Record<string, unknown>;
            for (const key of propertyKeys) {
                if (liveRecord[key] !== undefined) serializedObject[key] = liveRecord[key];
            }
        }
        serialized.objects = serializedObjects.filter((entry, index) => {
            const liveObject = liveObjects[index];
            if (
                !entry ||
                !liveObject ||
                this.transientObjects.isTransient(liveObject) ||
                this.externalObjects.isTransient(liveObject)
            )
                return false;
            if (context.mode === 'snapshot') return isBaseImage(liveObject);
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
        } satisfies CoreCanvasState;
    }

    async restore(
        state: Readonly<Record<string, unknown>>,
        context: StateRestoreContext,
    ): Promise<void> {
        if (this.access.isDisposed()) {
            throw new Error('Cannot restore Core state after disposal.');
        }
        const validated = this.validateSnapshot(state);
        if (!validated.valid) throw new SnapshotValidationError(validated.message, validated.path);
        const next = validated.value;
        if (!next.initialized) {
            const canvas = this.access.getCanvas();
            canvas?.clear();
            this.access.setBaseImage(null);
            this.access.setImageMimeType(null);
            this.access.setBaseImageScale(1);
            this.access.setGeometryRevision(next.geometryRevision);
            return;
        }
        if (context.signal.aborted)
            throw context.signal.reason ?? new Error('State restore aborted.');
        const canvas = this.access.getCanvas();
        if (!canvas) throw new Error('Core Canvas must be initialized before state restore.');
        this.access.setCanvasSize(next.canvasWidth, next.canvasHeight);
        if (!next.canvas) throw new Error('Initialized Core state requires Canvas JSON.');
        await canvas.loadFromJSON(next.canvas);
        if (context.signal.aborted)
            throw context.signal.reason ?? new Error('State restore aborted.');
        const baseImages = canvas.getObjects().filter(isBaseImage);
        if (baseImages.length > 1)
            throw new Error('Restored Core state contains multiple base images.');
        const baseImage = baseImages[0] ?? null;
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

    validateSnapshot(
        value: unknown,
    ): StateValidationResult<Readonly<CoreCanvasState> & Readonly<Record<string, unknown>>> {
        if (!isRecord(value)) return { valid: false, message: 'Core state must be an object.' };
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
        if (!isRecord(value.canvas)) {
            return { valid: false, message: 'canvas must be an object.', path: '$.core.canvas' };
        }
        if (
            value.imageMimeType !== null &&
            value.imageMimeType !== undefined &&
            !isImageMimeType(value.imageMimeType)
        ) {
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
