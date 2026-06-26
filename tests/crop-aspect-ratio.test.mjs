/**
 * Type:
 *   Unit test
 *
 * Purpose:
 *   Verifies crop aspect-ratio normalization and controller rectangle behavior.
 *
 * Scope:
 *   - Preset, custom string, numeric, and object crop ratios normalize to the
 *     controller's internal representation and drive enterCropMode.
 *   - enterCropMode creates the expected initial crop rectangle for free and
 *     locked-ratio sessions.
 *   - Locked-ratio scaling preserves the selected ratio while staying inside
 *     image bounds.
 *   - setCropAspectRatio updates an active crop session and switching back to
 *     free crop allows non-uniform resizing even after entering with a locked
 *     ratio.
 *   - Free crop shows all resize handles while locked-ratio crop hides
 *     middle-edge resize handles.
 *   - applyCrop exports a crop region whose integer dimensions preserve the
 *     selected ratio within rounding tolerance.
 *
 * Out of scope:
 *   - DOM select binding behavior
 *   - visual browser rendering
 *   - transactional image reload behavior after applyCrop
 *
 * Environment:
 *   - Node.js ESM
 *   - lightweight Fabric Rect and canvas stubs
 *   - source TypeScript loaded through the test resolver hook
 *
 * Run:
 *   node --import ./tests/helpers/register-ts-loader.mjs --test tests/crop-aspect-ratio.test.mjs
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { applyCrop, enterCropMode, normalizeCropAspectRatio, setCropAspectRatio } =
    await import('../src/crop/crop-controller.ts');
const { resolveOptions } = await import('../src/core/default-options.ts');

class MockRect {
    constructor(props) {
        Object.assign(this, props);
        this.scaleX = props.scaleX ?? 1;
        this.scaleY = props.scaleY ?? 1;
        this.handlers = new Map();
        this.controlVisibility = {};
    }
    set(patch) {
        Object.assign(this, patch);
        return this;
    }
    setCoords() {}
    setControlVisible(controlKey, isVisible) {
        this.controlVisibility[controlKey] = isVisible;
    }
    setControlsVisibility(controls) {
        Object.assign(this.controlVisibility, controls);
    }
    isControlVisible(controlKey) {
        return this.controlVisibility[controlKey] ?? true;
    }
    on(eventName, callback) {
        const handlers = this.handlers.get(eventName) ?? [];
        handlers.push(callback);
        this.handlers.set(eventName, handlers);
    }
    fire(eventName) {
        for (const callback of this.handlers.get(eventName) ?? []) callback();
    }
}

class MockCanvas {
    constructor(objects) {
        this.objects = objects;
        this.selection = true;
        this.activeObject = null;
        this.renderCalls = 0;
        this.toDataURLCalls = [];
    }
    add(object) {
        this.objects.push(object);
    }
    remove(object) {
        this.objects = this.objects.filter((item) => item !== object);
    }
    bringObjectToFront(object) {
        const index = this.objects.indexOf(object);
        if (index >= 0) this.objects.splice(index, 1);
        this.objects.push(object);
    }
    setActiveObject(object) {
        this.activeObject = object;
    }
    discardActiveObject() {
        this.activeObject = null;
    }
    getObjects() {
        return this.objects;
    }
    getWidth() {
        return 1000;
    }
    getHeight() {
        return 1000;
    }
    toDataURL(options) {
        this.toDataURLCalls.push({ ...options });
        return 'data:image/png;base64,cropped';
    }
    requestRenderAll() {
        this.renderCalls += 1;
    }
    renderAll() {
        this.renderCalls += 1;
    }
}

function makeOriginalImage(rect) {
    return {
        editorObjectKind: 'baseImage',
        setCoords() {},
        getBoundingRect() {
            return { ...rect };
        },
        set(patch) {
            Object.assign(this, patch);
        },
    };
}

function makeContext({ imageRect = { left: 0, top: 0, width: 300, height: 200 }, crop = {} } = {}) {
    const originalImage = makeOriginalImage(imageRect);
    const canvas = new MockCanvas([originalImage]);
    let session = null;
    const historyEntries = [];
    const loadedImages = [];

    return {
        context: {
            fabric: { Rect: MockRect },
            canvas,
            options: resolveOptions({ crop }),
            historyManager: {
                push: (command) => {
                    historyEntries.push(command);
                },
            },
            isImageLoaded: () => true,
            getOriginalImage: () => originalImage,
            getCurrentImageMimeType: () => 'image/png',
            getCropSession: () => session,
            setCropSession: (nextSession) => {
                session = nextSession;
            },
            saveState: () => `snapshot:${canvas.toDataURLCalls.length}`,
            loadFromState: async () => {},
            loadImage: async (imageBase64) => {
                loadedImages.push(imageBase64);
            },
        },
        getSession: () => session,
        canvas,
        historyEntries,
        loadedImages,
    };
}

function assertApprox(actual, expected, message, epsilon = 1e-6) {
    assert.ok(
        Math.abs(actual - expected) <= epsilon,
        `${message}: expected ${expected}, got ${actual}`,
    );
}

function effectiveRatio(rect) {
    return (rect.width * rect.scaleX) / (rect.height * rect.scaleY);
}

const CORNER_CONTROLS = ['tl', 'tr', 'br', 'bl'];
const MIDDLE_EDGE_CONTROLS = ['mt', 'mb', 'ml', 'mr'];

function assertCropControls(rect, { middleEdgesVisible, rotationVisible }) {
    for (const controlKey of CORNER_CONTROLS) {
        assert.equal(rect.isControlVisible(controlKey), true, `${controlKey} control visibility`);
    }
    for (const controlKey of MIDDLE_EDGE_CONTROLS) {
        assert.equal(
            rect.isControlVisible(controlKey),
            middleEdgesVisible,
            `${controlKey} control visibility`,
        );
    }
    assert.equal(rect.isControlVisible('mtr'), rotationVisible, 'mtr control visibility');
}

test('normalizeCropAspectRatio resolves presets, custom ratios, and invalid values', () => {
    const cases = [
        ['free', null],
        ['1:1', 1],
        ['3:4', 3 / 4],
        ['4:3', 4 / 3],
        ['3:2', 3 / 2],
        ['2:3', 2 / 3],
        ['9:16', 9 / 16],
        ['16:9', 16 / 9],
        [10 / 7, 10 / 7],
        ['10:7', 10 / 7],
        [{ width: 10, height: 7 }, 10 / 7],
    ];

    for (const [input, expected] of cases) {
        const actual = normalizeCropAspectRatio(input);
        if (expected === null) {
            assert.equal(actual, null);
        } else {
            assertApprox(actual, expected, `ratio for ${JSON.stringify(input)}`);
        }
    }

    for (const invalid of [0, -1, NaN, Infinity, '0:1', '1:0', 'bad', {}, { width: 5 }]) {
        assert.equal(normalizeCropAspectRatio(invalid), null);
    }
});

test('each crop aspect-ratio preset creates the expected initial ratio', () => {
    const cases = [
        ['free', null],
        ['1:1', 1],
        ['3:4', 3 / 4],
        ['4:3', 4 / 3],
        ['3:2', 3 / 2],
        ['2:3', 2 / 3],
        ['9:16', 9 / 16],
        ['16:9', 16 / 9],
    ];

    for (const [aspectRatio, expected] of cases) {
        const { context, getSession } = makeContext({
            imageRect: { left: 20, top: 30, width: 360, height: 240 },
            crop: { minWidth: 40, minHeight: 30, padding: 12 },
        });

        enterCropMode(context, { aspectRatio });

        const rect = getSession().cropRect;
        if (expected === null) {
            assert.equal(getSession().aspectRatio, null);
            assert.equal(rect.width, 336);
            assert.equal(rect.height, 216);
            assertCropControls(rect, { middleEdgesVisible: true, rotationVisible: false });
        } else {
            assertApprox(getSession().aspectRatio, expected, `${aspectRatio} session ratio`);
            assertApprox(rect.width / rect.height, expected, `${aspectRatio} rectangle ratio`);
            assertCropControls(rect, { middleEdgesVisible: false, rotationVisible: false });
        }
        assert.ok(rect.left >= 20, `${aspectRatio} left stays in image bounds`);
        assert.ok(rect.top >= 30, `${aspectRatio} top stays in image bounds`);
        assert.ok(rect.left + rect.width <= 380 + 1e-6, `${aspectRatio} right stays in bounds`);
        assert.ok(rect.top + rect.height <= 270 + 1e-6, `${aspectRatio} bottom stays in bounds`);
    }
});

test('custom crop aspect-ratio inputs drive enterCropMode', () => {
    const cases = [5 / 7, '5:7', { width: 5, height: 7 }];

    for (const aspectRatio of cases) {
        const { context, getSession } = makeContext({
            imageRect: { left: 0, top: 0, width: 350, height: 280 },
            crop: { padding: 10 },
        });

        enterCropMode(context, { aspectRatio });

        const rect = getSession().cropRect;
        assertApprox(rect.width / rect.height, 5 / 7, `ratio for ${JSON.stringify(aspectRatio)}`);
        assertCropControls(rect, { middleEdgesVisible: false, rotationVisible: false });
    }
});

test('crop control visibility preserves rotation handle configuration', () => {
    const disabledRotation = makeContext({
        crop: { allowRotationOfCropRect: false },
    });
    enterCropMode(disabledRotation.context);
    assertCropControls(disabledRotation.getSession().cropRect, {
        middleEdgesVisible: true,
        rotationVisible: false,
    });

    const enabledRotation = makeContext({
        crop: { allowRotationOfCropRect: true },
    });
    enterCropMode(enabledRotation.context, { aspectRatio: '1:1' });
    assertCropControls(enabledRotation.getSession().cropRect, {
        middleEdgesVisible: false,
        rotationVisible: true,
    });
});

test('locked-ratio crop prioritizes fitting the image when min size cannot fit', () => {
    const { context, getSession } = makeContext({
        imageRect: { left: 0, top: 0, width: 80, height: 40 },
        crop: { minWidth: 100, minHeight: 100, padding: 10 },
    });

    enterCropMode(context, { aspectRatio: '16:9' });

    const rect = getSession().cropRect;
    assertApprox(rect.width / rect.height, 16 / 9, 'small image ratio');
    assert.ok(rect.width <= 80, 'width fits inside image');
    assert.ok(rect.height <= 40, 'height fits inside image');
    assert.ok(rect.left >= 0, 'left stays in image bounds');
    assert.ok(rect.top >= 0, 'top stays in image bounds');
    assert.ok(rect.left + rect.width <= 80 + 1e-6, 'right stays in image bounds');
    assert.ok(rect.top + rect.height <= 40 + 1e-6, 'bottom stays in image bounds');
});

test('enterCropMode without ratio starts with the padded image rectangle', () => {
    const { context, getSession } = makeContext({
        imageRect: { left: 10, top: 20, width: 300, height: 200 },
        crop: { minWidth: 80, minHeight: 60, padding: 10 },
    });

    enterCropMode(context);

    const rect = getSession().cropRect;
    assert.equal(rect.left, 20);
    assert.equal(rect.top, 30);
    assert.equal(rect.width, 280);
    assert.equal(rect.height, 180);
});

test('enterCropMode creates the largest centered preset-ratio rectangle inside padded image bounds', () => {
    const { context, getSession } = makeContext({
        imageRect: { left: 0, top: 0, width: 300, height: 200 },
        crop: { padding: 10 },
    });

    enterCropMode(context, { aspectRatio: '1:1' });

    const rect = getSession().cropRect;
    assertApprox(rect.width, 180, 'square width');
    assertApprox(rect.height, 180, 'square height');
    assertApprox(rect.left, 60, 'square left');
    assertApprox(rect.top, 10, 'square top');
});

test('enterCropMode uses per-call ratio before constructor crop.aspectRatio', () => {
    const { context, getSession } = makeContext({
        imageRect: { left: 0, top: 0, width: 400, height: 300 },
        crop: { aspectRatio: '1:1', padding: 0 },
    });

    enterCropMode(context, { aspectRatio: '4:3' });

    const rect = getSession().cropRect;
    assertApprox(rect.width / rect.height, 4 / 3, 'per-call ratio');
});

test('locked-ratio crop resizing preserves local width/height ratio and image bounds', () => {
    const { context, getSession } = makeContext({
        imageRect: { left: 0, top: 0, width: 300, height: 200 },
        crop: { minWidth: 100, minHeight: 100, padding: 10 },
    });

    enterCropMode(context, { aspectRatio: '16:9' });

    const rect = getSession().cropRect;
    rect.__corner = 'mb';
    rect.scaleY = 0.5;
    rect.fire('scaling');

    assertApprox(effectiveRatio(rect), 16 / 9, 'resized ratio');
    assert.ok(rect.left >= 0, 'left stays in image bounds');
    assert.ok(rect.top >= 0, 'top stays in image bounds');
    assert.ok(rect.left + rect.width * rect.scaleX <= 300 + 1e-6, 'right stays in image bounds');
    assert.ok(rect.top + rect.height * rect.scaleY <= 200 + 1e-6, 'bottom stays in image bounds');
});

test('setCropAspectRatio updates the active crop rectangle and unlocks free crop', () => {
    const { context, getSession } = makeContext({
        imageRect: { left: 0, top: 0, width: 300, height: 200 },
        crop: { minWidth: 50, minHeight: 50, padding: 10 },
    });

    enterCropMode(context, { aspectRatio: '1:1' });
    const session = getSession();
    const rect = session.cropRect;

    setCropAspectRatio(context, '16:9');
    assert.equal(session.aspectRatio, 16 / 9);
    assertCropControls(rect, { middleEdgesVisible: false, rotationVisible: false });
    assertApprox(rect.width, 280, '16:9 width');
    assertApprox(rect.height, 157.5, '16:9 height');
    assertApprox(rect.left, 10, '16:9 centered left');
    assertApprox(rect.top, 21.25, '16:9 centered top');
    assert.equal(context.canvas.activeObject, rect);

    setCropAspectRatio(context, 'free');
    assert.equal(session.aspectRatio, null);
    assertCropControls(rect, { middleEdgesVisible: true, rotationVisible: false });
    rect.set({ scaleX: 0.5, scaleY: 1 });
    rect.fire('scaling');

    assertApprox(effectiveRatio(rect), 8 / 9, 'free crop allows non-uniform resizing');
    assert.equal(rect.scaleX, 0.5);
    assert.equal(rect.scaleY, 1);
    assert.ok(rect.left + rect.width * rect.scaleX <= 300 + 1e-6, 'free right stays in bounds');
    assert.ok(rect.top + rect.height * rect.scaleY <= 200 + 1e-6, 'free bottom stays in bounds');
});

test('applyCrop exports a crop region that matches the selected aspect ratio', async () => {
    const { context, canvas, historyEntries, loadedImages } = makeContext({
        imageRect: { left: 0, top: 0, width: 400, height: 300 },
        crop: { padding: 0 },
    });

    enterCropMode(context, { aspectRatio: '16:9' });
    await applyCrop(context);

    assert.equal(canvas.toDataURLCalls.length, 1);
    const exportRegion = canvas.toDataURLCalls[0];
    assertApprox(exportRegion.width / exportRegion.height, 16 / 9, 'exported crop ratio', 0.01);
    assert.equal(loadedImages[0], 'data:image/png;base64,cropped');
    assert.equal(historyEntries.length, 1);
    assert.equal(context.getCropSession(), null);
});
