import { BASE_IMAGE_READ_CAPABILITY, CANVAS_READ_CAPABILITY, CORE_DIAGNOSTICS_CAPABILITY, CORE_PRESENTATION_CAPABILITY, DOCUMENT_MUTATION_CAPABILITY, EXPORT_CONTRIBUTION_CAPABILITY, FABRIC_RUNTIME_CAPABILITY, GEOMETRY_MUTATION_CAPABILITY, IMAGE_RESOURCE_POLICY_CAPABILITY, RASTER_MUTATION_CAPABILITY, RENDER_REQUEST_CAPABILITY, SNAPSHOT_REGISTRATION_CAPABILITY, createCapabilityToken, definePlugin, definePluginRef, } from '../../sdk/index.js';
import { OverlayFoundationController } from './overlay-foundation-controller.js';
export const OVERLAY_CAPABILITY = createCapabilityToken('foundation:overlay', '1.0.0');
export const OVERLAY_REGISTRATION_CAPABILITY = createCapabilityToken('foundation:overlay-registration', '1.0.0');
export const overlayFoundationRef = definePluginRef('foundation:overlay', '1.0.0');
function createRuntimeApi(controller) {
    const bind = (method) => method.bind(controller);
    const api = {
        list: bind(controller.list),
        getByPersistentId: bind(controller.getByPersistentId),
        classify: bind(controller.classify),
        getStateKind: bind(controller.getStateKind),
        flatten: bind(controller.flatten),
        mutate: bind(controller.mutate),
        add: bind(controller.add),
        addTransient: bind(controller.addTransient),
        replaceTransient: bind(controller.replaceTransient),
        remove: bind(controller.remove),
        removeTransient: bind(controller.removeTransient),
        cancelActiveGesture: bind(controller.cancelActiveGesture),
        waitForIdle: bind(controller.waitForIdle),
        getSelection: bind(controller.getSelection),
        select: bind(controller.select),
        discardSelection: bind(controller.discardSelection),
        onSelectionChange: bind(controller.onSelectionChange),
        hideForPreview: bind(controller.hideForPreview),
        setHidden: bind(controller.setHidden),
        setLocked: bind(controller.setLocked),
        bringForward: bind(controller.bringForward),
        sendBackward: bind(controller.sendBackward),
        bringToFront: bind(controller.bringToFront),
        sendToBack: bind(controller.sendToBack),
    };
    return Object.freeze(api);
}
function createRegistrationApi(controller) {
    const bind = (method) => method.bind(controller);
    const registration = {
        registerKind: bind(controller.registerKind),
        registerGeometryPolicy: bind(controller.registerGeometryPolicy),
        registerInteractionPolicy: bind(controller.registerInteractionPolicy),
        registerExportRenderer: bind(controller.registerExportRenderer),
    };
    return Object.freeze(registration);
}
export function overlayFoundationPlugin() {
    let controller = null;
    return definePlugin({
        ref: overlayFoundationRef,
        manifest: {
            id: overlayFoundationRef.id,
            version: '1.0.0',
            apiVersion: overlayFoundationRef.apiVersion,
            engine: '^3.0.0',
            requires: [
                { token: CORE_DIAGNOSTICS_CAPABILITY, range: '^1.0.0' },
                { token: CORE_PRESENTATION_CAPABILITY, range: '^1.0.0' },
                { token: FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' },
                { token: CANVAS_READ_CAPABILITY, range: '^1.0.0' },
                { token: BASE_IMAGE_READ_CAPABILITY, range: '^1.0.0' },
                { token: RENDER_REQUEST_CAPABILITY, range: '^1.0.0' },
                { token: RASTER_MUTATION_CAPABILITY, range: '^1.0.0' },
                { token: SNAPSHOT_REGISTRATION_CAPABILITY, range: '^1.0.0' },
                { token: GEOMETRY_MUTATION_CAPABILITY, range: '^1.0.0' },
                { token: IMAGE_RESOURCE_POLICY_CAPABILITY, range: '^1.0.0' },
                { token: EXPORT_CONTRIBUTION_CAPABILITY, range: '^1.0.0' },
                { token: DOCUMENT_MUTATION_CAPABILITY, range: '^1.0.0' },
            ],
            permissions: [
                'fabric:objects',
                'fabric:canvas-read',
                'core:raster-mutation',
                'core:geometry-participant',
                'core:export-contributor',
            ],
        },
        setupMode: 'sync',
        setup(context) {
            const diagnostics = context.capabilities.require(CORE_DIAGNOSTICS_CAPABILITY);
            const presentation = context.capabilities.require(CORE_PRESENTATION_CAPABILITY);
            const fabricRuntime = context.capabilities.require(FABRIC_RUNTIME_CAPABILITY);
            const canvas = context.capabilities.require(CANVAS_READ_CAPABILITY);
            const baseImage = context.capabilities.require(BASE_IMAGE_READ_CAPABILITY);
            const render = context.capabilities.require(RENDER_REQUEST_CAPABILITY);
            const raster = context.capabilities.require(RASTER_MUTATION_CAPABILITY);
            const state = context.capabilities.require(SNAPSHOT_REGISTRATION_CAPABILITY);
            const geometry = context.capabilities.require(GEOMETRY_MUTATION_CAPABILITY);
            const imageResources = context.capabilities.require(IMAGE_RESOURCE_POLICY_CAPABILITY);
            const exportPort = context.capabilities.require(EXPORT_CONTRIBUTION_CAPABILITY);
            const mutations = context.capabilities.require(DOCUMENT_MUTATION_CAPABILITY);
            const host = Object.freeze({
                ...diagnostics,
                ...presentation,
                ...fabricRuntime,
                ...canvas,
                ...baseImage,
                ...render,
                ...raster,
                ...imageResources,
                runOperation: (operationId, task) => context.operations.run(operationId, null, () => task()),
            });
            for (const operationId of [
                'overlay:gesture',
                'overlay:add',
                'overlay:remove',
                'overlay:set-hidden',
                'overlay:set-locked',
                'overlay:layer',
            ]) {
                context.operations.register({
                    id: operationId,
                    mode: 'mutation',
                    conflictDomains: ['document', 'overlay', 'selection', 'state'],
                    reentrancy: 'reject',
                });
            }
            context.operations.register({
                id: 'overlay:transient',
                mode: 'busy',
                conflictDomains: ['overlay', 'selection'],
                reentrancy: 'queue',
            });
            context.operations.register({
                id: 'overlay:flatten',
                mode: 'mutation',
                conflictDomains: [
                    'document',
                    'base-image',
                    'geometry',
                    'raster',
                    'overlay',
                    'state',
                ],
                reentrancy: 'reject',
            });
            controller = new OverlayFoundationController(host, state, geometry, mutations, exportPort);
            context.capabilities.provide(OVERLAY_CAPABILITY, createRuntimeApi(controller), {
                version: OVERLAY_CAPABILITY.version,
            });
            context.capabilities.provide(OVERLAY_REGISTRATION_CAPABILITY, createRegistrationApi(controller), {
                version: OVERLAY_REGISTRATION_CAPABILITY.version,
                requiredPermission: 'fabric:custom-class',
            });
            return controller;
        },
        onInit() {
            controller === null || controller === void 0 ? void 0 : controller.attach();
        },
        onDispose() {
            controller === null || controller === void 0 ? void 0 : controller.dispose();
            controller = null;
        },
    });
}
export { OverlayRecoverableObjectError } from './overlay-errors.js';
export { captureOverlayStateBounds, isOverlayStateBoundsGeometry, objectPointToCanvas, restoreOverlayStateBounds, } from './overlay-state-geometry.js';
//# sourceMappingURL=index.js.map