import { CANVAS_READ_CAPABILITY, CORE_DIAGNOSTICS_CAPABILITY, FABRIC_RUNTIME_CAPABILITY, RENDER_REQUEST_CAPABILITY, createCapabilityToken, definePlugin, definePluginRef, } from '../../sdk/index.js';
import { OVERLAY_CAPABILITY, OVERLAY_REGISTRATION_CAPABILITY, overlayFoundationRef, } from '../overlay/index.js';
import { AnnotationController } from './annotation-controller.js';
export const ANNOTATION_CAPABILITY = createCapabilityToken('foundation:annotation', '1.0.0');
export const ANNOTATION_AUTHORING_CAPABILITY = createCapabilityToken('foundation:annotation-authoring', '1.0.0');
export const annotationFoundationRef = definePluginRef('foundation:annotation', '1.0.0');
export function annotationFoundationPlugin(options = {}) {
    let controller = null;
    return definePlugin({
        ref: annotationFoundationRef,
        manifest: {
            id: annotationFoundationRef.id,
            version: '1.0.0',
            apiVersion: annotationFoundationRef.apiVersion,
            engine: '^3.0.0',
            requiresPlugins: [overlayFoundationRef],
            requires: [
                { token: OVERLAY_CAPABILITY, range: '^1.0.0' },
                { token: OVERLAY_REGISTRATION_CAPABILITY, range: '^1.0.0' },
                { token: CORE_DIAGNOSTICS_CAPABILITY, range: '^1.0.0' },
                { token: FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' },
                { token: CANVAS_READ_CAPABILITY, range: '^1.0.0' },
                { token: RENDER_REQUEST_CAPABILITY, range: '^1.0.0' },
            ],
            permissions: ['fabric:objects', 'fabric:canvas-read', 'fabric:custom-class'],
        },
        setupMode: 'sync',
        setup(context) {
            const overlay = context.capabilities.require(OVERLAY_CAPABILITY);
            const registration = context.capabilities.require(OVERLAY_REGISTRATION_CAPABILITY);
            const diagnostics = context.capabilities.require(CORE_DIAGNOSTICS_CAPABILITY);
            const fabric = context.capabilities.require(FABRIC_RUNTIME_CAPABILITY);
            const canvas = context.capabilities.require(CANVAS_READ_CAPABILITY);
            const render = context.capabilities.require(RENDER_REQUEST_CAPABILITY);
            for (const operationId of [
                'annotation:update',
                'annotation:remove',
                'annotation:remove-all',
            ]) {
                context.disposables.add(context.operations.register({
                    id: operationId,
                    mode: 'mutation',
                    conflictDomains: ['document', 'overlay', 'selection', 'state'],
                    reentrancy: 'reject',
                }));
            }
            controller = new AnnotationController(Object.freeze({ ...diagnostics, ...fabric, ...canvas, ...render }), Object.freeze({ ...overlay, ...registration }), options);
            context.capabilities.provide(ANNOTATION_CAPABILITY, controller, {
                version: ANNOTATION_CAPABILITY.version,
            });
            context.capabilities.provide(ANNOTATION_AUTHORING_CAPABILITY, controller, {
                version: ANNOTATION_AUTHORING_CAPABILITY.version,
                requiredPermission: 'fabric:objects',
            });
            return controller;
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
export { AnnotationError, AnnotationNotFoundError, AnnotationValidationError, } from './annotation-errors.js';
//# sourceMappingURL=index.js.map