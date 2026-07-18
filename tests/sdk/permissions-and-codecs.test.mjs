import assert from 'node:assert/strict';
import test from 'node:test';

import { ImageEditorCore } from '../../src/core/index.js';
import {
    OVERLAY_CAPABILITY,
    OVERLAY_REGISTRATION_CAPABILITY,
    overlayFoundationPlugin,
    overlayFoundationRef,
} from '../../src/foundations/overlay/index.js';
import { PluginManager } from '../../src/plugin-kernel/plugin-manager.js';
import { historyPlugin } from '../../src/plugins/history/index.js';
import { maskPlugin } from '../../src/plugins/mask/index.js';
import { transformPlugin } from '../../src/plugins/transform/index.js';
import {
    PluginManifestError,
    PluginBatchInstallError,
    PluginPermissionError,
    FABRIC_RUNTIME_CAPABILITY,
    createCapabilityToken,
    definePlugin,
    definePluginRef,
} from '../../src/sdk/index.js';
import { fabric, makeImageDataUrl, resetEditorDom } from '../helpers/fabric-environment.mjs';

function permissionPlugin(ref, token, permissions, setup) {
    return definePlugin({
        ref,
        manifest: {
            id: ref.id,
            version: '1.0.0',
            apiVersion: ref.apiVersion,
            engine: '^3.0.0',
            requires: [{ token, range: '^1.0.0' }],
            permissions,
        },
        setupMode: 'sync',
        setup,
    });
}

test('privileged Capability access requires the exact manifest permission before setup', () => {
    const token = createCapabilityToken('example:canvas-inspection', '1.0.0');
    const manager = new PluginManager({
        hostCapabilities: [
            {
                token,
                implementation: Object.freeze({ inspect: () => 'canvas' }),
                requiredPermission: 'fabric:canvas-read',
            },
        ],
    });
    let setupCalls = 0;
    const deniedRef = definePluginRef('example:permission-denied', '1.0.0');
    const denied = permissionPlugin(deniedRef, token, undefined, () => {
        setupCalls += 1;
        return Object.freeze({ ready: true });
    });

    assert.throws(
        () => manager.installSync(denied),
        (error) =>
            error instanceof PluginPermissionError &&
            error.pluginId === deniedRef.id &&
            error.permission === 'fabric:canvas-read' &&
            error.capabilityId === token.id,
    );
    assert.equal(setupCalls, 0);

    const allowedRef = definePluginRef('example:permission-allowed', '1.0.0');
    const allowed = permissionPlugin(allowedRef, token, ['fabric:canvas-read'], (context) =>
        Object.freeze({ value: context.capabilities.require(token).inspect() }),
    );
    assert.equal(manager.installSync(allowed).value, 'canvas');
    manager.disposeSync();
});

test('Core exposes Fabric runtime only to Plugins declaring object access', () => {
    const ref = definePluginRef('example:fabric-runtime-denied', '1.0.0');
    let setupCalls = 0;
    const plugin = permissionPlugin(ref, FABRIC_RUNTIME_CAPABILITY, undefined, () => {
        setupCalls += 1;
        return Object.freeze({ ready: true });
    });
    const editor = new ImageEditorCore(fabric);

    assert.throws(
        () => editor.use(plugin),
        (error) =>
            error instanceof PluginPermissionError &&
            error.permission === 'fabric:objects' &&
            error.capabilityId === FABRIC_RUNTIME_CAPABILITY.id,
    );
    assert.equal(setupCalls, 0);
    editor.dispose();
});

test('official Plugins declare narrow permissions and never global Fabric mutation', () => {
    const plugins = [overlayFoundationPlugin(), transformPlugin(), maskPlugin(), historyPlugin()];

    for (const plugin of plugins) {
        assert.equal(
            plugin.manifest.permissions?.includes('fabric:global-mutation') ?? false,
            false,
        );
        assert.equal(
            new Set(plugin.manifest.permissions ?? []).size,
            plugin.manifest.permissions?.length ?? 0,
        );
    }
});

