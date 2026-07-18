import type { CoreEventMap } from '../../core/index.js';
import { type SynchronousEditorPlugin } from '../../sdk/index.js';
import { type TransformMutationOptions, type TransformPluginOptions, type TransformPluginState } from './transform-controller.js';
export interface TransformPluginApi {
    scale(factor: number, options?: TransformMutationOptions): Promise<void>;
    zoomIn(options?: TransformMutationOptions): Promise<void>;
    zoomOut(options?: TransformMutationOptions): Promise<void>;
    rotate(degrees: number, options?: TransformMutationOptions): Promise<void>;
    flipHorizontal(options?: TransformMutationOptions): Promise<void>;
    flipVertical(options?: TransformMutationOptions): Promise<void>;
    resetImageTransform(options?: TransformMutationOptions): Promise<void>;
    getState(): TransformPluginState;
}
export declare const transformPluginRef: import("../../index.js").PluginRef<TransformPluginApi>;
export declare function transformPlugin(options?: TransformPluginOptions): SynchronousEditorPlugin<TransformPluginApi, CoreEventMap>;
export type { ResolvedTransformPluginOptions, TransformPluginOptions, TransformMutationOptions, TransformPluginState, } from './transform-controller.js';
