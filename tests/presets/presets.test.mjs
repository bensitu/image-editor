import assert from 'node:assert/strict';
import test from 'node:test';

import { annotationFoundationRef } from '../../src/foundations/annotation/index.js';
import { overlayFoundationRef } from '../../src/foundations/overlay/index.js';
import { drawAnnotationPluginRef } from '../../src/plugins/annotation-draw/index.js';
import { shapeAnnotationPluginRef } from '../../src/plugins/annotation-shape/index.js';
import { textAnnotationPluginRef } from '../../src/plugins/annotation-text/index.js';
import { cropPluginRef } from '../../src/plugins/crop/index.js';
import { domControlsPluginRef } from '../../src/plugins/dom-controls/index.js';
import { filtersPluginRef } from '../../src/plugins/filters/index.js';
import { historyPluginRef } from '../../src/plugins/history/index.js';
import { maskPluginRef } from '../../src/plugins/mask/index.js';
import { mosaicPluginRef } from '../../src/plugins/mosaic/index.js';
import { overlayStatePluginRef } from '../../src/plugins/overlay-state/index.js';
import { transformPluginRef } from '../../src/plugins/transform/index.js';
import { createAnnotationPreset } from '../../src/presets/annotation/index.js';
import { createFullPreset } from '../../src/presets/full/index.js';
import { createMinimalPreset } from '../../src/presets/minimal/index.js';
import { createRedactionPreset } from '../../src/presets/redaction/index.js';
import { definePlugin } from '../../src/sdk/index.js';
import { fabric, resetEditorDom } from '../helpers/fabric-environment.mjs';

async function dispose(result) {
    await result.editor.disposeAsync();
    if (globalThis.document) document.body.innerHTML = '';
}

function checkingDomPlugin(bindings, hooks = {}) {
    return definePlugin({
        ref: domControlsPluginRef,
        manifest: {
            id: domControlsPluginRef.id,
            version: '1.0.0',
            apiVersion: domControlsPluginRef.apiVersion,
            engine: '^3.0.0',
            requiresPlugins: Object.freeze(
                Object.values(bindings)
                    .filter(Boolean)
                    .map((binding) => binding.ref),
            ),
        },
        setupMode: 'sync',
        setup() {
            hooks.onSetup?.();
            return Object.freeze({
                refresh: () => undefined,
                getStatus: () =>
                    Object.freeze({
                        isBound: false,
                        isBusy: false,
                        isDisposed: false,
                        bindingCount: 0,
                    }),
            });
        },
        onDispose() {
            hooks.onDispose?.(bindings);
        },
    });
}

test('Minimal installs Transform only by default and makes History explicitly typed at runtime', async () => {
    const minimal = createMinimalPreset(fabric, { transform: { animationDuration: 0 } });
    assert.equal(minimal.editor.getLifecycleState(), 'configured');
    assert.equal(minimal.history, null);
    assert.equal(minimal.domControls, null);
    assert.equal(minimal.editor.requirePlugin(transformPluginRef), minimal.transform);
    assert.equal(minimal.editor.getPlugin(historyPluginRef), null);
    assert.equal(minimal.editor.getPlugin(overlayFoundationRef), null);
    await dispose(minimal);

    const withHistory = createMinimalPreset(fabric, { history: { enabled: false } });
    assert.equal(withHistory.editor.requirePlugin(historyPluginRef), withHistory.history);
    assert.equal(withHistory.history.isEnabled, false);
    await dispose(withHistory);
});

test('Redaction installs one Overlay Foundation and excludes Annotation features', async () => {
    const preset = createRedactionPreset(fabric, { transform: { animationDuration: 0 } });
    assert.equal(preset.editor.getLifecycleState(), 'configured');
    assert.equal(preset.editor.requirePlugin(overlayFoundationRef), preset.overlays);
    assert.equal(preset.editor.requirePlugin(maskPluginRef), preset.masks);
    assert.equal(preset.editor.requirePlugin(filtersPluginRef), preset.filters);
    assert.equal(preset.editor.requirePlugin(cropPluginRef), preset.crop);
    assert.equal(preset.editor.requirePlugin(mosaicPluginRef), preset.mosaic);
    assert.equal(preset.editor.requirePlugin(overlayStatePluginRef), preset.overlayState);
    assert.equal(preset.editor.getPlugin(annotationFoundationRef), null);
    assert.equal(preset.editor.getPlugin(textAnnotationPluginRef), null);
    assert.equal(preset.editor.getPlugin(shapeAnnotationPluginRef), null);
    assert.equal(preset.editor.getPlugin(drawAnnotationPluginRef), null);
    await dispose(preset);
});

