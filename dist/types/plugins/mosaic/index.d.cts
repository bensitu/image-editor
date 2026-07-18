import type { CoreEventMap } from '../../core/index.js';
import { type SynchronousEditorPlugin } from '../../sdk/index.js';
import type { MosaicPluginApi, MosaicPluginOptions } from './mosaic-session.js';
export declare const mosaicPluginRef: import("../../index.js").PluginRef<MosaicPluginApi>;
export declare function mosaicPlugin(options?: MosaicPluginOptions): SynchronousEditorPlugin<MosaicPluginApi, CoreEventMap>;
export type { MosaicCommitOptions, MosaicConfiguration, MosaicEnterOptions, MosaicOutputFormat, MosaicPluginApi, MosaicPluginOptions, MosaicSessionState, MosaicStatus, MosaicStatusListener, } from './mosaic-session.js';
export type { DirtyRectangle, MosaicImagePoint } from './mosaic-brush.js';
export { MosaicError, MosaicIntegrationError, MosaicSessionError, MosaicValidationError, } from './mosaic-errors.js';
