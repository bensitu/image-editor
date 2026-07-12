import type { CoreEventMap } from '../../core-runtime/public-types.js';
import { type SynchronousEditorPlugin } from '../../plugin-kernel/index.js';
import type { OverlayFoundationApi } from './overlay-types.js';
export declare const OVERLAY_CAPABILITY: import("../../plugin-kernel/capability-token.js").CapabilityToken<OverlayFoundationApi>;
export declare const overlayFoundationRef: import("../../plugin-kernel/plugin-ref.js").PluginRef<OverlayFoundationApi>;
export declare function overlayFoundationPlugin(): SynchronousEditorPlugin<OverlayFoundationApi, CoreEventMap>;
export type { FlattenOptions, OverlayClassification, OverlayExportOptions, OverlayExportRenderer, OverlayFlattenPort, OverlayFoundationApi, OverlayGeometryPolicy, OverlayKindDefinition, OverlayPort, OverlayQuery, OverlaySelectionState, OverlaySerializer, OverlaySerializerContext, SerializedOverlayRecord, } from './overlay-types.js';
