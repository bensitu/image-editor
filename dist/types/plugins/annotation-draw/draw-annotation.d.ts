import type { AnnotationId } from '../../foundations/annotation/index.js';
export interface AnnotationPoint {
    readonly x: number;
    readonly y: number;
}
export type DrawSubMode = 'brush' | 'erase';
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
export interface EraserConfiguration {
    readonly radius: number;
    readonly previewStroke: string;
    readonly previewStrokeWidth: number;
    readonly previewFill: string;
    readonly interpolationSpacing: number;
    readonly maxPointCount: number;
}
export interface DrawConfiguration {
    readonly brush: Readonly<DrawBrushConfiguration>;
    readonly eraser: Readonly<EraserConfiguration>;
}
export interface DrawAnnotationPluginOptions {
    readonly brush?: Partial<DrawBrushConfiguration>;
    readonly eraser?: Partial<EraserConfiguration>;
}
export interface DrawEnterOptions {
    readonly subMode?: DrawSubMode;
}
export interface DrawSessionState {
    readonly subMode: DrawSubMode;
    readonly isStrokeActive: boolean;
    readonly pointCount: number;
}
export interface DrawAnnotationPluginApi {
    enter(options?: DrawEnterOptions): Promise<void>;
    setSubMode(mode: DrawSubMode): Promise<void>;
    beginStroke(point: AnnotationPoint): Promise<void>;
    appendStroke(point: AnnotationPoint): Promise<void>;
    endStroke(): Promise<AnnotationId | null>;
    cancelStroke(): Promise<void>;
    exit(): Promise<void>;
    configureBrush(patch: Partial<DrawBrushConfiguration>): Promise<void>;
    configureEraser(patch: Partial<EraserConfiguration>): Promise<void>;
    getConfiguration(): DrawConfiguration;
    getSession(): DrawSessionState | null;
}
