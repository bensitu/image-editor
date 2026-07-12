import {
    CORE_HOST_CAPABILITY,
    CORE_STATE_CAPABILITY,
} from '../../core-runtime/internal-capabilities.js';
import type { CoreEventMap } from '../../core-runtime/public-types.js';
import {
    createCapabilityToken,
    definePluginRef,
    type PluginSetupContext,
    type SynchronousEditorPlugin,
} from '../../plugin-kernel/index.js';
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
    return Object.freeze({
        ref: historyPluginRef,
        version: '1.0.0',
        setupMode: 'sync',
        requires: [
            { token: CORE_HOST_CAPABILITY, range: '^1.0.0' },
            { token: CORE_STATE_CAPABILITY, range: '^1.0.0' },
        ],
        setup(context: PluginSetupContext<CoreEventMap>) {
            const host = context.capabilities.require(CORE_HOST_CAPABILITY);
            const state = context.capabilities.require(CORE_STATE_CAPABILITY);
            context.operations.register({ id: 'history:undo', mode: 'busy' });
            context.operations.register({ id: 'history:redo', mode: 'busy' });
            controller = new HistoryPluginController(
                state,
                {
                    run: async (operationId, body) => {
                        const token = context.operations.begin(operationId);
                        try {
                            await body();
                        } finally {
                            await token.dispose();
                        }
                    },
                },
                options,
                (error, message) => host.reportWarning(error, message),
            );
            context.addDisposable(state.registerHistoryProvider(historyPluginRef.id, controller));
            context.capabilities.provide(HISTORY_CAPABILITY, controller);
            return controller;
        },
        onImageLoaded() {
            controller?.clear();
        },
        onDispose() {
            controller?.dispose();
            controller = null;
        },
    });
}

export type {
    HistoryAvailability,
    HistoryPluginOptions,
    HistoryPort,
} from './history-controller.js';
export type { CoreHistoryRecord as HistoryRecord } from '../../core-runtime/history-commit-router.js';
