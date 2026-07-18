import type { AnnotationId, AnnotationMetadata } from '../../foundations/annotation/index.js';

export type ShapeAnnotationKind = 'rect' | 'line' | 'arrow';

export interface AnnotationPoint {
    readonly x: number;
    readonly y: number;
}

export interface RectShapeGeometry {
    readonly kind: 'rect';
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
}

export interface LinearShapeGeometry {
    readonly kind: 'line' | 'arrow';
    readonly start: AnnotationPoint;
    readonly end: AnnotationPoint;
}

export type ShapeGeometryInput = RectShapeGeometry | LinearShapeGeometry;

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

export type ShapeAnnotationPluginOptions = Partial<ShapeAnnotationConfiguration>;

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

export interface ShapeSessionOptions extends ShapeStyleInput {
    readonly kind: ShapeAnnotationKind;
    readonly name?: string;
    readonly metadata?: AnnotationMetadata;
    readonly hidden?: boolean;
    readonly locked?: boolean;
    readonly select?: boolean;
}

export interface ShapeAnnotationDefinition extends ShapeStyleInput {
    readonly geometry: ShapeGeometryInput;
    readonly name?: string;
    readonly metadata?: AnnotationMetadata;
    readonly hidden?: boolean;
    readonly locked?: boolean;
    readonly select?: boolean;
}

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

export interface ShapeSessionState {
    readonly kind: ShapeAnnotationKind;
    readonly geometry: ShapeGeometryInput | null;
}

export interface ShapeAnnotationPluginApi {
    enter(options: ShapeSessionOptions): Promise<void>;
    updatePreview(geometry: ShapeGeometryInput): Promise<void>;
    commit(): Promise<AnnotationId>;
    cancel(): Promise<void>;
    create(definition: ShapeAnnotationDefinition): Promise<AnnotationId>;
    update(id: AnnotationId, patch: ShapeAnnotationUpdate): Promise<void>;
    configure(patch: Partial<ShapeAnnotationConfiguration>): Promise<void>;
    getConfiguration(): Readonly<ShapeAnnotationConfiguration>;
    getSession(): ShapeSessionState | null;
}
