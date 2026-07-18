import { Rect, classRegistry } from 'fabric';

import { PluginManager } from '@bensitu/image-editor/plugin-kernel/internal';
import { definePlugin, definePluginRef } from '@bensitu/image-editor/sdk';

const ref = definePluginRef<{ readonly ready: true }>('example:lint-failing', '1.0.0');

Rect.prototype.toObject = () => ({ type: 'rect' });
classRegistry.setClass(Rect);

export const plugin = definePlugin({
    ref,
    manifest: {
        id: ref.id,
        version: '1.0.0',
        apiVersion: ref.apiVersion,
        engine: '^3.0.0',
        permissions: [],
    },
    setup() {
        const overlay = globalThis.overlayRegistration;
        overlay.registerKind({
            id: 'example:missing-persistence',
            ownerPluginId: ref.id,
            classify: () => false,
            getPersistentId: () => null,
        });
        void PluginManager;
        return Object.freeze({ ready: true as const });
    },
});
