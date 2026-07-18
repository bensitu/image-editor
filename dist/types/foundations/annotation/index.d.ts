import type { CoreEventMap } from '../../core/index.js';
import { type SynchronousEditorPlugin } from '../../sdk/index.js';
import type { AnnotationAuthoringPort, AnnotationFoundationOptions, AnnotationPluginApi } from './annotation-definition.js';
export declare const ANNOTATION_CAPABILITY: import("../../index.js").CapabilityToken<AnnotationPluginApi>;
export declare const ANNOTATION_AUTHORING_CAPABILITY: import("../../index.js").CapabilityToken<AnnotationAuthoringPort>;
export declare const annotationFoundationRef: import("../../index.js").PluginRef<AnnotationPluginApi>;
export declare function annotationFoundationPlugin(options?: AnnotationFoundationOptions): SynchronousEditorPlugin<AnnotationPluginApi, CoreEventMap>;
export type { AnnotationAuthoringPort, AnnotationCreateRequest, AnnotationDescriptor, AnnotationFeatureCodec, AnnotationFeatureDefinition, AnnotationFeatureRemoveRequest, AnnotationFeatureUpdateRequest, AnnotationFlattenOptions, AnnotationFoundationOptions, AnnotationId, AnnotationMetadata, AnnotationMetadataObject, AnnotationMetadataValue, AnnotationPluginApi, AnnotationPreviewRequest, AnnotationQuery, AnnotationStatus, AnnotationStatusListener, AnnotationUpdate, } from './annotation-definition.js';
export { AnnotationError, AnnotationNotFoundError, AnnotationValidationError, } from './annotation-errors.js';
