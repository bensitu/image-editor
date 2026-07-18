import type { CoreEventMap } from '../../core/index.js';
import { type SynchronousEditorPlugin } from '../../sdk/index.js';
import type { ShapeAnnotationPluginApi, ShapeAnnotationPluginOptions } from './shape-annotation.js';
export declare const shapeAnnotationPluginRef: import("../../index.js").PluginRef<ShapeAnnotationPluginApi>;
export declare function shapeAnnotationPlugin(options?: ShapeAnnotationPluginOptions): SynchronousEditorPlugin<ShapeAnnotationPluginApi, CoreEventMap>;
export type { AnnotationPoint, LinearShapeGeometry, RectShapeGeometry, ShapeAnnotationConfiguration, ShapeAnnotationDefinition, ShapeAnnotationKind, ShapeAnnotationPluginApi, ShapeAnnotationPluginOptions, ShapeAnnotationUpdate, ShapeGeometryInput, ShapeSessionOptions, ShapeSessionState, ShapeStyleInput, } from './shape-annotation.js';
