import { Rect } from 'fabric';

import {
    OVERLAY_REGISTRATION_CAPABILITY,
    type OverlayRegistrationPort,
} from '@bensitu/image-editor/plugins/overlay';
import { definePlugin, definePluginRef } from '@bensitu/image-editor/sdk';

const ref = definePluginRef<{ readonly ready: true }>('example:lint-passing', '1.0.0');

export const plugin = definePlugin({
    ref,
    manifest: {
        id: ref.id,
        version: '1.0.0',
        apiVersion: ref.apiVersion,
        engine: '^3.0.0',
        requires: [{ token: OVERLAY_REGISTRATION_CAPABILITY, range: '^1.0.0' }],
        permissions: ['fabric:objects', 'fabric:custom-class'],
    },
    setup(context) {
        const overlay: OverlayRegistrationPort = context.capabilities.require(
            OVERLAY_REGISTRATION_CAPABILITY,
        );
        context.disposables.add(
            overlay.registerKind({
                id: 'example:rect',
                ownerPluginId: ref.id,
                classify: (object) => object instanceof Rect,
                getPersistentId: () => null,
                persistence: {
                    mode: 'persistent',
                    codec: {
                        type: 'example:rect',
                        version: '1.0.0',
                        serialize: () => Object.freeze({}),
                        validate: (value) => typeof value === 'object' && value !== null,
                        deserialize: () => new Rect(),
                    },
                },
            }),
        );
        return Object.freeze({ ready: true as const });
    },
});
