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
/** Lazily resolves one installed Plugin API for a Canvas interaction binding. */
export interface CanvasPluginBinding<TApi> {
    /** Typed reference used for dependency validation. */
    readonly ref: PluginRef<TApi>;
    /** Resolves the current stable Plugin API. */
    resolve(): TApi;
}
/** Reason supplied when a Canvas gesture is cancelled. */
export type InteractionCancelReason = 'requested' | 'tool-change' | 'image-replaced' | 'image-cleared' | 'state-loaded' | 'pointer-cancel' | 'dispose' | 'error';
/** Pointer behavior and dependencies for Text authoring. */
export interface TextCanvasInteractionOptions {
    readonly plugin: CanvasPluginBinding<TextAnnotationPluginApi>;
    readonly overlays: CanvasPluginBinding<OverlayFoundationApi>;
    readonly annotations: CanvasPluginBinding<AnnotationPluginApi>;
    readonly blankClick?: 'create' | 'ignore';
    readonly existingTextClick?: 'edit' | 'select';
    readonly retargetEditing?: 'commit' | 'cancel';
}
/** Pointer behavior and dependency for Shape authoring. */
export interface ShapeCanvasInteractionOptions {
    readonly plugin: CanvasPluginBinding<ShapeAnnotationPluginApi>;
    readonly minimumDragDistance?: number;
    readonly continuous?: boolean;
}
/** Dependency for Draw pointer authoring. */
export interface DrawCanvasInteractionOptions {
    readonly plugin: CanvasPluginBinding<DrawAnnotationPluginApi>;
}
/** Dependency for Mosaic pointer authoring. */
export interface MosaicCanvasInteractionOptions {
    readonly plugin: CanvasPluginBinding<MosaicPluginApi>;
}
/** Canvas cursor values applied while each authoring binding owns the active tool. */
export interface CanvasCursorOptions {
    readonly text?: string;
    readonly shape?: string;
    readonly draw?: string;
    readonly mosaic?: string;
}
/** Binding and lifecycle operation associated with an interaction failure. */
export interface CanvasInteractionErrorContext {
    readonly bindingId: string | null;
    readonly operation: 'claim' | 'move' | 'end' | 'cancel';
}
/** Configures available Canvas authoring bindings, cursors, and error reporting. */
export interface CanvasInteractionsPluginOptions {
    /** Text pointer authoring, or `false` to omit the binding. */
    readonly text?: TextCanvasInteractionOptions | false;
    /** Shape pointer authoring, or `false` to omit the binding. */
    readonly shape?: ShapeCanvasInteractionOptions | false;
    /** Draw pointer authoring, or `false` to omit the binding. */
    readonly draw?: DrawCanvasInteractionOptions | false;
    /** Mosaic pointer authoring, or `false` to omit the binding. */
    readonly mosaic?: MosaicCanvasInteractionOptions | false;
    /** Cursor overrides keyed by authoring binding. */
    readonly cursors?: CanvasCursorOptions;
    /** Receives interaction failures after the active gesture is safely cancelled. */
    readonly onInteractionError?: (error: unknown, context: Readonly<CanvasInteractionErrorContext>) => void;
}
/** Observable binding, disposal, and active gesture state. */
export interface CanvasInteractionsStatus {
    readonly isBound: boolean;
    readonly isDisposed: boolean;
    readonly activeBindingId: string | null;
    readonly gestureActive: boolean;
}
/** Listener invoked when Canvas interaction status changes. */
export type CanvasInteractionsStatusListener = (status: Readonly<CanvasInteractionsStatus>) => void;
/** Public Canvas interaction refresh, cancellation, and status operations. */
export interface CanvasInteractionsPluginApi {
    /** Re-evaluates optional Plugin dependencies and active bindings. */
    refresh(): void;
    /** Cancels the active pointer gesture and restores its transient state. */
    cancel(reason?: InteractionCancelReason): Promise<void>;
    /** Returns an immutable Canvas interaction status snapshot. */
    getStatus(): Readonly<CanvasInteractionsStatus>;
    /** Subscribes to Canvas interaction status changes. */
    subscribe(listener: CanvasInteractionsStatusListener): Disposable;
}
