import { CORE_HOST_CAPABILITY, CORE_STATE_CAPABILITY, } from '../../core-runtime/internal-capabilities.js';
import { OVERLAY_CAPABILITY } from '../../foundations/overlay/index.js';
import { definePluginRef, } from '../../plugin-kernel/index.js';
import { MaskPluginController, resolveMaskPluginOptions, } from './mask-controller.js';
export const maskPluginRef = definePluginRef('@bensitu/mask', '1.0.0');
export function maskPlugin(options = {}) {
    const resolved = resolveMaskPluginOptions(options);
    let controller = null;
    return Object.freeze({
        ref: maskPluginRef,
        version: '1.0.0',
        setupMode: 'sync',
        requires: [
            { token: CORE_HOST_CAPABILITY, range: '^1.0.0' },
            { token: CORE_STATE_CAPABILITY, range: '^1.0.0' },
            { token: OVERLAY_CAPABILITY, range: '^1.0.0' },
        ],
        setup(context) {
            const host = context.capabilities.require(CORE_HOST_CAPABILITY);
            const state = context.capabilities.require(CORE_STATE_CAPABILITY);
            const overlay = context.capabilities.require(OVERLAY_CAPABILITY);
            for (const operationId of ['mask:create', 'mask:remove', 'mask:remove-all']) {
                context.operations.register({ id: operationId, mode: 'busy' });
            }
            controller = new MaskPluginController(host, state, overlay, {
                run: (operationId, body) => {
                    const token = context.operations.begin(operationId);
                    try {
                        return body();
                    }
                    finally {
                        const cleanup = token.dispose();
                        if (cleanup instanceof Promise) {
                            void cleanup.catch((error) => host.reportError(error, 'Mask operation cleanup failed.'));
                        }
                    }
                },
            }, resolved);
            return controller;
        },
        onInit() {
            controller === null || controller === void 0 ? void 0 : controller.attach();
        },
        onImageCleared() {
            controller === null || controller === void 0 ? void 0 : controller.resetForImage();
        },
        onDispose() {
            controller === null || controller === void 0 ? void 0 : controller.dispose();
            controller = null;
        },
    });
}
//# sourceMappingURL=index.js.map