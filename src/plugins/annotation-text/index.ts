/**
 * Publishes the Text Annotation Plugin factory and editing contracts.
 *
 * @module
 */

import type { CoreEventMap } from '../../core/index.js';
import {
    OVERLAY_AUTHORING_SESSION_CONFLICT_DOMAINS,
    PERSISTENT_OVERLAY_MUTATION_CONFLICT_DOMAINS,
} from '../../utils/internal-operation-conflict-domains.js';
import {
    ANNOTATION_AUTHORING_CAPABILITY,
    ANNOTATION_CAPABILITY,
    annotationFoundationRef,
} from '../../foundations/annotation/index.js';
import {
    BASE_IMAGE_INFO_CAPABILITY,
    CORE_DIAGNOSTICS_CAPABILITY,
    FABRIC_RUNTIME_CAPABILITY,
    PluginNotInstalledError,
    definePlugin,
    definePluginRef,
    observePromise,
    type PluginSetupContext,
    type SynchronousEditorPlugin,
} from '../../sdk/index.js';
import { TextAnnotationController, resolveTextConfiguration } from './text-controller.js';
import type {
    TextAnnotationConfiguration,
    TextAnnotationPluginApi,
    TextAnnotationPluginOptions,
} from './text-annotation.js';

const TEXT_TOOL_ID = 'annotation:text';

export const textAnnotationPluginRef = definePluginRef<TextAnnotationPluginApi>(
    'annotation:text',
    '1.0.0',
);

export function textAnnotationPlugin(
    options: TextAnnotationPluginOptions = {},
): SynchronousEditorPlugin<TextAnnotationPluginApi, CoreEventMap> {
    const initialConfiguration = resolveTextConfiguration(options);
    let controller: TextAnnotationController | null = null;
    return definePlugin({
        ref: textAnnotationPluginRef,
        manifest: {
            id: textAnnotationPluginRef.id,
            version: '1.0.0',
            apiVersion: textAnnotationPluginRef.apiVersion,
            engine: '^3.0.0',
            requiresPlugins: [annotationFoundationRef],
            requires: [
                { token: ANNOTATION_CAPABILITY, range: '^1.0.0' },
                { token: ANNOTATION_AUTHORING_CAPABILITY, range: '^1.0.0' },
                { token: CORE_DIAGNOSTICS_CAPABILITY, range: '^1.0.0' },
                { token: FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' },
                { token: BASE_IMAGE_INFO_CAPABILITY, range: '^1.0.0' },
            ],
            permissions: ['fabric:objects'],
        },
        setupMode: 'sync',
        setup(context: PluginSetupContext<CoreEventMap>) {
            const annotations = context.capabilities.require(ANNOTATION_CAPABILITY);
            const authoring = context.capabilities.require(ANNOTATION_AUTHORING_CAPABILITY);
            const diagnostics = context.capabilities.require(CORE_DIAGNOSTICS_CAPABILITY);
            const fabric = context.capabilities.require(FABRIC_RUNTIME_CAPABILITY);
            const image = context.capabilities.require(BASE_IMAGE_INFO_CAPABILITY);
            controller = new TextAnnotationController(
                Object.freeze({ ...diagnostics, ...fabric, ...image }),
                annotations,
                authoring,
                initialConfiguration,
            );
            context.disposables.add(authoring.registerFeature(controller.featureDefinition()));
            for (const operationId of [
                'annotation-text:create',
                'annotation-text:update',
                'annotation-text:commit-edit',
            ]) {
                context.disposables.add(
                    context.operations.register({
                        id: operationId,
                        mode: 'mutation',
                        conflictDomains: PERSISTENT_OVERLAY_MUTATION_CONFLICT_DOMAINS,
                        reentrancy: 'reject',
                    }),
                );
            }
            for (const operationId of [
                'annotation-text:enter',
                'annotation-text:exit',
                'annotation-text:begin-edit',
                'annotation-text:cancel-edit',
                'annotation-text:configure',
            ]) {
                context.disposables.add(
                    context.operations.register({
                        id: operationId,
                        mode: 'busy',
                        conflictDomains: OVERLAY_AUTHORING_SESSION_CONFLICT_DOMAINS,
                        reentrancy: 'queue',
                    }),
                );
            }
            context.disposables.add(
                context.tools.register({
                    id: TEXT_TOOL_ID,
                    enter: () => undefined,
                    exit: () => controller?.cancelEditing(),
                    canRunOperation: (operationId) =>
                        operationId.startsWith('annotation-text:') ||
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
            context.disposables.add(
                annotations.subscribe((status) => {
                    const session = controller?.getEditingSession();
                    if (
                        !session ||
                        status.annotations.some(
                            (annotation) => annotation.id === session.annotationId,
                        )
                    ) {
                        return;
                    }
                    if (context.tools.getActiveToolId() === TEXT_TOOL_ID) {
                        observePromise(context.tools.exit('operation'), (error) => {
                            diagnostics.reportWarning(
                                error,
                                'Text Annotation tool cleanup after target removal failed.',
                            );
                        });
                    } else {
                        controller?.cancelEditing();
                    }
                }),
            );
            const requireController = (): TextAnnotationController => {
                if (!controller) throw new PluginNotInstalledError(textAnnotationPluginRef.id);
                return controller;
            };
            const api: TextAnnotationPluginApi = {
                enter: () =>
                    context.operations.run('annotation-text:enter', undefined, async () => {
                        requireController().enter();
                        await context.tools.enter(TEXT_TOOL_ID);
                    }),
                exit: () => {
                    if (context.tools.getActiveToolId() !== TEXT_TOOL_ID) return Promise.resolve();
                    return context.operations.run('annotation-text:exit', undefined, () =>
                        context.tools.exit('requested'),
                    );
                },
                create: (createOptions) => requireController().create(createOptions),
                beginEditing: (id) =>
                    context.operations.run('annotation-text:begin-edit', id, async (value) => {
                        await context.tools.enter(TEXT_TOOL_ID);
                        try {
                            await requireController().beginEditing(value);
                        } catch (error) {
                            await context.tools.exit('operation');
                            throw error;
                        }
                    }),
                commitEditing: async () => {
                    try {
                        await requireController().commitEditing();
                    } finally {
                        if (context.tools.getActiveToolId() === TEXT_TOOL_ID) {
                            await context.tools.exit('operation');
                        }
                    }
                },
                cancelEditing: () =>
                    context.operations.run('annotation-text:cancel-edit', undefined, async () => {
                        requireController().cancelEditing();
                        if (context.tools.getActiveToolId() === TEXT_TOOL_ID) {
                            await context.tools.exit('requested');
                        }
                    }),
                update: (id, patch) => requireController().update(id, patch),
                configure: (patch: Partial<TextAnnotationConfiguration>) =>
                    context.operations.run('annotation-text:configure', patch, (value) =>
                        requireController().configure(value),
                    ),
                getConfiguration: () => requireController().getConfiguration(),
                getEditingSession: () => requireController().getEditingSession(),
                subscribe: (listener) => requireController().subscribe(listener),
            };
            return Object.freeze(api);
        },
        onImageCleared(context) {
            if (context.tools.getActiveToolId() === TEXT_TOOL_ID) {
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
    TextAlignment,
    TextAnnotationConfiguration,
    TextAnnotationCreateOptions,
    TextAnnotationPluginApi,
    TextAnnotationPluginOptions,
    TextAnnotationStatus,
    TextAnnotationStatusListener,
    TextAnnotationUpdate,
    TextEditingSession,
    TextReflectionBehavior,
} from './text-annotation.js';
