import type { GeometryMutationCoordinator } from '../../core-runtime/geometry/index.js';
import type { CoreHostPort } from '../../core-runtime/internal-capabilities.js';
export interface TransformPluginOptions {
    readonly animationDuration?: number;
    readonly minScale?: number;
    readonly maxScale?: number;
    readonly scaleStep?: number;
    readonly rotationStep?: number;
}
export interface ResolvedTransformPluginOptions {
    readonly animationDuration: number;
    readonly minScale: number;
    readonly maxScale: number;
    readonly scaleStep: number;
    readonly rotationStep: number;
}
export interface TransformPluginState {
    readonly scale: number;
    readonly rotationDegrees: number;
    readonly flipX: boolean;
    readonly flipY: boolean;
}
export declare function resolveTransformOptions(options?: TransformPluginOptions): ResolvedTransformPluginOptions;
export declare class TransformPluginController {
    private readonly host;
    private readonly geometry;
    readonly options: ResolvedTransformPluginOptions;
    private readonly guard;
    private readonly queue;
    private readonly state;
    private mutationSequence;
    constructor(host: CoreHostPort, geometry: GeometryMutationCoordinator, options: ResolvedTransformPluginOptions);
    scale(factor: number): Promise<void>;
    private scaleWithOperation;
    zoomIn(): Promise<void>;
    zoomOut(): Promise<void>;
    rotate(degrees: number): Promise<void>;
    flipHorizontal(): Promise<void>;
    flipVertical(): Promise<void>;
    resetImageTransform(): Promise<void>;
    getState(): TransformPluginState;
    restoreState(state: TransformPluginState): void;
    resetStateFromImage(): void;
    dispose(): void;
    private flip;
    private enqueue;
    private applyScale;
    private applyRotation;
    private captureRollback;
    private restoreRollback;
    private computeTopLeftPoint;
    private throwIfAborted;
}
