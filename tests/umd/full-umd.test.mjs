import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

import { fabric, makeImageDataUrl, resetEditorDom } from '../helpers/fabric-environment.mjs';

const developmentPath = new URL('../../dist/umd/image-editor.full.umd.js', import.meta.url);
const minifiedPath = new URL('../../dist/umd/image-editor.full.umd.min.js', import.meta.url);

async function loadNamespace() {
    delete globalThis.ImageEditorFull;
    const source = await readFile(developmentPath, 'utf8');
    vm.runInThisContext(source, { filename: developmentPath.pathname });
    return globalThis.ImageEditorFull;
}

test('Full UMD exposes one modern global and every official Feature factory', async () => {
    const namespace = await loadNamespace();
    assert.ok(namespace);
    for (const name of [
        'ImageEditorCore',
        'createFullPreset',
        'definePlugin',
        'composePlugins',
        'overlayFoundationPlugin',
        'annotationFoundationPlugin',
        'transformPlugin',
        'historyPlugin',
        'maskPlugin',
        'filtersPlugin',
        'cropPlugin',
        'mosaicPlugin',
        'textAnnotationPlugin',
        'shapeAnnotationPlugin',
        'drawAnnotationPlugin',
        'overlayStatePlugin',
        'domControlsPlugin',
    ]) {
        assert.equal(typeof namespace[name], 'function', `${name} must be public.`);
    }
    assert.equal('ImageEditor' in namespace, false);
    assert.equal('default' in namespace, false);
    assert.equal('loadV2Snapshot' in namespace, false);

    const preset = namespace.createFullPreset(fabric, { transform: { animationDuration: 0 } });
    assert.ok(preset.editor instanceof namespace.ImageEditorCore);
    assert.equal(preset.domControls, null);
    for (const name of [
        'transform',
        'history',
        'overlays',
        'masks',
        'filters',
        'crop',
        'mosaic',
        'annotations',
        'text',
        'shape',
        'draw',
        'overlayState',
    ]) {
        assert.equal(typeof preset[name], 'object', `${name} API must be installed.`);
    }
    await preset.editor.disposeAsync();

    const withDom = namespace.createFullPreset(fabric, {
        domControls: () => namespace.domControlsPlugin(),
    });
    assert.equal(typeof withDom.domControls?.getStatus, 'function');
    await withDom.editor.disposeAsync();
});

test('Full UMD supports load, edit, history, export, rollback, and disposal', async () => {
    const namespace = await loadNamespace();
    const ids = resetEditorDom({ containerWidth: 320, containerHeight: 240 });
    const preset = namespace.createFullPreset(fabric, { transform: { animationDuration: 0 } });
    await preset.editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
    await preset.editor.loadImage(makeImageDataUrl({ width: 120, height: 80 }));

    await preset.transform.rotate(90);
    assert.equal(preset.transform.getState().rotationDegrees, 90);
    await preset.history.undo();
    assert.equal(preset.transform.getState().rotationDegrees, 0);
    await preset.history.redo();
    assert.equal(preset.transform.getState().rotationDegrees, 90);

    const exported = await preset.editor.exportImageBase64({ format: 'png' });
    assert.match(exported, /^data:image\/png;base64,/u);
    const beforeFailure = preset.editor.saveState();
    await assert.rejects(preset.editor.loadFromState({ schemaVersion: 3, document: null }));
    assert.equal(preset.editor.saveState(), beforeFailure);

    await preset.editor.disposeAsync();
    assert.equal(preset.editor.getLifecycleState(), 'disposed');
});

test('Full UMD ships parseable minified output and attributable source maps', async () => {
    const minified = await readFile(minifiedPath, 'utf8');
    assert.doesNotThrow(() => new vm.Script(minified));
    for (const artifactPath of [developmentPath, minifiedPath]) {
        const sourceMap = JSON.parse(await readFile(new URL(`${artifactPath.href}.map`), 'utf8'));
        assert.equal(sourceMap.version, 3);
        assert.ok(sourceMap.sources.length > 0);
        assert.equal(
            sourceMap.sources.some((source) => source.includes('node_modules/fabric')),
            false,
        );
    }
});
