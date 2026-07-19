/**
 * Publishes Overlay Foundation capabilities, Plugin factory, registration APIs, and public contracts.
 *
 * @module
 */
import type { CoreEventMap } from '../../core/index.js';
import { type SynchronousEditorPlugin } from '../../sdk/index.js';
import type { OverlayFoundationApi, OverlayRegistrationPort, OverlayRuntimeApi } from './overlay-types.js';
export declare const OVERLAY_CAPABILITY: import("../../index.js").CapabilityToken<OverlayRuntimeApi>;
export declare const OVERLAY_REGISTRATION_CAPABILITY: import("../../index.js").CapabilityToken<OverlayRegistrationPort>;
export declare const overlayFoundationRef: import("../../index.js").PluginRef<OverlayFoundationApi>;
export declare function overlayFoundationPlugin(): SynchronousEditorPlugin<OverlayFoundationApi, CoreEventMap>;
export type { FabricObjectCodec, FlattenOptions, OverlayClassification, OverlayExportOptions, OverlayExportRenderContext, OverlayExportRenderer, OverlayFlattenPort, OverlayFoundationApi, OverlayGeometryPolicy, OverlayInteractionContext, OverlayInteractionPolicy, OverlayKindDefinition, OverlayPort, OverlayPersistenceDefinition, OverlayRegistrationPort, OverlayRuntimeApi, OverlayMutationAction, OverlayMutationContext, OverlayMutationDescriptor, OverlayMutationPort, OverlayMutationRequest, OverlayQuery, OverlaySelectionState, OverlaySerializerContext, OverlayStateCodecContext, OverlayStateCodecValue, OverlayStateImageContext, OverlayStateKindAdapter, OverlayStateKindCodec, OverlayStatePoint, SerializedOverlayRecord, } from './overlay-types.js';
export { OverlayRecoverableObjectError } from './overlay-errors.js';
export { captureOverlayStateBounds, isOverlayStateBoundsGeometry, objectPointToCanvas, restoreOverlayStateBounds, type OverlayStateBoundsGeometry, } from './overlay-state-geometry.js';
