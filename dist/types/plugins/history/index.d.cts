import type { CoreEventMap } from '../../core-runtime/public-types.js';
import { type SynchronousEditorPlugin } from '../../plugin-kernel/index.js';
import { type HistoryPluginOptions, type HistoryPort } from './history-controller.js';
export declare const HISTORY_CAPABILITY: import("../../plugin-kernel/capability-token.js").CapabilityToken<HistoryPort>;
export declare const historyPluginRef: import("../../plugin-kernel/plugin-ref.js").PluginRef<HistoryPort>;
export declare function historyPlugin(options?: HistoryPluginOptions): SynchronousEditorPlugin<HistoryPort, CoreEventMap>;
export type { HistoryAvailability, HistoryPluginOptions, HistoryPort, } from './history-controller.js';
export type { CoreHistoryRecord as HistoryRecord } from '../../core-runtime/history-commit-router.js';
