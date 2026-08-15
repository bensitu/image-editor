/**
 * Publishes the optional Canvas Interactions Plugin and its public contracts.
 *
 * @module
 */
import type { CoreEventMap } from '../../core/index.js';
import { type PluginRef, type SynchronousEditorPlugin } from '../../sdk/index.js';
import type { CanvasInteractionsPluginApi, CanvasInteractionsPluginOptions } from './canvas-interactions-types.js';
export declare const canvasInteractionsPluginRef: PluginRef<CanvasInteractionsPluginApi>;
export declare function canvasInteractionsPlugin(options?: CanvasInteractionsPluginOptions): SynchronousEditorPlugin<CanvasInteractionsPluginApi, CoreEventMap>;
export type { CanvasCursorOptions, CanvasInteractionErrorContext, CanvasInteractionsPluginApi, CanvasInteractionsPluginOptions, CanvasInteractionsStatus, CanvasInteractionsStatusListener, CanvasPluginBinding, DrawCanvasInteractionOptions, InteractionCancelReason, MosaicCanvasInteractionOptions, ShapeCanvasInteractionOptions, TextCanvasInteractionOptions, } from './canvas-interactions-types.js';
export { CanvasInteractionsConfigurationError } from './canvas-interactions-error.js';
export default canvasInteractionsPlugin;
