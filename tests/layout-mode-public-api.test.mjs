/**
 * Type:
 *   Integration-style unit test
 *
 * Purpose:
 *   Verifies ImageEditor.setLayoutMode exposes layout strategy selection through
 *   the public API, without requiring consumers or tests to read private options.
 *
 * Scope:
 *   - Each public mode affects the next loadImage() call.
 *   - Invalid JavaScript input is ignored and reported through onWarning.
 *   - Calling setLayoutMode() does not immediately re-layout the loaded image.
 *
 * Out of scope:
 *   - detailed layout math, which is covered by layout-manager property tests
 *   - browser-specific visual rendering
 *
 * Environment:
 *   - Node.js ESM
 *   - jsdom + node-canvas Fabric environment from tests/helpers
 *
 * Run:
 *   node --import ./tests/helpers/register-ts-loader.mjs --test tests/layout-mode-public-api.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    disposeEditor,
    fabric,
    installFabricDom,
    makeImageDataUrl,
    resetEditorDom,
} from './helpers/fabric-environment.mjs';

const { ImageEditor } = await import('../src/image-editor.ts');

const SOURCE_IMAGE = Object.freeze({ width: 1000, height: 800 });
const VIEWPORT = Object.freeze({ containerWidth: 401, containerHeight: 301 });

function createSourceEditor(options = {}) {
    installFabricDom();
    const ids = resetEditorDom(VIEWPORT);
    const loadedInfos = [];
    const warnings = [];
    const editor = new ImageEditor(fabric, {
        canvasWidth: 320,
        canvasHeight: 240,
        animationDuration: 0,
        showPlaceholder: false,
        downsampleOnLoad: false,
        onImageLoaded: (info) => loadedInfos.push(info),
        onWarning: (error, message) => warnings.push({ error, message }),
        ...options,
    });
    editor.init(ids);
    return { editor, loadedInfos, warnings };
}

function lastLoadedInfo(loadedInfos) {
    assert.ok(loadedInfos.length > 0, 'expected at least one onImageLoaded callback');
    return loadedInfos[loadedInfos.length - 1];
}

function assertApproximatelyEqual(actual, expected, epsilon = 1) {
    assert.ok(
        Math.abs(actual - expected) <= epsilon,
        `expected ${actual} to be within ${epsilon} of ${expected}`,
    );
}

function getDataUrlDimensions(dataUrl) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.width, height: image.height });
        image.onerror = reject;
        image.src = dataUrl;
    });
}

test('setLayoutMode selects fit, cover, and expand behavior for future image loads', async (t) => {
    const { editor, loadedInfos } = createSourceEditor({
        fitImageToCanvas: false,
        coverImageToCanvas: false,
        expandCanvasToImage: true,
    });
    t.after(() => disposeEditor(editor));
    const imageBase64 = makeImageDataUrl(SOURCE_IMAGE);

    editor.setLayoutMode('fit');
    await editor.loadImage(imageBase64);
    const fitInfo = lastLoadedInfo(loadedInfos);
    assert.equal(fitInfo.canvasWidth, 400);
    assert.equal(fitInfo.canvasHeight, 300);
    assertApproximatelyEqual(fitInfo.displayWidth, 375);
    assertApproximatelyEqual(fitInfo.displayHeight, 300);

    editor.setLayoutMode('cover');
    await editor.loadImage(imageBase64);
    const coverInfo = lastLoadedInfo(loadedInfos);
    assert.equal(coverInfo.canvasWidth, 401);
    assert.equal(coverInfo.canvasHeight, 321);
    assertApproximatelyEqual(coverInfo.displayWidth, 401);
    assertApproximatelyEqual(coverInfo.displayHeight, 321);

    editor.setLayoutMode('expand');
    await editor.loadImage(imageBase64);
    const expandInfo = lastLoadedInfo(loadedInfos);
    assert.equal(expandInfo.canvasWidth, SOURCE_IMAGE.width);
    assert.equal(expandInfo.canvasHeight, SOURCE_IMAGE.height);
    assertApproximatelyEqual(expandInfo.displayWidth, SOURCE_IMAGE.width);
    assertApproximatelyEqual(expandInfo.displayHeight, SOURCE_IMAGE.height);
});

test('invalid setLayoutMode input warns and preserves the previous layout mode', async (t) => {
    const { editor, loadedInfos, warnings } = createSourceEditor();
    t.after(() => disposeEditor(editor));
    const imageBase64 = makeImageDataUrl(SOURCE_IMAGE);

    editor.setLayoutMode('fit');
    editor.setLayoutMode('stretch');
    await editor.loadImage(imageBase64);
    const info = lastLoadedInfo(loadedInfos);

    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].error instanceof TypeError);
    assert.match(warnings[0].message, /layout mode/i);
    assert.equal(info.canvasWidth, 400);
    assert.equal(info.canvasHeight, 300);
    assertApproximatelyEqual(info.displayWidth, 375);
    assertApproximatelyEqual(info.displayHeight, 300);
});

test('setLayoutMode does not immediately relayout an already loaded image', async (t) => {
    const { editor } = createSourceEditor();
    t.after(() => disposeEditor(editor));
    const imageBase64 = makeImageDataUrl(SOURCE_IMAGE);

    editor.setLayoutMode('fit');
    await editor.loadImage(imageBase64);
    const before = await getDataUrlDimensions(
        await editor.exportImageBase64({
            exportArea: 'canvas',
            fileType: 'png',
            mergeMask: false,
        }),
    );

    editor.setLayoutMode('cover');
    const after = await getDataUrlDimensions(
        await editor.exportImageBase64({
            exportArea: 'canvas',
            fileType: 'png',
            mergeMask: false,
        }),
    );

    assert.deepEqual(after, before);
});
