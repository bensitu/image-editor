import { ANNOTATION_AUTHORING_CAPABILITY, annotationFoundationRef, } from '../../foundations/annotation/index.js';
import { BASE_IMAGE_INFO_CAPABILITY, CORE_DIAGNOSTICS_CAPABILITY, FABRIC_RUNTIME_CAPABILITY, definePlugin, definePluginRef, } from '../../sdk/index.js';
import { DrawAnnotationController, resolveBrushConfiguration, resolveEraserConfiguration, } from './draw-controller.js';
const DRAW_TOOL_ID = 'annotation:draw';
export const drawAnnotationPluginRef = definePluginRef('annotation:draw', '1.0.0');
export function drawAnnotationPlugin(options = {}) {
    const initialOptions = Object.freeze({
        brush: resolveBrushConfiguration(options.brush),
        eraser: resolveEraserConfiguration(options.eraser),
    });
    let controller = null;
    return definePlugin({
        ref: drawAnnotationPluginRef,
        manifest: {
            id: drawAnnotationPluginRef.id,
            version: '1.0.0',
            apiVersion: drawAnnotationPluginRef.apiVersion,
            engine: '^3.0.0',
            requiresPlugins: [annotationFoundationRef],
            requires: [
                { token: ANNOTATION_AUTHORING_CAPABILITY, range: '^1.0.0' },
                { token: CORE_DIAGNOSTICS_CAPABILITY, range: '^1.0.0' },
                { token: FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' },
                { token: BASE_IMAGE_INFO_CAPABILITY, range: '^1.0.0' },
            ],
            permissions: ['fabric:objects'],
        },
        setupMode: 'sync',
        setup(context) {
            const authoring = context.capabilities.require(ANNOTATION_AUTHORING_CAPABILITY);
            const diagnostics = context.capabilities.require(CORE_DIAGNOSTICS_CAPABILITY);
            const fabric = context.capabilities.require(FABRIC_RUNTIME_CAPABILITY);
            const image = context.capabilities.require(BASE_IMAGE_INFO_CAPABILITY);
            controller = new DrawAnnotationController(Object.freeze({ ...diagnostics, ...fabric, ...image }), authoring, initialOptions);
            context.disposables.add(authoring.registerFeature(controller.featureDefinition()));
            for (const operationId of [
                'annotation-draw:commit-stroke',
                'annotation-draw:commit-erase',
            ]) {
                context.disposables.add(context.operations.register({
                    id: operationId,
                    mode: 'mutation',
                    conflictDomains: ['document', 'overlay', 'selection', 'state'],
                    reentrancy: 'reject',
                }));
            }
            for (const operationId of [
                'annotation-draw:enter',
                'annotation-draw:set-sub-mode',
                'annotation-draw:begin-stroke',
                'annotation-draw:append-stroke',
                'annotation-draw:cancel-stroke',
                'annotation-draw:exit',
                'annotation-draw:configure-brush',
                'annotation-draw:configure-eraser',
            ]) {
                context.disposables.add(context.operations.register({
                    id: operationId,
                    mode: 'busy',
                    conflictDomains: ['overlay', 'selection', 'state'],
                    reentrancy: 'queue',
                }));
            }
            context.disposables.add(context.tools.register({
                id: DRAW_TOOL_ID,
                enter: () => undefined,
                exit: () => controller === null || controller === void 0 ? void 0 : controller.exit(),
                canRunOperation: (operationId) => operationId.startsWith('annotation-draw:') ||
                    operationId.startsWith('annotation:') ||
                    operationId.endsWith(':enter') ||
                    operationId === 'crop:enter' ||
                    operationId === 'mosaic:enter' ||
                    operationId === 'core:load-image' ||
                    operationId === 'core:commit-load-image' ||
                    operationId === 'core:load-state' ||
                    operationId === 'core:export',
            }));
            const requireController = () => {
                if (!controller)
                    throw new Error('Draw Annotation Plugin is not installed.');
                return controller;
            };
            const api = {
                enter: (enterOptions = {}) => context.operations.run('annotation-draw:enter', enterOptions, async (value) => {
                    await context.tools.enter(DRAW_TOOL_ID);
                    try {
                        requireController().enter(value);
                    }
                    catch (error) {
                        await context.tools.exit('operation');
                        throw error;
                    }
                }),
                setSubMode: (mode) => context.operations.run('annotation-draw:set-sub-mode', mode, (value) => requireController().setSubMode(value)),
                beginStroke: (point) => context.operations.run('annotation-draw:begin-stroke', point, (value) => requireController().beginStroke(value)),
                appendStroke: (point) => context.operations.run('annotation-draw:append-stroke', point, (value) => requireController().appendStroke(value)),
                endStroke: () => requireController().endStroke(),
                cancelStroke: () => context.operations.run('annotation-draw:cancel-stroke', undefined, () => requireController().cancelStroke()),
                exit: () => context.operations.run('annotation-draw:exit', undefined, async () => {
                    requireController().exit();
                    if (context.tools.getActiveToolId() === DRAW_TOOL_ID) {
                        await context.tools.exit('requested');
                    }
                }),
                configureBrush: (patch) => context.operations.run('annotation-draw:configure-brush', patch, (value) => requireController().configureBrush(value)),
                configureEraser: (patch) => context.operations.run('annotation-draw:configure-eraser', patch, (value) => requireController().configureEraser(value)),
                getConfiguration: () => requireController().getConfiguration(),
                getSession: () => requireController().getSession(),
            };
            return Object.freeze(api);
        },
        onImageCleared(context) {
            if (context.tools.getActiveToolId() === DRAW_TOOL_ID) {
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
//# sourceMappingURL=index.js.map