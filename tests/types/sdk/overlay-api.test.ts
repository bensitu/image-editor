import { Rect } from 'fabric';

import {
    OVERLAY_CAPABILITY,
    OVERLAY_REGISTRATION_CAPABILITY,
    overlayFoundationRef,
} from '../../../src/foundations/overlay/index.js';
import { definePlugin, definePluginRef } from '../../../src/sdk/index.js';

const ref = definePluginRef<{ readonly ready: true }>('example:typed-overlay', '1.0.0');

definePlugin({
    ref,
    manifest: {
        id: ref.id,
        version: '1.0.0',
        apiVersion: ref.apiVersion,
        engine: '^3.0.0',
        requiresPlugins: [overlayFoundationRef],
        requires: [
            { token: OVERLAY_CAPABILITY, range: '^1.0.0' },
            { token: OVERLAY_REGISTRATION_CAPABILITY, range: '^1.0.0' },
        ],
        permissions: ['fabric:custom-class'],
    },
    setupMode: 'sync',
    setup(context) {
        const runtime = context.capabilities.require(OVERLAY_CAPABILITY);
        // @ts-expect-error Runtime access does not expose privileged registration.
        runtime.registerKind({});

        const registration = context.capabilities.require(OVERLAY_REGISTRATION_CAPABILITY);
        registration.registerKind({
            id: 'example:typed-rect',
            ownerPluginId: ref.id,
            classify: (object) => object instanceof Rect,
            getPersistentId: () => null,
            persistence: {
                mode: 'persistent',
                codec: {
                    type: 'example:typed-rect',
                    version: '1.0.0',
                    serialize: () => Object.freeze({}),
                    validate: (value) => typeof value === 'object' && value !== null,
                    deserialize: () => new Rect(),
                },
            },
        });
        registration.registerKind({
            id: 'example:missing-persistence',
            ownerPluginId: ref.id,
            classify: () => false,
            getPersistentId: () => null,
            // @ts-expect-error Every Overlay Kind must declare persistence.
            persistence: undefined,
        });
        return { ready: true } as const;
    },
});
