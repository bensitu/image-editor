import type { CoreEventMap } from '../../core/index.js';
import {
    CANVAS_READ_CAPABILITY,
    CANVAS_RESIZE_CAPABILITY,
    CORE_DIAGNOSTICS_CAPABILITY,
    CORE_PRESENTATION_CAPABILITY,
    FABRIC_RUNTIME_CAPABILITY,
    RENDER_REQUEST_CAPABILITY,
    SNAPSHOT_REGISTRATION_CAPABILITY,
    definePlugin,
    definePluginRef,
    type PluginSetupContext,
    type SynchronousEditorPlugin,
} from '../../sdk/index.js';
import {
    OVERLAY_CAPABILITY,
    OVERLAY_REGISTRATION_CAPABILITY,
    overlayFoundationRef,
} from '../../foundations/overlay/index.js';
import {
    MaskPluginController,
    resolveMaskPluginOptions,
    type MaskPluginApi,
    type MaskPluginOptions,
} from './mask-controller.js';

export const maskPluginRef = definePluginRef<MaskPluginApi>('@bensitu/mask', '1.0.0');

export function maskPlugin(
    options: MaskPluginOptions = {},
): SynchronousEditorPlugin<MaskPluginApi, CoreEventMap> {
    const resolved = resolveMaskPluginOptions(options);
    let controller: MaskPluginController | null = null;
    return definePlugin({
        ref: maskPluginRef,
        manifest: {
            id: maskPluginRef.id,
            version: '1.0.0',
            apiVersion: maskPluginRef.apiVersion,
            engine: '^3.0.0',
            requiresPlugins: [overlayFoundationRef],
            requires: [
                { token: CORE_DIAGNOSTICS_CAPABILITY, range: '^1.0.0' },
                { token: CORE_PRESENTATION_CAPABILITY, range: '^1.0.0' },
                { token: FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' },
                { token: CANVAS_READ_CAPABILITY, range: '^1.0.0' },
                { token: RENDER_REQUEST_CAPABILITY, range: '^1.0.0' },
                { token: CANVAS_RESIZE_CAPABILITY, range: '^1.0.0' },
                { token: SNAPSHOT_REGISTRATION_CAPABILITY, range: '^1.0.0' },
                { token: OVERLAY_CAPABILITY, range: '^1.0.0' },
                { token: OVERLAY_REGISTRATION_CAPABILITY, range: '^1.0.0' },
            ],
            permissions: ['fabric:objects', 'fabric:canvas-read', 'fabric:custom-class'],
        },
        setupMode: 'sync',
        setup(context: PluginSetupContext<CoreEventMap>) {
            const diagnostics = context.capabilities.require(CORE_DIAGNOSTICS_CAPABILITY);
            const presentation = context.capabilities.require(CORE_PRESENTATION_CAPABILITY);
            const fabricRuntime = context.capabilities.require(FABRIC_RUNTIME_CAPABILITY);
            const canvas = context.capabilities.require(CANVAS_READ_CAPABILITY);
            const render = context.capabilities.require(RENDER_REQUEST_CAPABILITY);
            const resize = context.capabilities.require(CANVAS_RESIZE_CAPABILITY);
            const state = context.capabilities.require(SNAPSHOT_REGISTRATION_CAPABILITY);
            const overlay = context.capabilities.require(OVERLAY_CAPABILITY);
            const overlayRegistration = context.capabilities.require(
                OVERLAY_REGISTRATION_CAPABILITY,
            );
            const host = Object.freeze({
                ...diagnostics,
                ...presentation,
                ...fabricRuntime,
                ...canvas,
                ...render,
                ...resize,
            });
            for (const operationId of ['mask:create', 'mask:remove', 'mask:remove-all']) {
                context.operations.register({
                    id: operationId,
                    mode: 'mutation',
                    conflictDomains: ['document', 'overlay', 'selection', 'state'],
                    reentrancy: 'reject',
                });
            }
            controller = new MaskPluginController(
                host,
                state,
                Object.freeze({ ...overlay, ...overlayRegistration }),
                resolved,
            );
            return controller;
        },
        onInit() {
            controller?.attach();
        },
        onImageCleared() {
            controller?.resetForImage();
        },
        onDispose() {
            controller?.dispose();
            controller = null;
        },
    });
}

export type {
    MaskPluginApi,
    MaskPluginOptions,
    RemoveAllOptions,
    ResolvedMaskPluginOptions,
} from './mask-controller.js';
export type { DefaultMaskConfig, LabelConfig, MaskConfig, MaskObject } from '../../core/index.js';
