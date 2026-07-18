import type { CoreEventMap, CoreHistoryRecord } from '../../core/index.js';
import {
    CORE_DIAGNOSTICS_CAPABILITY,
    MEMENTO_HISTORY_CAPABILITY,
    createCapabilityToken,
    definePlugin,
    definePluginRef,
    type PluginSetupContext,
    type SynchronousEditorPlugin,
} from '../../sdk/index.js';
import {
    HistoryPluginController,
    type HistoryPluginOptions,
    type HistoryPort,
} from './history-controller.js';

export const HISTORY_CAPABILITY = createCapabilityToken<HistoryPort>('plugin.history', '1.0.0');
export const historyPluginRef = definePluginRef<HistoryPort>('@bensitu/history', '1.0.0');

export function historyPlugin(
    options: HistoryPluginOptions = {},
): SynchronousEditorPlugin<HistoryPort, CoreEventMap> {
    let controller: HistoryPluginController | null = null;
    return definePlugin({
        ref: historyPluginRef,
        manifest: {
            id: historyPluginRef.id,
            version: '1.0.0',
            apiVersion: historyPluginRef.apiVersion,
            engine: '^3.0.0',
            requires: [
                { token: CORE_DIAGNOSTICS_CAPABILITY, range: '^1.0.0' },
                { token: MEMENTO_HISTORY_CAPABILITY, range: '^1.0.0' },
            ],
        },
        setupMode: 'sync',
        setup(context: PluginSetupContext<CoreEventMap>) {
            const diagnostics = context.capabilities.require(CORE_DIAGNOSTICS_CAPABILITY);
            const state = context.capabilities.require(MEMENTO_HISTORY_CAPABILITY);
            context.operations.register({
                id: 'history:undo',
                mode: 'mutation',
                conflictDomains: [
                    'document',
                    'base-image',
                    'geometry',
                    'raster',
                    'overlay',
                    'state',
                ],
                reentrancy: 'queue',
            });
            context.operations.register({
                id: 'history:redo',
                mode: 'mutation',
                conflictDomains: [
                    'document',
                    'base-image',
                    'geometry',
                    'raster',
                    'overlay',
                    'state',
                ],
                reentrancy: 'queue',
            });
            for (const operationId of ['history:enable', 'history:disable']) {
                context.operations.register({
                    id: operationId,
                    mode: 'mutation',
                    conflictDomains: [
                        'document',
                        'base-image',
                        'geometry',
                        'raster',
                        'overlay',
                        'state',
                    ],
                    reentrancy: 'queue',
                });
            }
            controller = new HistoryPluginController(
                state,
                {
                    run: (operationId, body) =>
                        context.operations.run(operationId, null, () => body()),
                },
                options,
                (error, message) => diagnostics.reportWarning(error, message),
            );
            context.disposables.add(
                state.registerHistoryProvider(historyPluginRef.id, {
                    isAvailable: () => controller?.isEnabled ?? false,
                    commit: (record) => controller?.commit(record),
                }),
            );
            context.capabilities.provide(HISTORY_CAPABILITY, controller, {
                version: HISTORY_CAPABILITY.version,
            });
            return controller;
        },
        onDispose() {
            controller?.dispose();
            controller = null;
        },
    });
}

export type {
    HistoryAvailability,
    HistoryDisableOptions,
    HistoryEnableOptions,
    HistoryPluginOptions,
    HistoryPort,
    HistoryStatus,
} from './history-controller.js';
export type HistoryRecord = CoreHistoryRecord;
