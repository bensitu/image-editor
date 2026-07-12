import type { CoreEventMap } from '../../core-runtime/public-types.js';
import { type SynchronousEditorPlugin } from '../../plugin-kernel/index.js';
import { type TransformPluginOptions, type TransformPluginState } from './transform-controller.js';
export interface TransformPluginApi {
    scale(factor: number): Promise<void>;
    zoomIn(): Promise<void>;
    zoomOut(): Promise<void>;
    rotate(degrees: number): Promise<void>;
    flipHorizontal(): Promise<void>;
    flipVertical(): Promise<void>;
    resetImageTransform(): Promise<void>;
    getState(): TransformPluginState;
}
export declare const transformPluginRef: import("../../plugin-kernel/plugin-ref.js").PluginRef<TransformPluginApi>;
export declare function transformPlugin(options?: TransformPluginOptions): SynchronousEditorPlugin<TransformPluginApi, CoreEventMap>;
export type { ResolvedTransformPluginOptions, TransformPluginOptions, TransformPluginState, } from './transform-controller.js';
