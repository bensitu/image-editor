/**
 * Type:
 *   Unit test
 *
 * Purpose:
 *   Verifies src/crop/crop-controller.ts intermediate crop export format
 *   resolution. The suite uses focused Fabric/canvas mocks so assertions can
 *   inspect the exact canvas.toDataURL options applyCrop emits.
 *
 * Scope:
 *   - source-preserving crop defaults for PNG/JPEG/WebP
 *   - PNG fallback for unknown source MIME
 *   - explicit crop.exportFileType overrides and quality handling
 *   - browser-style WebP fallback data URLs are accepted
 *
 * Out of scope:
 *   - pointer interaction details
 *   - visual pixel comparison
 *   - final exportImageBase64/exportImageFile behavior
 *
 * Environment:
 *   - Node.js ESM
 *   - Fabric/canvas behavior is mocked
 *
 * Run:
 *   node --test tests/crop-export-format.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on applyCrop intermediate export format only.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { enterCropMode, applyCrop } = await import('../src/crop/crop-controller.ts');
const { resolveOptions } = await import('../src/core/default-options.ts');
const { HistoryManager } = await import('../src/history/history-manager.ts');

class MockCropRect {
    constructor(props) {
        Object.assign(this, props);
        this.handlers = [];
    }
    set(patch) {
        Object.assign(this, patch);
        return this;
    }
    setCoords() {}
    setControlVisible() {}
    on(event, fn) {
        this.handlers.push({ event, fn });
    }
    off() {}
    getBoundingRect() {
        return {
            left: this.left,
            top: this.top,
            width: this.width * (this.scaleX ?? 1),
            height: this.height * (this.scaleY ?? 1),
        };
    }
}

class MockCanvas {
    constructor({ returnMimeType } = {}) {
        this.objects = [];
        this.width = 200;
        this.height = 150;
        this.selection = true;
        this.toDataURLCalls = [];
        this.returnMimeType = returnMimeType;
    }
    discardActiveObject() {
        return this;
    }
    getObjects() {
        return this.objects.slice();
    }
    add(object) {
        this.objects.push(object);
    }
    remove(object) {
        const index = this.objects.indexOf(object);
        if (index >= 0) this.objects.splice(index, 1);
    }
    bringObjectToFront() {}
    setActiveObject() {
        return this;
    }
    getWidth() {
        return this.width;
    }
    getHeight() {
        return this.height;
    }
    renderAll() {}
    requestRenderAll() {}
    clear() {
        this.objects = [];
    }
    toDataURL(options) {
        this.toDataURLCalls.push({ ...options });
        const mimeType =
            this.returnMimeType ??
            (options.format === 'jpeg' ? 'image/jpeg' : `image/${options.format}`);
        return `data:${mimeType};base64,STUB`;
    }
}

function makeOriginalImage() {
    return {
        type: 'image',
        evented: false,
        selectable: false,
        set(patch) {
            Object.assign(this, patch);
            return this;
        },
        setCoords() {},
        getBoundingRect() {
            return { left: 0, top: 0, width: 120, height: 90 };
        },
    };
}

function makeContext({
    currentImageMimeType = null,
    crop = {},
    downsampleQuality = 0.82,
    returnMimeType,
} = {}) {
    const canvas = new MockCanvas({ returnMimeType });
    const originalImage = makeOriginalImage();
    canvas.add(originalImage);
    const loadedBase64 = [];
    const sessionRef = { current: null };
    const options = resolveOptions({
        downsampleQuality,
        crop: {
            minWidth: 20,
            minHeight: 20,
            padding: 5,
            hideMasksDuringCrop: false,
            preserveMasksAfterCrop: false,
            ...crop,
        },
    });

    const ctx = {
        fabric: { Rect: MockCropRect },
        canvas,
        options,
        historyManager: new HistoryManager(50),
        isImageLoaded: () => true,
        getOriginalImage: () => originalImage,
        getCurrentImageMimeType: () => currentImageMimeType,
        getCropSession: () => sessionRef.current,
        setCropSession: (session) => {
            sessionRef.current = session;
        },
        saveState: () => `snapshot:${canvas.toDataURLCalls.length}`,
        loadFromState: async () => {},
        loadImage: async (base64) => {
            loadedBase64.push(base64);
            canvas.clear();
        },
        updateMaskList: () => {},
    };

    enterCropMode(ctx);
    assert.ok(sessionRef.current, 'enterCropMode must create a session');
    return { ctx, canvas, loadedBase64 };
}

test('applyCrop source mode preserves known source MIME types', async () => {
    const cases = [
        ['image/png', 'png', undefined],
        ['image/jpeg', 'jpeg', 0.82],
        ['image/webp', 'webp', 0.82],
    ];

    for (const [mimeType, expectedFormat, expectedQuality] of cases) {
        const { ctx, canvas, loadedBase64 } = makeContext({ currentImageMimeType: mimeType });

        await applyCrop(ctx);

        assert.equal(canvas.toDataURLCalls[0].format, expectedFormat);
        assert.equal(canvas.toDataURLCalls[0].quality, expectedQuality);
        assert.match(loadedBase64[0], new RegExp(`^data:${mimeType.replace('/', '\\/')}`));
    }
});

test('applyCrop source mode falls back to PNG for unknown source MIME', async () => {
    const { ctx, canvas, loadedBase64 } = makeContext({ currentImageMimeType: null });

    await applyCrop(ctx);

    assert.equal(canvas.toDataURLCalls[0].format, 'png');
    assert.equal('quality' in canvas.toDataURLCalls[0], false);
    assert.match(loadedBase64[0], /^data:image\/png/);
});

test('applyCrop explicit PNG omits lossy quality', async () => {
    const { ctx, canvas } = makeContext({
        currentImageMimeType: 'image/jpeg',
        crop: { exportFileType: 'png', exportQuality: 0.4 },
    });

    await applyCrop(ctx);

    assert.equal(canvas.toDataURLCalls[0].format, 'png');
    assert.equal('quality' in canvas.toDataURLCalls[0], false);
});

test('applyCrop explicit JPEG uses crop.exportQuality before downsampleQuality', async () => {
    const { ctx, canvas } = makeContext({
        currentImageMimeType: 'image/png',
        crop: { exportFileType: 'jpg', exportQuality: 0.37 },
        downsampleQuality: 0.91,
    });

    await applyCrop(ctx);

    assert.equal(canvas.toDataURLCalls[0].format, 'jpeg');
    assert.equal(canvas.toDataURLCalls[0].quality, 0.37);
});

test('applyCrop accepts browser WebP fallback data URL MIME', async () => {
    const { ctx, canvas, loadedBase64 } = makeContext({
        currentImageMimeType: 'image/png',
        crop: { exportFileType: 'webp' },
        returnMimeType: 'image/png',
    });

    await applyCrop(ctx);

    assert.equal(canvas.toDataURLCalls[0].format, 'webp');
    assert.match(loadedBase64[0], /^data:image\/png/);
});
