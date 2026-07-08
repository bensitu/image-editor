/**
 * Public non-destructive overlay persistence types.
 *
 * The wire format is intentionally renderer-independent. It stores editable
 * overlay geometry in original-image normalized coordinates and never exposes
 * Fabric.js JSON as public overlay state.
 *
 * @module
 */
export interface ExportOverlayStateOptions {
    includeHidden?: boolean;
    includeLocked?: boolean;
    includeMetadata?: boolean;
}
export interface OverlayValidationOptions {
    maxOverlays?: number;
    maxPolygonPoints?: number;
    maxDrawStrokes?: number;
    maxDrawPointsPerStroke?: number;
    maxDrawTotalPoints?: number;
    maxTextLength?: number;
    maxMetadataDepth?: number;
    maxMetadataBytes?: number;
}
export interface ImportOverlayStateOptions extends OverlayValidationOptions {
    mode?: 'replace' | 'append';
    idStrategy?: 'preserve' | 'regenerate';
    saveHistory?: boolean;
    preserveSelection?: boolean;
}
export interface ImportOverlayStateResult {
    importedOverlays: number;
    importedMasks: number;
    importedAnnotations: number;
    skippedOverlays: number;
    regeneratedIds: Array<{
        originalId: string;
        newId: string;
    }>;
    warnings: OverlayImportWarning[];
}
export interface OverlayValidationResult {
    valid: boolean;
    state?: OverlayState;
    errors: OverlayValidationError[];
    warnings: OverlayImportWarning[];
}
export interface OverlayValidationError {
    code: string;
    path: string;
    message: string;
}
export interface OverlayImportWarning {
    code: string;
    path?: string;
    message: string;
    details?: Record<string, unknown>;
}
export interface OverlayMigrationResult {
    state?: OverlayState;
    errors: OverlayValidationError[];
    warnings: OverlayImportWarning[];
}
export interface OverlayState {
    schema: 'image-editor.overlay-state';
    version: 1;
    image: OverlayImageInfo;
    coordinateSpace: 'image-normalized';
    baseImageTransform?: OverlayBaseImageTransform;
    overlays: SerializedOverlay[];
    metadata?: OverlayMetadata;
}
export interface OverlayImageInfo {
    naturalWidth: number;
    naturalHeight: number;
    mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
    orientation?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    sourceId?: string;
    checksum?: string;
}
export interface OverlayBaseImageTransform {
    rotation?: number;
    flipX?: boolean;
    flipY?: boolean;
}
export type OverlayMetadata = {
    [namespace: string]: Record<string, unknown>;
};
export type SerializedOverlay = SerializedMaskOverlay | SerializedTextAnnotationOverlay | SerializedShapeAnnotationOverlay | SerializedDrawAnnotationOverlay | SerializedCustomOverlay;
export interface SerializedOverlayBase {
    kind: 'mask' | 'annotation' | 'custom';
    id: string;
    overlayVersion?: number;
    hidden?: boolean;
    metadata?: OverlayMetadata;
}
export interface SerializedMaskOverlay extends SerializedOverlayBase {
    kind: 'mask';
    maskShape: 'rect' | 'circle' | 'ellipse' | 'polygon';
    geometry: SerializedMaskGeometry;
    style: SerializedMaskStyle;
}
export type SerializedMaskGeometry = SerializedRectMaskGeometry | SerializedCircleMaskGeometry | SerializedEllipseMaskGeometry | SerializedPolygonMaskGeometry;
export interface SerializedRectMaskGeometry {
    type: 'rect';
    x: number;
    y: number;
    width: number;
    height: number;
    rx?: number;
    ry?: number;
    angle?: number;
}
export interface SerializedCircleMaskGeometry {
    type: 'circle';
    cx: number;
    cy: number;
    radius: number;
    angle?: number;
}
export interface SerializedEllipseMaskGeometry {
    type: 'ellipse';
    cx: number;
    cy: number;
    rx: number;
    ry: number;
    angle?: number;
}
export interface SerializedPolygonMaskGeometry {
    type: 'polygon';
    points: Array<{
        x: number;
        y: number;
    }>;
    angle?: number;
}
export interface SerializedMaskStyle {
    fill: `#${string}`;
    alpha: number;
    stroke?: `#${string}` | null;
    strokeWidth?: number;
    strokeDashArray?: number[] | null;
    selectable?: boolean;
    evented?: boolean;
    hasControls?: boolean;
}
export interface SerializedTextAnnotationOverlay extends SerializedOverlayBase {
    kind: 'annotation';
    annotationType: 'text';
    geometry: SerializedTextGeometry;
    text: SerializedTextContent;
    style: SerializedTextStyle;
    locked?: boolean;
}
export interface SerializedTextGeometry {
    x: number;
    y: number;
    width?: number;
    angle?: number;
}
export interface SerializedTextContent {
    value: string;
}
export interface SerializedTextStyle {
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string | number;
    fill?: `#${string}`;
    backgroundColor?: `#${string}`;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    lineHeight?: number;
}
export interface SerializedShapeAnnotationOverlay extends SerializedOverlayBase {
    kind: 'annotation';
    annotationType: 'shape';
    shape: 'rect' | 'line' | 'arrow';
    geometry: SerializedShapeGeometry;
    style: SerializedShapeStyle;
    locked?: boolean;
}
export type SerializedShapeGeometry = SerializedShapeRectGeometry | SerializedShapeLineGeometry | SerializedShapeArrowGeometry;
export interface SerializedShapeRectGeometry {
    type: 'rect';
    x: number;
    y: number;
    width: number;
    height: number;
    angle?: number;
}
export interface SerializedShapeLineGeometry {
    type: 'line';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    angle?: number;
}
export interface SerializedShapeArrowGeometry {
    type: 'arrow';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    arrowHeadLength?: number;
    angle?: number;
}
export interface SerializedShapeStyle {
    stroke?: `#${string}`;
    strokeWidth?: number;
    fill?: `#${string}`;
    opacity?: number;
    strokeDashArray?: number[] | null;
    selectable?: boolean;
    evented?: boolean;
}
export interface SerializedDrawAnnotationOverlay extends SerializedOverlayBase {
    kind: 'annotation';
    annotationType: 'draw';
    strokes: SerializedDrawStroke[];
    locked?: boolean;
}
export interface SerializedDrawStroke {
    id?: string;
    points: SerializedDrawPoint[];
    brush: SerializedDrawBrush;
}
export interface SerializedDrawPoint {
    x: number;
    y: number;
    pressure?: number;
    t?: number;
}
export interface SerializedDrawBrush {
    color: `#${string}`;
    width: number;
    opacity?: number;
    lineCap?: CanvasLineCap;
    lineJoin?: CanvasLineJoin;
}
export interface SerializedCustomOverlay extends SerializedOverlayBase {
    kind: 'custom';
    customType: string;
    data: Record<string, unknown>;
}
export interface OverlayImportContext {
    state: OverlayState;
}
export interface OverlayExportContext {
    image: OverlayImageInfo;
}
export interface OverlaySerializerRegistryEntry<TData = unknown> {
    validate(data: unknown): TData;
    import(data: TData, context: OverlayImportContext): Promise<void> | void;
    export?(object: unknown, context: OverlayExportContext): SerializedCustomOverlay | null;
}