test('Annotation installs each Foundation once and excludes raster editing features', async () => {
    const preset = createAnnotationPreset(fabric);
    assert.equal(preset.editor.requirePlugin(overlayFoundationRef), preset.overlays);
    assert.equal(preset.editor.requirePlugin(annotationFoundationRef), preset.annotations);
    assert.equal(preset.editor.requirePlugin(textAnnotationPluginRef), preset.text);
    assert.equal(preset.editor.requirePlugin(shapeAnnotationPluginRef), preset.shape);
    assert.equal(preset.editor.requirePlugin(drawAnnotationPluginRef), preset.draw);
    assert.equal(preset.editor.getPlugin(maskPluginRef), null);
    assert.equal(preset.editor.getPlugin(filtersPluginRef), null);
    assert.equal(preset.editor.getPlugin(cropPluginRef), null);
    assert.equal(preset.editor.getPlugin(mosaicPluginRef), null);
    await dispose(preset);
});

test('Full returns every official Plugin API and initializes without duplicate Foundations', async () => {
    const ids = resetEditorDom({ containerWidth: 320, containerHeight: 240 });
    const preset = createFullPreset(fabric, { transform: { animationDuration: 0 } });
    const expected = [
        [transformPluginRef, preset.transform],
        [historyPluginRef, preset.history],
        [overlayFoundationRef, preset.overlays],
        [maskPluginRef, preset.masks],
        [filtersPluginRef, preset.filters],
        [cropPluginRef, preset.crop],
        [mosaicPluginRef, preset.mosaic],
        [annotationFoundationRef, preset.annotations],
        [textAnnotationPluginRef, preset.text],
        [shapeAnnotationPluginRef, preset.shape],
        [drawAnnotationPluginRef, preset.draw],
        [overlayStatePluginRef, preset.overlayState],
    ];
    for (const [ref, api] of expected) assert.equal(preset.editor.requirePlugin(ref), api);
    assert.ok(expected.every(([ref]) => ref.apiVersion === '1.0.0'));
    await preset.editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
    assert.equal(preset.editor.getLifecycleState(), 'initialized');
    await dispose(preset);
});

test('optional DOM setup sees all dependencies and disposes before them', async () => {
    let setupComplete = false;
    let dependenciesAvailableDuringDispose = false;
    const preset = createFullPreset(fabric, {
        domControls: (bindings) =>
            checkingDomPlugin(bindings, {
                onSetup: () => {
                    setupComplete = true;
                },
                onDispose: () => {
                    dependenciesAvailableDuringDispose =
                        preset.transform.getState().scale === 1 &&
                        preset.history.getState().isEnabled === true;
                },
            }),
    });
    assert.equal(setupComplete, true);
    assert.equal(preset.editor.requirePlugin(domControlsPluginRef), preset.domControls);
    await dispose(preset);
    assert.equal(dependenciesAvailableDuringDispose, true);
});

test('a failing optional DOM setup rolls back the complete Plugin Plan', () => {
    let capturedBindings;
    assert.throws(
        () =>
            createFullPreset(fabric, {
                domControls: (bindings) => {
                    capturedBindings = bindings;
                    return definePlugin({
                        ref: domControlsPluginRef,
                        manifest: {
                            id: domControlsPluginRef.id,
                            version: '1.0.0',
                            apiVersion: domControlsPluginRef.apiVersion,
                            engine: '^3.0.0',
                            requiresPlugins: [bindings.transform.ref],
                        },
                        setupMode: 'sync',
                        setup() {
                            throw new Error('expected preset setup failure');
                        },
                    });
                },
            }),
        (error) => error.cause?.cause?.message === 'expected preset setup failure',
    );
    assert.throws(() => capturedBindings.transform.resolve(), /not installed/);
});

test('Preset instances never share Core or Plugin API state', async () => {
    const first = createMinimalPreset(fabric, { history: {} });
    const second = createMinimalPreset(fabric, { history: {} });
    assert.notEqual(first.editor, second.editor);
    assert.notEqual(first.transform, second.transform);
    assert.notEqual(first.history, second.history);
    await dispose(first);
    await dispose(second);
});
