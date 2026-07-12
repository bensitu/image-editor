import { CORE_HOST_CAPABILITY, CORE_STATE_CAPABILITY, } from '../../core-runtime/internal-capabilities.js';
import { createCapabilityToken, definePluginRef, } from '../../plugin-kernel/index.js';
import { HistoryPluginController, } from './history-controller.js';
export const HISTORY_CAPABILITY = createCapabilityToken('plugin.history', '1.0.0');
export const historyPluginRef = definePluginRef('@bensitu/history', '1.0.0');
export function historyPlugin(options = {}) {
    let controller = null;
    return Object.freeze({
        ref: historyPluginRef,
        version: '1.0.0',
        setupMode: 'sync',
        requires: [
            { token: CORE_HOST_CAPABILITY, range: '^1.0.0' },
            { token: CORE_STATE_CAPABILITY, range: '^1.0.0' },
        ],
        setup(context) {
            const host = context.capabilities.require(CORE_HOST_CAPABILITY);
            const state = context.capabilities.require(CORE_STATE_CAPABILITY);
            context.operations.register({ id: 'history:undo', mode: 'busy' });
            context.operations.register({ id: 'history:redo', mode: 'busy' });
            controller = new HistoryPluginController(state, {
                run: async (operationId, body) => {
                    const token = context.operations.begin(operationId);
                    try {
                        await body();
                    }
                    finally {
                        await token.dispose();
                    }
                },
            }, options, (error, message) => host.reportWarning(error, message));
            context.addDisposable(state.registerHistoryProvider(historyPluginRef.id, controller));
            context.capabilities.provide(HISTORY_CAPABILITY, controller);
            return controller;
        },
        onImageLoaded() {
            controller === null || controller === void 0 ? void 0 : controller.clear();
        },
        onDispose() {
            controller === null || controller === void 0 ? void 0 : controller.dispose();
            controller = null;
        },
    });
}
//# sourceMappingURL=index.js.map