/**
 * Declares Draw Annotation brush, eraser, session, configuration, and Plugin API contracts.
 *
 * @module
 */
import type { AnnotationId } from '../../foundations/annotation/index.js';
/** Two-dimensional Canvas coordinate used by Draw strokes. */
export interface AnnotationPoint {
    readonly x: number;
    readonly y: number;
}
/** Active Draw tool behavior. */
export type DrawSubMode = 'brush' | 'erase';
/** Fully normalized brush appearance, interaction, and resource limits. */
export interface DrawBrushConfiguration {
    readonly color: string;
    readonly width: number;
    readonly opacity: number;
    readonly lineCap: CanvasLineCap;
    readonly lineJoin: CanvasLineJoin;
    readonly selectable: boolean;
    readonly evented: boolean;
    readonly bindToImageTransform: boolean;
    readonly interpolationSpacing: number;
    readonly maxPointCount: number;
    readonly namePrefix: string;
}
/** Fully normalized whole-object eraser behavior and preview style. */
export interface EraserConfiguration {
    readonly radius: number;
    readonly previewStroke: string;
    readonly previewStrokeWidth: number;
    readonly previewFill: string;
    readonly interpolationSpacing: number;
    readonly maxPointCount: number;
}
/** Combined immutable Draw brush and eraser configuration. */
export interface DrawConfiguration {
    readonly brush: Readonly<DrawBrushConfiguration>;
    readonly eraser: Readonly<EraserConfiguration>;
}
/** Construction options for the Draw Annotation Plugin. */
export interface DrawAnnotationPluginOptions {
    readonly brush?: Partial<DrawBrushConfiguration>;
    readonly eraser?: Partial<EraserConfiguration>;
}
/** Selects the initial behavior for one Draw session. */
export interface DrawEnterOptions {
    readonly subMode?: DrawSubMode;
}
/** Immutable view of the active Draw session. */
export interface DrawSessionState {
    readonly subMode: DrawSubMode;
    readonly isStrokeActive: boolean;
    readonly pointCount: number;
}
/** Public Draw session, stroke, eraser, and configuration operations. */
export interface DrawAnnotationPluginApi {
    /** Activates Draw authoring. */
    enter(options?: DrawEnterOptions): Promise<void>;
    /** Switches brush or whole-object eraser behavior. */
    setSubMode(mode: DrawSubMode): Promise<void>;
    /** Starts a transient stroke at a Canvas coordinate. */
    beginStroke(point: AnnotationPoint): Promise<void>;
    /** Appends a Canvas coordinate to the active stroke. */
    appendStroke(point: AnnotationPoint): Promise<void>;
    /** Commits a meaningful brush stroke or eraser result. */
    endStroke(): Promise<AnnotationId | null>;
    /** Discards the active transient stroke. */
    cancelStroke(): Promise<void>;
    /** Cancels transient work and exits Draw authoring. */
    exit(): Promise<void>;
    /** Updates validated brush configuration for future strokes. */
    configureBrush(patch: Partial<DrawBrushConfiguration>): Promise<void>;
    /** Updates validated eraser configuration for future strokes. */
    configureEraser(patch: Partial<EraserConfiguration>): Promise<void>;
    /** Returns immutable normalized Draw configuration. */
    getConfiguration(): DrawConfiguration;
    /** Returns the active Draw session, or `null` when inactive. */
    getSession(): DrawSessionState | null;
}
