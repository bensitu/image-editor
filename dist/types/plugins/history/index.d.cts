/**
 * Publishes the History Capability, Plugin factory, records, options, and API contracts.
 *
 * @module
 */
import type { CoreEventMap, CoreHistoryRecord } from '../../core/index.js';
import { type SynchronousEditorPlugin } from '../../sdk/index.js';
import { type HistoryPluginOptions, type HistoryPort } from './history-controller.js';
export declare const HISTORY_CAPABILITY: import("../../index.js").CapabilityToken<HistoryPort>;
export declare const historyPluginRef: import("../../index.js").PluginRef<HistoryPort>;
export declare function historyPlugin(options?: HistoryPluginOptions): SynchronousEditorPlugin<HistoryPort, CoreEventMap>;
export type { HistoryAvailability, HistoryDisableOptions, HistoryEnableOptions, HistoryPluginOptions, HistoryPort, HistoryStatus, } from './history-controller.js';
export type HistoryRecord = CoreHistoryRecord;
