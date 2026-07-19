import { OVERLAY_CAPABILITY } from '../../foundations/overlay/index.js';
import { BASE_IMAGE_READ_CAPABILITY, CANVAS_READ_CAPABILITY, CORE_DIAGNOSTICS_CAPABILITY, CORE_STATUS_CAPABILITY, FABRIC_RUNTIME_CAPABILITY, GEOMETRY_MUTATION_CAPABILITY, IMAGE_RESOURCE_POLICY_CAPABILITY, RASTER_MUTATION_CAPABILITY, RENDER_REQUEST_CAPABILITY, SNAPSHOT_REGISTRATION_CAPABILITY, VISIBLE_RASTER_BAKE_CAPABILITY, definePlugin, definePluginRef, } from '../../sdk/index.js';
import { CropController, resolveCropConfiguration } from './crop-controller.js';
const CROP_TOOL_ID = 'plugin:crop';
const cropPreviewDomains = ['base-image', 'overlay', 'selection', 'state'];
const cropMutationDomains = [
    'document',
    'base-image',
    'geometry',
    'raster',
    'overlay',
    'selection',
    'state',
];
export const cropPluginRef = definePluginRef('plugin:crop', '1.0.0');
export function cropPlugin(options = {}) {
    const configuration = resolveCropConfiguration(options);
    let controller = null;
    return definePlugin({
        ref: cropPluginRef,
        manifest: {
            id: cropPluginRef.id,
            version: '1.0.0',
            apiVersion: cropPluginRef.apiVersion,
            engine: '^3.0.0',
            requires: [
                { token: CORE_STATUS_CAPABILITY, range: '^1.0.0' },
                { token: CORE_DIAGNOSTICS_CAPABILITY, range: '^1.0.0' },
                { token: FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' },
                { token: CANVAS_READ_CAPABILITY, range: '^1.0.0' },
                { token: BASE_IMAGE_READ_CAPABILITY, range: '^1.0.0' },
                { token: IMAGE_RESOURCE_POLICY_CAPABILITY, range: '^1.0.0' },
                { token: RENDER_REQUEST_CAPABILITY, range: '^1.0.0' },
                { token: RASTER_MUTATION_CAPABILITY, range: '^1.0.0' },
                { token: SNAPSHOT_REGISTRATION_CAPABILITY, range: '^1.0.0' },
                { token: GEOMETRY_MUTATION_CAPABILITY, range: '^1.0.0' },
            ],
            optional: [
                { token: OVERLAY_CAPABILITY, range: '^1.0.0' },
                { token: VISIBLE_RASTER_BAKE_CAPABILITY, range: '^1.0.0' },
            ],
            permissions: [
                'fabric:objects',
                'fabric:canvas-read',
                'core:raster-mutation',
                'core:geometry-participant',
            ],
        },
        setupMode: 'sync',
        setup(context) {
            const status = context.capabilities.require(CORE_STATUS_CAPABILITY);
            const diagnostics = context.capabilities.require(CORE_DIAGNOSTICS_CAPABILITY);
            const fabricRuntime = context.capabilities.require(FABRIC_RUNTIME_CAPABILITY);
            const canvas = context.capabilities.require(CANVAS_READ_CAPABILITY);
            const baseImage = context.capabilities.require(BASE_IMAGE_READ_CAPABILITY);
            const resourcePolicy = context.capabilities.require(IMAGE_RESOURCE_POLICY_CAPABILITY);
            const render = context.capabilities.require(RENDER_REQUEST_CAPABILITY);
            const raster = context.capabilities.require(RASTER_MUTATION_CAPABILITY);
            const snapshots = context.capabilities.require(SNAPSHOT_REGISTRATION_CAPABILITY);
            const geometry = context.capabilities.require(GEOMETRY_MUTATION_CAPABILITY);
            const overlay = context.capabilities.optional(OVERLAY_CAPABILITY);
            const visibleRasterBake = context.capabilities.optional(VISIBLE_RASTER_BAKE_CAPABILITY);
            controller = new CropController(Object.freeze({
                ...status,
                ...diagnostics,
                ...fabricRuntime,
                ...canvas,
                ...baseImage,
                ...resourcePolicy,
                ...render,
            }), geometry, raster, overlay, visibleRasterBake, context.capabilities.getOptionalStatus(VISIBLE_RASTER_BAKE_CAPABILITY), configuration);
            const requireController = () => {
                if (!controller)
                    throw new Error('Crop Plugin is not installed.');
                return controller;
            };
            for (const operationId of [
                'crop:enter',
                'crop:update-rect',
                'crop:set-aspect-ratio',
                'crop:cancel',
            ]) {
                context.disposables.add(context.operations.register({
                    id: operationId,
                    mode: 'busy',
                    conflictDomains: cropPreviewDomains,
                    reentrancy: 'queue',
                }));
            }
            context.disposables.add(context.operations.register({
                id: 'crop:apply',
                mode: 'mutation',
                conflictDomains: cropMutationDomains,
                reentrancy: 'queue',
            }));
            context.disposables.add(context.tools.register({
                id: CROP_TOOL_ID,
                enter: () => undefined,
                exit: () => {
                    if (controller === null || controller === void 0 ? void 0 : controller.isActive)
                        controller.cancel();
                },
                canRunOperation: (operationId) => operationId.startsWith('crop:') ||
                    operationId === 'mosaic:enter' ||
                    operationId === 'core:load-image' ||
                    operationId === 'core:commit-load-image' ||
                    operationId === 'core:load-state' ||
                    operationId === 'core:export',
            }));
            context.disposables.add(snapshots.registerTransientObject(cropPluginRef.id, (object) => { var _a; return (_a = controller === null || controller === void 0 ? void 0 : controller.ownsPreview(object)) !== null && _a !== void 0 ? _a : false; }));
            const runPreviewOperation = (operationId, value, task) => context.operations.run(operationId, value, (args) => task(requireController(), args));
            return Object.freeze({
                get isActive() {
                    return requireController().isActive;
                },
                enter: (enterOptions) => runPreviewOperation('crop:enter', enterOptions !== null && enterOptions !== void 0 ? enterOptions : {}, async (crop, value) => {
                    if (crop.isActive) {
                        crop.enter(value);
                        return;
                    }
                    await context.tools.enter(CROP_TOOL_ID);
                    try {
                        crop.enter(value);
                    }
                    catch (error) {
                        await context.tools.exit('operation');
                        throw error;
                    }
                }),
                updateRect: (rect) => runPreviewOperation('crop:update-rect', rect, (crop, value) => crop.updateRect(value)),
                setAspectRatio: (ratio) => runPreviewOperation('crop:set-aspect-ratio', ratio, (crop, value) => crop.setAspectRatio(value)),
                apply: async (applyOptions) => {
                    try {
                        await requireController().apply(applyOptions);
                    }
                    finally {
                        if (context.tools.getActiveToolId() === CROP_TOOL_ID) {
                            await context.tools.exit('operation');
                        }
                    }
                },
                cancel: () => runPreviewOperation('crop:cancel', undefined, async (crop) => {
                    crop.cancel();
                    if (context.tools.getActiveToolId() === CROP_TOOL_ID) {
                        await context.tools.exit('requested');
                    }
                }),
                getSession: () => requireController().getSession(),
                subscribe: (listener) => requireController().subscribe(listener),
            });
        },
        onImageCleared(context) {
            if (context.tools.getActiveToolId() === CROP_TOOL_ID) {
                return context.tools.exit('operation');
            }
            controller === null || controller === void 0 ? void 0 : controller.closeForImage();
            return undefined;
        },
        onDispose() {
            controller === null || controller === void 0 ? void 0 : controller.dispose();
            controller = null;
        },
    });
}
export { CropError, CropIntegrationError, CropSessionError, CropValidationError, } from './crop-errors.js';
//# sourceMappingURL=index.js.map