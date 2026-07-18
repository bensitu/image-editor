import type { CoreEventMap } from '../../core/index.js';
import { type SynchronousEditorPlugin } from '../../sdk/index.js';
import { type MaskPluginApi, type MaskPluginOptions } from './mask-controller.js';
export declare const maskPluginRef: import("../../index.js").PluginRef<MaskPluginApi>;
export declare function maskPlugin(options?: MaskPluginOptions): SynchronousEditorPlugin<MaskPluginApi, CoreEventMap>;
export type { MaskPluginApi, MaskPluginOptions, RemoveAllOptions, ResolvedMaskPluginOptions, } from './mask-controller.js';
export type { DefaultMaskConfig, LabelConfig, MaskConfig, MaskObject } from '../../core/index.js';
