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

function assertFitGeometry(info) {
    assert.equal(info.canvasWidth, 400);
    assert.equal(info.canvasHeight, 300);
    assertApproximatelyEqual(info.displayWidth, 375);
    assertApproximatelyEqual(info.displayHeight, 300);
}

function assertCoverGeometry(info) {
    assert.equal(info.canvasWidth, 401);
    assert.equal(info.canvasHeight, 321);
    assertApproximatelyEqual(info.displayWidth, 401);
    assertApproximatelyEqual(info.displayHeight, 321);
}

function assertExpandGeometry(info) {
    assert.equal(info.canvasWidth, SOURCE_IMAGE.width);
    assert.equal(info.canvasHeight, SOURCE_IMAGE.height);
    assertApproximatelyEqual(info.displayWidth, SOURCE_IMAGE.width);
    assertApproximatelyEqual(info.displayHeight, SOURCE_IMAGE.height);
}

function getDataUrlDimensions(dataUrl) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.width, height: image.height });
        image.onerror = reject;
        image.src = dataUrl;
    });
}

test("defaultLayoutMode: 'fit' affects the first load", async (t) => {
    const { editor, loadedInfos } = createSourceEditor({ defaultLayoutMode: 'fit' });
    t.after(() => disposeEditor(editor));

    await editor.loadImage(makeImageDataUrl(SOURCE_IMAGE));

    assertFitGeometry(lastLoadedInfo(loadedInfos));
});

test("defaultLayoutMode: 'cover' affects the first load", async (t) => {
    const { editor, loadedInfos } = createSourceEditor({ defaultLayoutMode: 'cover' });
    t.after(() => disposeEditor(editor));

    await editor.loadImage(makeImageDataUrl(SOURCE_IMAGE));

    assertCoverGeometry(lastLoadedInfo(loadedInfos));
});

test("defaultLayoutMode: 'expand' affects the first load", async (t) => {
    const { editor, loadedInfos } = createSourceEditor({ defaultLayoutMode: 'expand' });
    t.after(() => disposeEditor(editor));

    await editor.loadImage(makeImageDataUrl(SOURCE_IMAGE));

    assertExpandGeometry(lastLoadedInfo(loadedInfos));
});

test('omitted defaultLayoutMode uses expand for the first load', async (t) => {
    const { editor, loadedInfos } = createSourceEditor();
    t.after(() => disposeEditor(editor));

    await editor.loadImage(makeImageDataUrl(SOURCE_IMAGE));

    assertExpandGeometry(lastLoadedInfo(loadedInfos));
});

test('invalid defaultLayoutMode warns and falls back to expand for the first load', async (t) => {
    const { editor, loadedInfos, warnings } = createSourceEditor({
        defaultLayoutMode: 'stretch',
    });
    t.after(() => disposeEditor(editor));

    await editor.loadImage(makeImageDataUrl(SOURCE_IMAGE));

    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].error instanceof TypeError);
    assert.match(warnings[0].message, /defaultLayoutMode/i);
    assertExpandGeometry(lastLoadedInfo(loadedInfos));
});

test('setLayoutMode selects fit, cover, and expand behavior for future image loads', async (t) => {
    const { editor, loadedInfos } = createSourceEditor({ defaultLayoutMode: 'expand' });
    t.after(() => disposeEditor(editor));
    const imageBase64 = makeImageDataUrl(SOURCE_IMAGE);

    editor.setLayoutMode('fit');
    await editor.loadImage(imageBase64);
    assertFitGeometry(lastLoadedInfo(loadedInfos));

    editor.setLayoutMode('cover');
    await editor.loadImage(imageBase64);
    assertCoverGeometry(lastLoadedInfo(loadedInfos));

    editor.setLayoutMode('expand');
    await editor.loadImage(imageBase64);
    assertExpandGeometry(lastLoadedInfo(loadedInfos));
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
    assertFitGeometry(info);
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
            mergeMasks: false,
        }),
    );

    editor.setLayoutMode('cover');
    const after = await getDataUrlDimensions(
        await editor.exportImageBase64({
            exportArea: 'canvas',
            fileType: 'png',
            mergeMasks: false,
        }),
    );

    assert.deepEqual(after, before);
});
