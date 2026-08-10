/**
 * Declares Canvas interaction bindings, policies, status, diagnostics, and the public Plugin API.
 *
 * @module
 */
import type { AnnotationPluginApi } from '../../foundations/annotation/index.js';
import type { OverlayFoundationApi } from '../../foundations/overlay/index.js';
import type { Disposable, PluginRef } from '../../sdk/index.js';
import type { DrawAnnotationPluginApi } from '../annotation-draw/index.js';
import type { ShapeAnnotationPluginApi } from '../annotation-shape/index.js';
import type { TextAnnotationPluginApi } from '../annotation-text/index.js';
import type { MosaicPluginApi } from '../mosaic/index.js';
export interface CanvasPluginBinding<TApi> {
    readonly ref: PluginRef<TApi>;
    resolve(): TApi;
}
export type InteractionCancelReason = 'requested' | 'tool-change' | 'image-replaced' | 'image-cleared' | 'state-loaded' | 'pointer-cancel' | 'dispose' | 'error';
export interface TextCanvasInteractionOptions {
    readonly plugin: CanvasPluginBinding<TextAnnotationPluginApi>;
    readonly overlays: CanvasPluginBinding<OverlayFoundationApi>;
    readonly annotations: CanvasPluginBinding<AnnotationPluginApi>;
    readonly blankClick?: 'create' | 'ignore';
    readonly existingTextClick?: 'edit' | 'select';
    readonly retargetEditing?: 'commit' | 'cancel';
}
export interface ShapeCanvasInteractionOptions {
    readonly plugin: CanvasPluginBinding<ShapeAnnotationPluginApi>;
    readonly minimumDragDistance?: number;
    readonly continuous?: boolean;
}
export interface DrawCanvasInteractionOptions {
    readonly plugin: CanvasPluginBinding<DrawAnnotationPluginApi>;
}
export interface MosaicCanvasInteractionOptions {
    readonly plugin: CanvasPluginBinding<MosaicPluginApi>;
}
export interface CanvasCursorOptions {
    readonly text?: string;
    readonly shape?: string;
    readonly draw?: string;
    readonly mosaic?: string;
}
export interface CanvasInteractionErrorContext {
    readonly bindingId: string | null;
    readonly operation: 'claim' | 'move' | 'end' | 'cancel';
}
export interface CanvasInteractionsPluginOptions {
    readonly text?: TextCanvasInteractionOptions | false;
    readonly shape?: ShapeCanvasInteractionOptions | false;
    readonly draw?: DrawCanvasInteractionOptions | false;
    readonly mosaic?: MosaicCanvasInteractionOptions | false;
    readonly cursors?: CanvasCursorOptions;
    readonly onInteractionError?: (error: unknown, context: Readonly<CanvasInteractionErrorContext>) => void;
}
export interface CanvasInteractionsStatus {
    readonly isBound: boolean;
    readonly isDisposed: boolean;
    readonly activeBindingId: string | null;
    readonly gestureActive: boolean;
}
export type CanvasInteractionsStatusListener = (status: Readonly<CanvasInteractionsStatus>) => void;
export interface CanvasInteractionsPluginApi {
    refresh(): void;
    cancel(reason?: InteractionCancelReason): Promise<void>;
    getStatus(): Readonly<CanvasInteractionsStatus>;
    subscribe(listener: CanvasInteractionsStatusListener): Disposable;
}
