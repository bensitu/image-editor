import type { CoreEventMap } from '../../core/index.js';
import { type PluginRef, type SynchronousEditorPlugin } from '../../sdk/index.js';
import type { DomControlsOptions, DomControlsPluginApi } from './dom-controls-types.js';
export declare const domControlsPluginRef: PluginRef<DomControlsPluginApi>;
export declare function domControlsPlugin(options?: DomControlsOptions): SynchronousEditorPlugin<DomControlsPluginApi, CoreEventMap>;
export { DomControlsConfigurationError } from './dom-controls-controller.js';
export type { AnnotationControls, CropControls, DomActionErrorEvent, DomActionErrorListener, DomButtonTarget, DomControlsOptions, DomControlsPlugin, DomControlsPluginApi, DomControlsStatus, DomElementTarget, DomInputTarget, DomPluginBinding, DomRenderAdapter, DrawControls, FiltersControls, HistoryControls, KeyboardControlsOptions, MaskControls, MosaicControls, ShapeControls, TextControls, TransformControls, } from './dom-controls-types.js';
