import { OVERLAY_CAPABILITY } from '../../foundations/overlay/index.js';
import { BASE_IMAGE_READ_CAPABILITY, CANVAS_READ_CAPABILITY, definePlugin, definePluginRef, } from '../../sdk/index.js';
import { OverlayStateController } from './overlay-state-controller.js';
import { resolveOverlayStateLimits } from './overlay-state-validation.js';
export const overlayStatePluginRef = definePluginRef('plugin:overlay-state', '1.0.0');
export function overlayStatePlugin(options = {}) {
    const limits = resolveOverlayStateLimits(options.limits);
    let controller = null;
    return definePlugin({
        ref: overlayStatePluginRef,
        manifest: {
            id: overlayStatePluginRef.id,
            version: '1.0.0',
            apiVersion: overlayStatePluginRef.apiVersion,
            engine: '^3.0.0',
            requires: [
                { token: OVERLAY_CAPABILITY, range: '^1.0.0' },
                { token: BASE_IMAGE_READ_CAPABILITY, range: '^1.0.0' },
                { token: CANVAS_READ_CAPABILITY, range: '^1.0.0' },
            ],
            permissions: ['fabric:canvas-read'],
        },
        setupMode: 'sync',
        setup(context) {
            const overlay = context.capabilities.require(OVERLAY_CAPABILITY);
            const baseImage = context.capabilities.require(BASE_IMAGE_READ_CAPABILITY);
            const canvas = context.capabilities.require(CANVAS_READ_CAPABILITY);
            context.operations.register({
                id: 'overlay-state:import',
                mode: 'mutation',
                conflictDomains: ['document', 'overlay', 'selection', 'state'],
                reentrancy: 'queue',
            });
            controller = new OverlayStateController(overlay, baseImage, canvas, limits);
            return controller;
        },
        onDispose() {
            controller === null || controller === void 0 ? void 0 : controller.dispose();
            controller = null;
        },
    });
}
export { OVERLAY_STATE_COORDINATE_SPACE, OVERLAY_STATE_SCHEMA, OVERLAY_STATE_WIRE_VERSION, } from './overlay-state-types.js';
export { OverlayStateCodecError, OverlayStateIdConflictError, OverlayStateImageMissingError, OverlayStatePluginDisposedError, OverlayStateValidationError, } from './overlay-state-errors.js';
export { DEFAULT_OVERLAY_STATE_LIMITS } from './overlay-state-validation.js';
//# sourceMappingURL=index.js.map