test('Overlay registration access is separated from the safe runtime Capability', () => {
    const deniedRef = definePluginRef('example:overlay-registration-denied', '1.0.0');
    let setupCalls = 0;
    const denied = definePlugin({
        ref: deniedRef,
        manifest: {
            id: deniedRef.id,
            version: '1.0.0',
            apiVersion: deniedRef.apiVersion,
            engine: '^3.0.0',
            requiresPlugins: [overlayFoundationRef],
            requires: [{ token: OVERLAY_REGISTRATION_CAPABILITY, range: '^1.0.0' }],
        },
        setupMode: 'sync',
        setup: () => {
            setupCalls += 1;
            return Object.freeze({ ready: true });
        },
    });
    const deniedEditor = new ImageEditorCore(fabric);
    assert.throws(
        () => deniedEditor.install([overlayFoundationPlugin(), denied]),
        (error) =>
            error instanceof PluginBatchInstallError &&
            error.cause instanceof PluginPermissionError &&
            error.cause.permission === 'fabric:custom-class',
    );
    assert.equal(setupCalls, 0);
    assert.equal(deniedEditor.getPlugin(overlayFoundationRef), null);
    deniedEditor.dispose();

    const allowedRef = definePluginRef('example:overlay-registration-allowed', '1.0.0');
    const allowed = definePlugin({
        ref: allowedRef,
        manifest: {
            id: allowedRef.id,
            version: '1.0.0',
            apiVersion: allowedRef.apiVersion,
            engine: '^3.0.0',
            requiresPlugins: [overlayFoundationRef],
            requires: [
                { token: OVERLAY_CAPABILITY, range: '^1.0.0' },
                { token: OVERLAY_REGISTRATION_CAPABILITY, range: '^1.0.0' },
            ],
            permissions: ['fabric:custom-class'],
        },
        setupMode: 'sync',
        setup: (context) => {
            const runtime = context.capabilities.require(OVERLAY_CAPABILITY);
            const registration = context.capabilities.require(OVERLAY_REGISTRATION_CAPABILITY);
            assert.equal('registerKind' in runtime, false);
            context.disposables.add(
                registration.registerKind({
                    id: 'example:scoped-kind',
                    ownerPluginId: allowedRef.id,
                    classify: () => false,
                    getPersistentId: () => null,
                    persistence: { mode: 'transient' },
                }),
            );
            return Object.freeze({ ready: true });
        },
    });
    const allowedEditor = new ImageEditorCore(fabric);
    const [, api] = allowedEditor.install([overlayFoundationPlugin(), allowed]);
    assert.equal(api.ready, true);
    allowedEditor.dispose();
});

test('persistent Overlay Kind registration rejects a missing Codec without leaking the Kind', async () => {
    const editor = new ImageEditorCore(fabric);
    const overlay = editor.use(overlayFoundationPlugin());
    const definition = {
        id: 'example:codec-gate',
        ownerPluginId: 'example:codec-plugin',
        classify: () => false,
        getPersistentId: () => null,
        persistence: { mode: 'persistent' },
    };

    assert.throws(() => overlay.registerKind(definition), PluginManifestError);

    const registration = overlay.registerKind({
        ...definition,
        persistence: {
            mode: 'persistent',
            codec: {
                type: 'example:codec-gate',
                version: '1.0.0',
                serialize: () => Object.freeze({ value: 1 }),
                validate: (value) =>
                    typeof value === 'object' && value !== null && value.value === 1,
                deserialize: (_value, context) => new context.fabric.Rect(),
            },
        },
    });
    registration.dispose();
    await editor.disposeAsync();
});

test('transient Overlay Kind registration excludes persistence and removes owned objects on cleanup', async () => {
    const ids = resetEditorDom();
    const editor = new ImageEditorCore(fabric);
    const overlay = editor.use(overlayFoundationPlugin());
    const registration = overlay.registerKind({
        id: 'example:transient-overlay',
        ownerPluginId: 'example:transient-plugin',
        classify: (object) => object.editorOverlayKind === 'example:transient-overlay',
        getPersistentId: (object) => object.editorOverlayId ?? null,
        persistence: { mode: 'transient' },
    });

    await editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
    await editor.loadImage(makeImageDataUrl());
    const transient = new fabric.Rect({ width: 20, height: 20 });
    transient.editorOverlayKind = 'example:transient-overlay';
    transient.editorOverlayId = 'example:transient-object';
    editor.getCanvas().add(transient);
    assert.equal(overlay.getByPersistentId('example:transient-object'), transient);

    const snapshot = JSON.parse(editor.saveState());
    const overlayState = snapshot.plugins['foundation.overlay'].data;
    assert.equal(
        overlayState.overlays.some((record) => record.persistentId === 'example:transient-object'),
        false,
    );
    registration.dispose();
    assert.equal(editor.getCanvas().getObjects().includes(transient), false);
    await editor.disposeAsync();
    document.body.innerHTML = '';
});
