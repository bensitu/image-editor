import {
    CORE_EXPORT_CAPABILITY,
    CORE_HOST_CAPABILITY,
    CORE_STATE_CAPABILITY,
    GEOMETRY_CAPABILITY,
} from '../../core-runtime/internal-capabilities.js';
import type { CoreEventMap } from '../../core-runtime/public-types.js';
import {
    createCapabilityToken,
    definePluginRef,
    type PluginSetupContext,
    type SynchronousEditorPlugin,
} from '../../plugin-kernel/index.js';
import { OverlayFoundationController } from './overlay-foundation-controller.js';
import type { OverlayFoundationApi } from './overlay-types.js';

export const OVERLAY_CAPABILITY = createCapabilityToken<OverlayFoundationApi>(
    'foundation.overlay',
    '1.0.0',
);

export const overlayFoundationRef = definePluginRef<OverlayFoundationApi>(
    'foundation.overlay',
    '1.0.0',
);

export function overlayFoundationPlugin(): SynchronousEditorPlugin<
    OverlayFoundationApi,
    CoreEventMap
> {
    let controller: OverlayFoundationController | null = null;
    return Object.freeze({
        ref: overlayFoundationRef,
        version: '1.0.0',
        setupMode: 'sync',
        requires: [
            { token: CORE_HOST_CAPABILITY, range: '^1.0.0' },
            { token: CORE_STATE_CAPABILITY, range: '^1.0.0' },
            { token: GEOMETRY_CAPABILITY, range: '^1.0.0' },
            { token: CORE_EXPORT_CAPABILITY, range: '^1.0.0' },
        ],
        setup(context: PluginSetupContext<CoreEventMap>) {
            const host = context.capabilities.require(CORE_HOST_CAPABILITY);
            const state = context.capabilities.require(CORE_STATE_CAPABILITY);
            const geometry = context.capabilities.require(GEOMETRY_CAPABILITY);
            const exportPort = context.capabilities.require(CORE_EXPORT_CAPABILITY);
            context.operations.register({ id: 'overlay:flatten', mode: 'busy' });
            controller = new OverlayFoundationController(host, state, geometry, exportPort);
            context.capabilities.provide(OVERLAY_CAPABILITY, controller);
            return controller;
        },
        onInit() {
            controller?.attach();
        },
        onDispose() {
            controller?.dispose();
            controller = null;
        },
    });
}

export type {
    FlattenOptions,
    OverlayClassification,
    OverlayExportOptions,
    OverlayExportRenderer,
    OverlayFlattenPort,
    OverlayFoundationApi,
    OverlayGeometryPolicy,
    OverlayKindDefinition,
    OverlayPort,
    OverlayQuery,
    OverlaySelectionState,
    OverlaySerializer,
    OverlaySerializerContext,
    SerializedOverlayRecord,
} from './overlay-types.js';
