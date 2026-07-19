/**
 * Publishes the Overlay State Plugin factory, wire contracts, validation limits, and errors.
 *
 * @module
 */
import type { CoreEventMap } from '../../core/index.js';
import { type SynchronousEditorPlugin } from '../../sdk/index.js';
import type { OverlayStatePluginApi, OverlayStatePluginOptions } from './overlay-state-types.js';
export declare const overlayStatePluginRef: import("../../index.js").PluginRef<OverlayStatePluginApi>;
export declare function overlayStatePlugin(options?: OverlayStatePluginOptions): SynchronousEditorPlugin<OverlayStatePluginApi, CoreEventMap>;
export { OVERLAY_STATE_COORDINATE_SPACE, OVERLAY_STATE_SCHEMA, OVERLAY_STATE_WIRE_VERSION, } from './overlay-state-types.js';
export type { OverlayStateCodecReference, OverlayStateDocument, OverlayStateExportOptions, OverlayStateImageReference, OverlayStateImportOptions, OverlayStateImportResult, OverlayStateItem, OverlayStateLimits, OverlayStateMigrationOptions, OverlayStateMissingKindPolicy, OverlayStatePluginApi, OverlayStatePluginOptions, OverlayStateValidationIssue, OverlayStateValidationOptions, OverlayStateValidationResult, } from './overlay-state-types.js';
export { OverlayStateCodecError, OverlayStateIdConflictError, OverlayStateImageMissingError, OverlayStatePluginDisposedError, OverlayStateValidationError, } from './overlay-state-errors.js';
export { DEFAULT_OVERLAY_STATE_LIMITS } from './overlay-state-validation.js';
