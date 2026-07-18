import type { CoreEventMap } from '@bensitu/image-editor/core';
// This NodeNext fixture must exercise the package's CommonJS declaration branch.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import sdk = require('@bensitu/image-editor/sdk');

export interface PublicPluginApi {
    readonly ready: boolean;
}

export const publicPluginRef = sdk.definePluginRef<PublicPluginApi>(
    '@image-editor-fixtures/public-plugin',
    '1.0.0',
);

export function publicPlugin(): sdk.SynchronousEditorPlugin<PublicPluginApi, CoreEventMap> {
    return sdk.definePlugin({
        ref: publicPluginRef,
        manifest: {
            id: publicPluginRef.id,
            version: '1.0.0',
            apiVersion: publicPluginRef.apiVersion,
            engine: '^3.0.0',
            requires: [
                { token: sdk.CORE_STATUS_CAPABILITY, range: '^1.0.0' },
                { token: sdk.CANVAS_READ_CAPABILITY, range: '^1.0.0' },
            ],
            permissions: ['fabric:canvas-read'],
        },
        setupMode: 'sync',
        setup(context) {
            const status = context.capabilities.require(sdk.CORE_STATUS_CAPABILITY);
            const canvas = context.capabilities.require(sdk.CANVAS_READ_CAPABILITY);
            return Object.freeze({
                ready: !status.isDisposed() && canvas.getCanvas() !== undefined,
            });
        },
    });
}
