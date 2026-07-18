import type { CoreEventMap } from '../../core/index.js';
import { type SynchronousEditorPlugin } from '../../sdk/index.js';
import type { DrawAnnotationPluginApi, DrawAnnotationPluginOptions } from './draw-annotation.js';
export declare const drawAnnotationPluginRef: import("../../index.js").PluginRef<DrawAnnotationPluginApi>;
export declare function drawAnnotationPlugin(options?: DrawAnnotationPluginOptions): SynchronousEditorPlugin<DrawAnnotationPluginApi, CoreEventMap>;
export type { AnnotationPoint, DrawAnnotationPluginApi, DrawAnnotationPluginOptions, DrawBrushConfiguration, DrawConfiguration, DrawEnterOptions, DrawSessionState, DrawSubMode, EraserConfiguration, } from './draw-annotation.js';
