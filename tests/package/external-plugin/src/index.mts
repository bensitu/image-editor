import type { CoreEventMap } from '@bensitu/image-editor/core';
import {
    CANVAS_READ_CAPABILITY,
    CORE_STATUS_CAPABILITY,
    definePlugin,
    definePluginRef,
    type SynchronousEditorPlugin,
} from '@bensitu/image-editor/sdk';

export interface PublicPluginApi {
    readonly ready: boolean;
}

export const publicPluginRef = definePluginRef<PublicPluginApi>(
    '@image-editor-fixtures/public-plugin',
    '1.0.0',
);

export function publicPlugin(): SynchronousEditorPlugin<PublicPluginApi, CoreEventMap> {
    return definePlugin({
        ref: publicPluginRef,
        manifest: {
            id: publicPluginRef.id,
            version: '1.0.0',
            apiVersion: publicPluginRef.apiVersion,
            engine: '^3.0.0',
            requires: [
                { token: CORE_STATUS_CAPABILITY, range: '^1.0.0' },
                { token: CANVAS_READ_CAPABILITY, range: '^1.0.0' },
            ],
            permissions: ['fabric:canvas-read'],
        },
        setupMode: 'sync',
        setup(context) {
            const status = context.capabilities.require(CORE_STATUS_CAPABILITY);
            const canvas = context.capabilities.require(CANVAS_READ_CAPABILITY);
            return Object.freeze({
                ready: !status.isDisposed() && canvas.getCanvas() !== undefined,
            });
        },
    });
}
