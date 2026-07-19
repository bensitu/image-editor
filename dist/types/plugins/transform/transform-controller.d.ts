/**
 * Coordinates Base Image scale, rotation, reflection, animation, state, and geometry mutations.
 *
 * @module
 */
import type { DocumentMutationContext, GeometryMutationPort } from '../../core/index.js';
import type { BaseImageReadPort, CoreStatusPort, FabricRuntimePort, RenderRequestPort } from '../../sdk/index.js';
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
export interface TransformMutationOptions {
    readonly parent?: DocumentMutationContext;
}
export declare function resolveTransformOptions(options?: TransformPluginOptions): ResolvedTransformPluginOptions;
export declare class TransformPluginController {
    private readonly environment;
    private readonly baseImage;
    private readonly render;
    private readonly geometry;
    readonly options: ResolvedTransformPluginOptions;
    private readonly animations;
    private readonly state;
    private mutationSequence;
    constructor(environment: CoreStatusPort & FabricRuntimePort, baseImage: BaseImageReadPort, render: RenderRequestPort, geometry: GeometryMutationPort, options: ResolvedTransformPluginOptions);
    scale(factor: number, options?: TransformMutationOptions): Promise<void>;
    private scaleWithOperation;
    zoomIn(options?: TransformMutationOptions): Promise<void>;
    zoomOut(options?: TransformMutationOptions): Promise<void>;
    rotate(degrees: number, options?: TransformMutationOptions): Promise<void>;
    flipHorizontal(options?: TransformMutationOptions): Promise<void>;
    flipVertical(options?: TransformMutationOptions): Promise<void>;
    resetImageTransform(options?: TransformMutationOptions): Promise<void>;
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
    private runAnimation;
}
