import assert from 'node:assert/strict';
import test from 'node:test';

import ImageEditorDefault, {
    ImageEditor,
    ImageEditorCore,
    CoreRuntimeError,
    definePluginRef,
} from '../src/index.ts';
import { ImageEditorCore as CoreEntry } from '../src/core/index.js';

test('package root and Core entry resolve one Core class identity', () => {
    assert.equal(ImageEditor, ImageEditorCore);
    assert.equal(ImageEditorDefault, ImageEditorCore);
    assert.equal(CoreEntry, ImageEditorCore);
});

test('package root exposes the Core Framework primitives', () => {
    assert.equal(typeof ImageEditor, 'function');
    assert.equal(typeof CoreRuntimeError, 'function');
    assert.equal(typeof definePluginRef, 'function');
});

test('package root does not expose removed facade runtime values', async () => {
    const root = await import('../src/index.ts');
    for (const name of [
        'EditorRuntime',
        'DeferredHistoryPort',
        'PluginHistoryAdapter',
        'definePlugin',
        'createPluginTestHost',
        'runPluginConformance',
        'overlayFoundationPlugin',
        'transformPlugin',
        'historyPlugin',
        'maskPlugin',
        'annotationFoundationPlugin',
        'textAnnotationPlugin',
        'shapeAnnotationPlugin',
        'drawAnnotationPlugin',
    ]) {
        assert.equal(name in root, false, `${name} must not be exported from the package root`);
    }
});
