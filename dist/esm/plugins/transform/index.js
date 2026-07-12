import { CORE_HOST_CAPABILITY, CORE_STATE_CAPABILITY, GEOMETRY_CAPABILITY, } from '../../core-runtime/internal-capabilities.js';
import { definePluginRef, } from '../../plugin-kernel/index.js';
import { TransformPluginController, resolveTransformOptions, } from './transform-controller.js';
export const transformPluginRef = definePluginRef('@bensitu/transform', '1.0.0');
function isTransformState(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const candidate = value;
    return (typeof candidate.scale === 'number' &&
        Number.isFinite(candidate.scale) &&
        candidate.scale > 0 &&
        typeof candidate.rotationDegrees === 'number' &&
        Number.isFinite(candidate.rotationDegrees) &&
        typeof candidate.flipX === 'boolean' &&
        typeof candidate.flipY === 'boolean');
}
export function transformPlugin(options = {}) {
    const resolved = resolveTransformOptions(options);
    let controller = null;
    return Object.freeze({
        ref: transformPluginRef,
        version: '1.0.0',
        setupMode: 'sync',
        requires: [
            { token: CORE_HOST_CAPABILITY, range: '^1.0.0' },
            { token: CORE_STATE_CAPABILITY, range: '^1.0.0' },
            { token: GEOMETRY_CAPABILITY, range: '^1.0.0' },
        ],
        setup(context) {
            const host = context.capabilities.require(CORE_HOST_CAPABILITY);
            const state = context.capabilities.require(CORE_STATE_CAPABILITY);
            const geometry = context.capabilities.require(GEOMETRY_CAPABILITY);
            controller = new TransformPluginController(host, geometry, resolved);
            for (const [id, mode] of [
                ['transform:scale', 'animation'],
                ['transform:zoom-in', 'animation'],
                ['transform:zoom-out', 'animation'],
                ['transform:rotate', 'animation'],
                ['transform:flip-horizontal', 'busy'],
                ['transform:flip-vertical', 'busy'],
                ['transform:reset', 'animation'],
            ]) {
                context.operations.register({ id, mode });
            }
            context.addDisposable(state.slices.register({
                id: transformPluginRef.id,
                version: 1,
                capture: () => {
                    var _a;
                    return (_a = controller === null || controller === void 0 ? void 0 : controller.getState()) !== null && _a !== void 0 ? _a : {
                        scale: 1,
                        rotationDegrees: 0,
                        flipX: false,
                        flipY: false,
                    };
                },
                validate: (value) => isTransformState(value)
                    ? { valid: true, value }
                    : { valid: false, message: 'Transform state is malformed.' },
                restore: (value) => controller === null || controller === void 0 ? void 0 : controller.restoreState(value),
                clearState: () => controller === null || controller === void 0 ? void 0 : controller.resetStateFromImage(),
            }));
            const requireController = () => {
                if (!controller)
                    throw new Error('Transform plugin is not installed.');
                return controller;
            };
            return Object.freeze({
                scale: (factor) => requireController().scale(factor),
                zoomIn: () => requireController().zoomIn(),
                zoomOut: () => requireController().zoomOut(),
                rotate: (degrees) => requireController().rotate(degrees),
                flipHorizontal: () => requireController().flipHorizontal(),
                flipVertical: () => requireController().flipVertical(),
                resetImageTransform: () => requireController().resetImageTransform(),
                reset: () => requireController().resetImageTransform(),
                getState: () => requireController().getState(),
                synchronizeCompatibilityState: (state) => requireController().restoreState(state),
            });
        },
        onImageLoaded() {
            controller === null || controller === void 0 ? void 0 : controller.resetStateFromImage();
        },
        onImageCleared() {
            controller === null || controller === void 0 ? void 0 : controller.resetStateFromImage();
        },
        onDispose() {
            controller === null || controller === void 0 ? void 0 : controller.dispose();
            controller = null;
        },
    });
}
//# sourceMappingURL=index.js.map