import type { CoreEventMap } from '../../core/index.js';
import {
    ANNOTATION_AUTHORING_CAPABILITY,
    annotationFoundationRef,
} from '../../foundations/annotation/index.js';
import {
    BASE_IMAGE_INFO_CAPABILITY,
    CORE_DIAGNOSTICS_CAPABILITY,
    FABRIC_RUNTIME_CAPABILITY,
    definePlugin,
    definePluginRef,
    type PluginSetupContext,
    type SynchronousEditorPlugin,
} from '../../sdk/index.js';
import { ShapeAnnotationController, resolveShapeConfiguration } from './shape-controller.js';
import type {
    ShapeAnnotationConfiguration,
    ShapeAnnotationPluginApi,
    ShapeAnnotationPluginOptions,
} from './shape-annotation.js';

const SHAPE_TOOL_ID = 'annotation:shape';

export const shapeAnnotationPluginRef = definePluginRef<ShapeAnnotationPluginApi>(
    'annotation:shape',
    '1.0.0',
);

export function shapeAnnotationPlugin(
    options: ShapeAnnotationPluginOptions = {},
): SynchronousEditorPlugin<ShapeAnnotationPluginApi, CoreEventMap> {
    const initialConfiguration = resolveShapeConfiguration(options);
    let controller: ShapeAnnotationController | null = null;
    return definePlugin({
        ref: shapeAnnotationPluginRef,
        manifest: {
            id: shapeAnnotationPluginRef.id,
            version: '1.0.0',
            apiVersion: shapeAnnotationPluginRef.apiVersion,
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
        setup(context: PluginSetupContext<CoreEventMap>) {
            const authoring = context.capabilities.require(ANNOTATION_AUTHORING_CAPABILITY);
            const diagnostics = context.capabilities.require(CORE_DIAGNOSTICS_CAPABILITY);
            const fabric = context.capabilities.require(FABRIC_RUNTIME_CAPABILITY);
            const image = context.capabilities.require(BASE_IMAGE_INFO_CAPABILITY);
            controller = new ShapeAnnotationController(
                Object.freeze({ ...diagnostics, ...fabric, ...image }),
                authoring,
                initialConfiguration,
            );
            context.disposables.add(authoring.registerFeature(controller.featureDefinition()));
            for (const operationId of [
                'annotation-shape:create',
                'annotation-shape:update',
                'annotation-shape:commit',
            ]) {
                context.disposables.add(
                    context.operations.register({
                        id: operationId,
                        mode: 'mutation',
                        conflictDomains: ['document', 'overlay', 'selection', 'state'],
                        reentrancy: 'reject',
                    }),
                );
            }
            for (const operationId of [
                'annotation-shape:enter',
                'annotation-shape:update-preview',
                'annotation-shape:cancel',
                'annotation-shape:configure',
            ]) {
                context.disposables.add(
                    context.operations.register({
                        id: operationId,
                        mode: 'busy',
                        conflictDomains: ['overlay', 'selection', 'state'],
                        reentrancy: 'queue',
                    }),
                );
            }
            context.disposables.add(
                context.tools.register({
                    id: SHAPE_TOOL_ID,
                    enter: () => undefined,
                    exit: () => controller?.cancel(),
                    canRunOperation: (operationId) =>
                        operationId.startsWith('annotation-shape:') ||
                        operationId.startsWith('annotation:') ||
                        operationId.endsWith(':enter') ||
                        operationId === 'crop:enter' ||
                        operationId === 'mosaic:enter' ||
                        operationId === 'core:load-image' ||
                        operationId === 'core:commit-load-image' ||
                        operationId === 'core:load-state' ||
                        operationId === 'core:export',
                }),
            );
            const requireController = (): ShapeAnnotationController => {
                if (!controller) throw new Error('Shape Annotation Plugin is not installed.');
                return controller;
            };
            const api: ShapeAnnotationPluginApi = {
                enter: (enterOptions) =>
                    context.operations.run(
                        'annotation-shape:enter',
                        enterOptions,
                        async (value) => {
                            await context.tools.enter(SHAPE_TOOL_ID);
                            try {
                                requireController().enter(value);
                            } catch (error) {
                                await context.tools.exit('operation');
                                throw error;
                            }
                        },
                    ),
                updatePreview: (geometry) =>
                    context.operations.run('annotation-shape:update-preview', geometry, (value) =>
                        requireController().updatePreview(value),
                    ),
                commit: async () => {
                    try {
                        return await requireController().commit();
                    } finally {
                        if (context.tools.getActiveToolId() === SHAPE_TOOL_ID) {
                            await context.tools.exit('operation');
                        }
                    }
                },
                cancel: () =>
                    context.operations.run('annotation-shape:cancel', undefined, async () => {
                        requireController().cancel();
                        if (context.tools.getActiveToolId() === SHAPE_TOOL_ID) {
                            await context.tools.exit('requested');
                        }
                    }),
                create: async (definition) => requireController().create(definition),
                update: async (id, patch) => requireController().update(id, patch),
                configure: (patch: Partial<ShapeAnnotationConfiguration>) =>
                    context.operations.run('annotation-shape:configure', patch, (value) =>
                        requireController().configure(value),
                    ),
                getConfiguration: () => requireController().getConfiguration(),
                getSession: () => requireController().getSession(),
            };
            return Object.freeze(api);
        },
        onImageCleared(context) {
            if (context.tools.getActiveToolId() === SHAPE_TOOL_ID) {
                return context.tools.exit('operation');
            }
            controller?.closeForImage();
            return undefined;
        },
        onDispose() {
            controller?.dispose();
            controller = null;
        },
    });
}

export type {
    AnnotationPoint,
    LinearShapeGeometry,
    RectShapeGeometry,
    ShapeAnnotationConfiguration,
    ShapeAnnotationDefinition,
    ShapeAnnotationKind,
    ShapeAnnotationPluginApi,
    ShapeAnnotationPluginOptions,
    ShapeAnnotationUpdate,
    ShapeGeometryInput,
    ShapeSessionOptions,
    ShapeSessionState,
    ShapeStyleInput,
} from './shape-annotation.js';
