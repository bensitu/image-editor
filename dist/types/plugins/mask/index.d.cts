import type { CoreEventMap } from '../../core-runtime/public-types.js';
import { type SynchronousEditorPlugin } from '../../plugin-kernel/index.js';
import { type MaskPluginApi, type MaskPluginOptions } from './mask-controller.js';
export declare const maskPluginRef: import("../../plugin-kernel/plugin-ref.js").PluginRef<MaskPluginApi>;
export declare function maskPlugin(options?: MaskPluginOptions): SynchronousEditorPlugin<MaskPluginApi, CoreEventMap>;
export type { MaskPluginApi, MaskPluginOptions, RemoveAllOptions, ResolvedMaskPluginOptions, } from './mask-controller.js';
export type { DefaultMaskConfig, LabelConfig, MaskConfig, MaskObject, } from '../../core/public-types.js';
