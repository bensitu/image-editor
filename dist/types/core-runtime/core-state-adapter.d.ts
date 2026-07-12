import type * as FabricNS from 'fabric';
import type { CoreCanvasState, ImageMimeType } from './public-types.js';
import type { CoreStateAdapter, ObjectPropertyRegistry, StateCaptureContext, StateRestoreContext, StateValidationResult, TransientObjectRegistry } from './state/index.js';
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
export declare class CanvasCoreStateAdapter implements CoreStateAdapter {
    private readonly access;
    private readonly properties;
    private readonly transientObjects;
    private readonly externalObjects;
    constructor(access: CoreStateAccess, properties: ObjectPropertyRegistry, transientObjects: TransientObjectRegistry<FabricNS.FabricObject>, externalObjects: TransientObjectRegistry<FabricNS.FabricObject>);
    capture(context: StateCaptureContext): Record<string, unknown>;
    restore(state: Readonly<Record<string, unknown>>, context: StateRestoreContext): Promise<void>;
    validateSnapshot(value: unknown): StateValidationResult<Readonly<CoreCanvasState> & Readonly<Record<string, unknown>>>;
}
export {};
