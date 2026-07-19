/**
 * Publishes the Crop Plugin factory, errors, geometry, session, and API contracts.
 *
 * @module
 */
import type { CoreEventMap } from '../../core/index.js';
import { type SynchronousEditorPlugin } from '../../sdk/index.js';
import type { CropPluginApi, CropPluginOptions } from './crop-session.js';
export declare const cropPluginRef: import("../../index.js").PluginRef<CropPluginApi>;
export declare function cropPlugin(options?: CropPluginOptions): SynchronousEditorPlugin<CropPluginApi, CoreEventMap>;
export type { CropApplyOptions, CropConfiguration, CropEnterOptions, CropOverlayApplyPolicy, CropOverlayPolicy, CropOverlayPreviewPolicy, CropPluginApi, CropPluginOptions, CropSessionState, CropStatus, CropStatusListener, } from './crop-session.js';
export type { CropAspectRatio, CropRect } from './crop-geometry.js';
export { CropError, CropIntegrationError, CropSessionError, CropValidationError, } from './crop-errors.js';
