import { BASE_IMAGE_READ_CAPABILITY, CORE_STATUS_CAPABILITY, FABRIC_RUNTIME_CAPABILITY, GEOMETRY_MUTATION_CAPABILITY, RENDER_REQUEST_CAPABILITY, SNAPSHOT_REGISTRATION_CAPABILITY, definePlugin, definePluginRef, } from '../../sdk/index.js';
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
    return definePlugin({
        ref: transformPluginRef,
        manifest: {
            id: transformPluginRef.id,
            version: '1.0.0',
            apiVersion: transformPluginRef.apiVersion,
            engine: '^3.0.0',
            requires: [
                { token: CORE_STATUS_CAPABILITY, range: '^1.0.0' },
                { token: FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' },
                { token: BASE_IMAGE_READ_CAPABILITY, range: '^1.0.0' },
                { token: RENDER_REQUEST_CAPABILITY, range: '^1.0.0' },
                { token: SNAPSHOT_REGISTRATION_CAPABILITY, range: '^1.0.0' },
                { token: GEOMETRY_MUTATION_CAPABILITY, range: '^1.0.0' },
            ],
            permissions: ['fabric:objects', 'core:geometry-participant'],
        },
        setupMode: 'sync',
        setup(context) {
            const status = context.capabilities.require(CORE_STATUS_CAPABILITY);
            const fabricRuntime = context.capabilities.require(FABRIC_RUNTIME_CAPABILITY);
            const baseImage = context.capabilities.require(BASE_IMAGE_READ_CAPABILITY);
            const render = context.capabilities.require(RENDER_REQUEST_CAPABILITY);
            const state = context.capabilities.require(SNAPSHOT_REGISTRATION_CAPABILITY);
            const geometry = context.capabilities.require(GEOMETRY_MUTATION_CAPABILITY);
            controller = new TransformPluginController(Object.freeze({ ...status, ...fabricRuntime }), baseImage, render, geometry, resolved);
            for (const id of [
                'transform:scale',
                'transform:zoom-in',
                'transform:zoom-out',
                'transform:rotate',
                'transform:flip-horizontal',
                'transform:flip-vertical',
                'transform:reset',
            ]) {
                context.operations.register({
                    id,
                    mode: id.includes('flip') || id === 'transform:reset' ? 'mutation' : 'animation',
                    conflictDomains: ['document', 'base-image', 'geometry', 'overlay', 'state'],
                    reentrancy: 'queue',
                });
            }
            context.disposables.add(state.registerSlice({
                id: transformPluginRef.id,
                version: 1,
                capturePolicy: 'always',
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
                scale: (factor, mutationOptions) => requireController().scale(factor, mutationOptions),
                zoomIn: (mutationOptions) => requireController().zoomIn(mutationOptions),
                zoomOut: (mutationOptions) => requireController().zoomOut(mutationOptions),
                rotate: (degrees, mutationOptions) => requireController().rotate(degrees, mutationOptions),
                flipHorizontal: (mutationOptions) => requireController().flipHorizontal(mutationOptions),
                flipVertical: (mutationOptions) => requireController().flipVertical(mutationOptions),
                resetImageTransform: (mutationOptions) => requireController().resetImageTransform(mutationOptions),
                getState: () => requireController().getState(),
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