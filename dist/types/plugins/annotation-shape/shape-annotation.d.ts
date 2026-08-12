/**
 * Declares Shape Annotation geometry, styling, session, configuration, and Plugin API contracts.
 *
 * @module
 */
import type { AnnotationId, AnnotationMetadata } from '../../foundations/annotation/index.js';
/** Geometry families supported by Shape Annotations. */
export type ShapeAnnotationKind = 'rect' | 'line' | 'arrow';
/** Two-dimensional Canvas coordinate used by Shape geometry. */
export interface AnnotationPoint {
    readonly x: number;
    readonly y: number;
}
/** Rectangle geometry supplied to Shape creation and preview. */
export interface RectShapeGeometry {
    readonly kind: 'rect';
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
}
/** Line or arrow endpoints supplied to Shape creation and preview. */
export interface LinearShapeGeometry {
    readonly kind: 'line' | 'arrow';
    readonly start: AnnotationPoint;
    readonly end: AnnotationPoint;
}
/** Geometry accepted by the Shape Annotation Plugin. */
export type ShapeGeometryInput = RectShapeGeometry | LinearShapeGeometry;
/** Fully normalized defaults for Shape creation and authoring. */
export interface ShapeAnnotationConfiguration {
    readonly stroke: string;
    readonly strokeWidth: number;
    readonly fill: string;
    readonly opacity: number;
    readonly strokeDashArray: readonly number[] | null;
    readonly arrowHeadLength: number;
    readonly selectable: boolean;
    readonly evented: boolean;
    readonly bindToImageTransform: boolean;
    readonly namePrefix: string;
}
/** Construction options for the Shape Annotation Plugin. */
export type ShapeAnnotationPluginOptions = Partial<ShapeAnnotationConfiguration>;
/** Optional style and interaction values for a Shape. */
export interface ShapeStyleInput {
    readonly stroke?: string;
    readonly strokeWidth?: number;
    readonly fill?: string;
    readonly opacity?: number;
    readonly strokeDashArray?: readonly number[] | null;
    readonly arrowHeadLength?: number;
    readonly selectable?: boolean;
    readonly evented?: boolean;
}
/** Shape kind, style, metadata, and selection for one authoring session. */
export interface ShapeSessionOptions extends ShapeStyleInput {
    readonly kind: ShapeAnnotationKind;
    readonly name?: string;
    readonly metadata?: AnnotationMetadata;
    readonly hidden?: boolean;
    readonly locked?: boolean;
    readonly select?: boolean;
}
/** Complete geometry and presentation for direct Shape creation. */
export interface ShapeAnnotationDefinition extends ShapeStyleInput {
    readonly geometry: ShapeGeometryInput;
    readonly name?: string;
    readonly metadata?: AnnotationMetadata;
    readonly hidden?: boolean;
    readonly locked?: boolean;
    readonly select?: boolean;
}
/** Feature-specific and shared changes for an existing Shape Annotation. */
export interface ShapeAnnotationUpdate {
    readonly stroke?: string;
    readonly strokeWidth?: number;
    readonly fill?: string;
    readonly opacity?: number;
    readonly strokeDashArray?: readonly number[] | null;
    readonly name?: string;
    readonly metadata?: AnnotationMetadata;
    readonly hidden?: boolean;
    readonly locked?: boolean;
}
/** Immutable view of the active Shape authoring session. */
export interface ShapeSessionState {
    readonly kind: ShapeAnnotationKind;
    readonly geometry: ShapeGeometryInput | null;
    readonly options: Readonly<ShapeSessionOptions>;
}
/** Public Shape authoring, creation, update, and configuration operations. */
export interface ShapeAnnotationPluginApi {
    /** Starts a transient Shape authoring session. */
    enter(options: ShapeSessionOptions): Promise<void>;
    /** Replaces the active transient Shape geometry. */
    updatePreview(geometry: ShapeGeometryInput): Promise<void>;
    /** Commits the active Shape preview and returns its Annotation identity. */
    commit(): Promise<AnnotationId>;
    /** Discards the active Shape authoring session. */
    cancel(): Promise<void>;
    /** Creates one Shape directly as a committed mutation. */
    create(definition: ShapeAnnotationDefinition): Promise<AnnotationId>;
    /** Applies Shape style or metadata changes transactionally. */
    update(id: AnnotationId, patch: ShapeAnnotationUpdate): Promise<void>;
    /** Updates validated defaults and refreshes active authoring state. */
    configure(patch: Partial<ShapeAnnotationConfiguration>): Promise<void>;
    /** Returns immutable normalized Shape configuration. */
    getConfiguration(): Readonly<ShapeAnnotationConfiguration>;
    /** Returns the active Shape session, or `null` when inactive. */
    getSession(): ShapeSessionState | null;
}
