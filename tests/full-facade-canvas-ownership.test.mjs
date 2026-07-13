import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { ImageEditor } from '../src/image-editor.js';
import { fabric, resetEditorDom } from './helpers/fabric-environment.mjs';

test('Full Facade construction is Canvas-free and repeated init creates one Core Canvas', async () => {
    const ids = resetEditorDom();
    const BaseCanvas = fabric.Canvas;
    let constructions = 0;
    let disposals = 0;
    const injectedFabric = {
        ...fabric,
        Canvas: class CountingCanvas extends BaseCanvas {
            constructor(...args) {
                super(...args);
                constructions += 1;
            }

            dispose() {
                disposals += 1;
                return super.dispose();
            }
        },
    };

    const editor = new ImageEditor(injectedFabric, {
        animationDuration: 0,
        showPlaceholder: false,
    });
    assert.equal(constructions, 0);

    editor.init(ids);
    assert.equal(constructions, 1);
    editor.init(ids);
    assert.equal(constructions, 1);

    await editor.disposeAsync();
    assert.equal(disposals, 1);
});

test('Full Facade init failure releases its composition and permits a clean retry', async () => {
    const ids = resetEditorDom();
    const BaseCanvas = fabric.Canvas;
    let attempts = 0;
    const injectedFabric = {
        ...fabric,
        Canvas: class FailingCanvas {
            constructor() {
                attempts += 1;
                throw new Error('injected Canvas construction failure');
            }
        },
    };
    const editor = new ImageEditor(injectedFabric, { showPlaceholder: false });

    assert.throws(() => editor.init(ids), /injected Canvas construction failure/);
    injectedFabric.Canvas = class RetryCanvas extends BaseCanvas {
        constructor(...args) {
            super(...args);
            attempts += 1;
        }
    };
    editor.init(ids);
    assert.equal(attempts, 2);
    await editor.disposeAsync();
});

test('source ownership gate leaves Canvas construction and lifecycle only in Core', async () => {
    const [facadeSource, coreSource] = await Promise.all([
        readFile(new URL('../src/image-editor.ts', import.meta.url), 'utf8'),
        readFile(new URL('../src/core-runtime/image-editor-core.ts', import.meta.url), 'utf8'),
    ]);

    assert.doesNotMatch(facadeSource, /new\s+[^;\n]*\.Canvas\s*\(/);
    assert.doesNotMatch(facadeSource, /attachExistingCanvas|synchronizeCompatibilityImage/);
    assert.doesNotMatch(coreSource, /attachExistingCanvas|synchronizeCompatibilityImage/);
    assert.equal((coreSource.match(/new\s+this\.fabric\.Canvas\s*\(/g) ?? []).length, 1);
});
