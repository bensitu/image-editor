import {
    CORE_HOST_CAPABILITY,
    CORE_STATE_CAPABILITY,
} from '../../core-runtime/internal-capabilities.js';
import type { CoreEventMap } from '../../core-runtime/public-types.js';
import { OVERLAY_CAPABILITY } from '../../foundations/overlay/index.js';
import {
    definePluginRef,
    type PluginSetupContext,
    type SynchronousEditorPlugin,
} from '../../plugin-kernel/index.js';
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
    return Object.freeze({
        ref: maskPluginRef,
        version: '1.0.0',
        setupMode: 'sync',
        requires: [
            { token: CORE_HOST_CAPABILITY, range: '^1.0.0' },
            { token: CORE_STATE_CAPABILITY, range: '^1.0.0' },
            { token: OVERLAY_CAPABILITY, range: '^1.0.0' },
        ],
        setup(context: PluginSetupContext<CoreEventMap>) {
            const host = context.capabilities.require(CORE_HOST_CAPABILITY);
            const state = context.capabilities.require(CORE_STATE_CAPABILITY);
            const overlay = context.capabilities.require(OVERLAY_CAPABILITY);
            for (const operationId of ['mask:create', 'mask:remove', 'mask:remove-all']) {
                context.operations.register({ id: operationId, mode: 'busy' });
            }
            controller = new MaskPluginController(
                host,
                state,
                overlay,
                {
                    run: <TResult>(operationId: string, body: () => TResult): TResult => {
                        const token = context.operations.begin(operationId);
                        try {
                            return body();
                        } finally {
                            const cleanup = token.dispose();
                            if (cleanup instanceof Promise) {
                                void cleanup.catch((error: unknown) =>
                                    host.reportError(error, 'Mask operation cleanup failed.'),
                                );
                            }
                        }
                    },
                },
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
export type {
    DefaultMaskConfig,
    LabelConfig,
    MaskConfig,
    MaskObject,
} from '../../core/public-types.js';
