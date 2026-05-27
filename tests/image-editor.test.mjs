import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    createEditor,
    disposeEditor,
    fabric,
    getImageDimensionsFromDataUrl,
    loadFixtureImage,
    makeImageDataUrl,
    waitForCanvasCallbacks
} from './helpers/fabric-environment.mjs';

function dataUrlToFile(dataUrl, fileName = 'fixture.png') {
    const [header, base64Payload] = dataUrl.split(',');
    const mime = (header.match(/^data:([^;]+);base64$/) || [])[1] || 'image/png';
    const bytes = Uint8Array.from(atob(base64Payload), char => char.charCodeAt(0));
    return new File([bytes], fileName, { type: mime });
}

function makeEdgeBorderImageDataUrl({
    width = 100,
    height = 200,
    fill = '#ffffff',
    right = true,
    bottom = false,
    edgeColor = '#000000'
} = {}) {
    const canvas = fabric.document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.fillStyle = fill;
    context.fillRect(0, 0, width, height);
    context.fillStyle = edgeColor;
    if (right) context.fillRect(width - 1, 0, 1, height);
    if (bottom) context.fillRect(0, height - 1, width, 1);
    return canvas.toDataURL('image/png');
}

async function getEdgeAverageLuminance(dataUrl, edge) {
    const imageElement = new Image();
    await new Promise((resolve, reject) => {
        imageElement.onload = resolve;
        imageElement.onerror = reject;
        imageElement.src = dataUrl;
    });
    const canvas = fabric.document.createElement('canvas');
    canvas.width = imageElement.width;
    canvas.height = imageElement.height;
    const context = canvas.getContext('2d');
    context.drawImage(imageElement, 0, 0);
    const imageData = edge === 'bottom'
        ? context.getImageData(0, canvas.height - 1, canvas.width, 1).data
        : context.getImageData(canvas.width - 1, 0, 1, canvas.height).data;
    let luminanceSum = 0;
    for (let index = 0; index < imageData.length; index += 4) {
        luminanceSum += (imageData[index] + imageData[index + 1] + imageData[index + 2]) / 3;
    }
    return luminanceSum / (imageData.length / 4);
}

async function waitForCondition(predicate, timeoutMs = 3000) {
    const start = Date.now();
    while (!predicate()) {
        if (Date.now() - start > timeoutMs) {
            assert.fail('Timed out waiting for condition');
        }
        await waitForCanvasCallbacks(25);
    }
}

function createDeferred() {
    let resolve;
    let reject;
    const promise = new Promise((promiseResolve, promiseReject) => {
        resolve = promiseResolve;
        reject = promiseReject;
    });
    return { promise, resolve, reject };
}

test('constructor preserves nested label and crop options while keeping defaults', async (t) => {
    const { editor } = await createEditor({
        label: {
            getText: () => 'custom-label',
            textOptions: {
                fontSize: 20,
                fill: '#abcabc'
            }
        },
        crop: {
            minWidth: 50,
            preserveMasksAfterCrop: true
        }
    });
    t.after(() => disposeEditor(editor));

    assert.equal(editor.options.label.getText({ maskName: 'fallback' }), 'custom-label');
    assert.equal(editor.options.label.textOptions.fontSize, 20);
    assert.equal(editor.options.label.textOptions.fill, '#abcabc');
    assert.equal(editor.options.label.textOptions.backgroundColor, 'rgba(0,0,0,0.7)');
    assert.equal(editor.options.crop.minWidth, 50);
    assert.equal(editor.options.crop.minHeight, 100);
    assert.equal(editor.options.crop.preserveMasksAfterCrop, true);
});

test('init wires DOM elements and default UI state before an image is loaded', async (t) => {
    const { editor, ids } = await createEditor();
    t.after(() => disposeEditor(editor));

    assert.equal(editor.canvas.getWidth(), 320);
    assert.equal(editor.canvas.getHeight(), 240);
    assert.equal(document.getElementById(ids.addMaskBtn).disabled, true);
    assert.equal(document.getElementById(ids.cropBtn).disabled, true);
    assert.equal(document.getElementById(ids.downloadBtn).disabled, true);
});

test('placeholder visibility uses standard DOM state without Bootstrap CSS', async (t) => {
    const { editor, ids } = await createEditor();
    t.after(() => disposeEditor(editor));
    const placeholderElement = document.getElementById(ids.imgPlaceholder);
    const containerElement = document.getElementById(ids.canvasContainer);

    placeholderElement.className = 'd-none';
    containerElement.className = '';

    editor._setPlaceholderVisible(true);

    assert.equal(placeholderElement.hidden, false);
    assert.equal(placeholderElement.getAttribute('aria-hidden'), 'false');
    assert.equal(placeholderElement.classList.contains('d-none'), false);
    assert.equal(containerElement.hidden, true);
    assert.equal(containerElement.getAttribute('aria-hidden'), 'true');
    assert.equal(containerElement.classList.contains('d-none'), true);

    editor._setPlaceholderVisible(false);

    assert.equal(placeholderElement.hidden, true);
    assert.equal(placeholderElement.getAttribute('aria-hidden'), 'true');
    assert.equal(placeholderElement.classList.contains('d-none'), true);
    assert.equal(containerElement.hidden, false);
    assert.equal(containerElement.getAttribute('aria-hidden'), 'false');
    assert.equal(containerElement.classList.contains('d-none'), false);
});

test('placeholder visibility does not hide a shared canvas parent', async (t) => {
    const { editor, ids } = await createEditor({ showPlaceholder: false });
    t.after(() => disposeEditor(editor));
    const placeholderElement = document.getElementById(ids.imgPlaceholder);
    const containerElement = document.getElementById(ids.canvasContainer);

    containerElement.appendChild(placeholderElement);
    editor.placeholderElement = placeholderElement;
    editor._setPlaceholderVisible(true);

    assert.equal(containerElement.hidden, false);
    assert.equal(placeholderElement.hidden, false);
    assert.equal(editor.canvas.wrapperEl.hidden, true);
});

test('disposing restores Bootstrap visibility and canvas inline sizing', async (t) => {
    const { editor, ids } = await createEditor({ showPlaceholder: false });
    const placeholderElement = document.getElementById(ids.imgPlaceholder);
    const containerElement = document.getElementById(ids.canvasContainer);
    const canvasElement = document.getElementById(ids.canvas);

    placeholderElement.className = 'd-flex custom-placeholder';
    canvasElement.style.maxWidth = '100%';
    editor._setPlaceholderVisible(false);
    editor._setCanvasSizeInt(123, 77);

    editor.dispose();
    t.after(() => disposeEditor(editor));

    assert.equal(placeholderElement.className, 'd-flex custom-placeholder');
    assert.equal(containerElement.classList.contains('d-none'), false);
    assert.equal(canvasElement.style.maxWidth, '100%');
});

test('non-form disabled state restores original inline pointer events', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    const customElement = document.createElement('div');
    customElement.id = 'custom-pointer-target';
    customElement.style.pointerEvents = 'auto';
    document.body.appendChild(customElement);
    editor.elements.customPointerTarget = customElement.id;

    editor._setDisabled('customPointerTarget', true);
    assert.equal(customElement.style.pointerEvents, 'none');
    assert.equal(customElement.getAttribute('aria-disabled'), 'true');

    editor._setDisabled('customPointerTarget', false);
    assert.equal(customElement.style.pointerEvents, 'auto');
    assert.equal(customElement.hasAttribute('aria-disabled'), false);
});

test('image readiness waits use event listeners without replacing existing handlers', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    const existingLoadHandler = () => {};
    const listeners = new Map();
    const imageElement = {
        complete: false,
        naturalWidth: 0,
        width: 0,
        onload: existingLoadHandler,
        onerror: null,
        addEventListener(eventName, handler) {
            listeners.set(eventName, handler);
        },
        removeEventListener(eventName, handler) {
            if (listeners.get(eventName) === handler) listeners.delete(eventName);
        }
    };

    const readyPromise = editor._waitForImageElementReady(imageElement);
    assert.equal(imageElement.onload, existingLoadHandler);
    assert.equal(typeof listeners.get('load'), 'function');

    imageElement.naturalWidth = 10;
    imageElement.naturalHeight = 10;
    listeners.get('load')();
    await readyPromise;
    assert.equal(listeners.has('load'), false);
    assert.equal(listeners.has('error'), false);
});

test('image readiness rejects completed broken images with no dimensions', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));

    await assert.rejects(
        () => editor._waitForImageElementReady({
            complete: true,
            naturalWidth: 0,
            naturalHeight: 0,
            width: 0,
            height: 0
        }),
        /Image could not be loaded/
    );
});

test('loadImage ignores invalid input and resolves only after a valid image is on canvas', async (t) => {
    let loadedCount = 0;
    const { editor } = await createEditor({
        onImageLoaded: () => {
            loadedCount += 1;
        }
    });
    t.after(() => disposeEditor(editor));

    await editor.loadImage('not-an-image');
    assert.equal(editor.isImageLoaded(), false);
    assert.equal(loadedCount, 0);

    await editor.loadImage(makeImageDataUrl({ width: 80, height: 60 }));
    assert.equal(editor.isImageLoaded(), true);
    assert.equal(editor.isImageLoadedToCanvas, true);
    assert.equal(editor.originalImage.width, 80);
    assert.equal(editor.originalImage.height, 60);
    assert.equal(editor.canvas.getObjects().filter(object => object.type === 'image').length, 1);
    assert.equal(loadedCount, 1);
});

test('loadImage marks the editor busy and blocks overlapping public operations', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);
    const mask = editor.createMask({ width: 20, height: 20 });
    const originalCreateImageElement = editor._createImageElement.bind(editor);
    const releaseImageDecode = createDeferred();
    let delayedLoadStarted = false;

    editor._createImageElement = async (...args) => {
        delayedLoadStarted = true;
        await releaseImageDecode.promise;
        return originalCreateImageElement(...args);
    };

    const loadPromise = editor.loadImage(makeImageDataUrl({ width: 90, height: 70 }));
    await waitForCondition(() => delayedLoadStarted && editor._isLoading === true);

    await assert.rejects(
        () => editor.loadImage(makeImageDataUrl({ width: 40, height: 30 })),
        /image is loading/
    );
    await assert.rejects(
        () => editor.scaleImage(1.2),
        /image is loading/
    );
    await assert.rejects(
        () => editor.rotateImage(45),
        /image is loading/
    );
    await assert.rejects(
        () => editor.exportImageBase64(),
        /image is loading/
    );
    assert.equal(editor.createMask({ width: 10, height: 10 }), null);
    assert.equal(editor.maskCounter, mask.maskId);

    releaseImageDecode.resolve();
    await loadPromise;
    assert.equal(editor._isLoading, false);
    assert.equal(editor.isImageLoaded(), true);
});

test('loadImage clears the loading flag after load and rollback failures', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);
    const originalCreateImageElement = editor._createImageElement.bind(editor);
    const originalRollback = editor._rollbackLoadImageTransaction.bind(editor);

    editor._createImageElement = async () => {
        throw new Error('forced decode failure');
    };

    await assert.rejects(
        () => editor.loadImage(makeImageDataUrl({ width: 40, height: 30 })),
        /forced decode failure/
    );
    assert.equal(editor._isLoading, false);

    editor._rollbackLoadImageTransaction = async () => {
        throw new Error('forced rollback failure');
    };

    await assert.rejects(
        () => editor.loadImage(makeImageDataUrl({ width: 40, height: 30 })),
        /forced rollback failure/
    );
    assert.equal(editor._isLoading, false);

    editor._createImageElement = originalCreateImageElement;
    editor._rollbackLoadImageTransaction = originalRollback;
});

test('loadImage rolls back canvas, placeholder, and overflow when Fabric image creation fails', async (t) => {
    const { editor, ids } = await createEditor({
        showPlaceholder: true,
        coverImageToCanvas: true,
        expandCanvasToImage: false
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor, { width: 80, height: 60 });
    const originalImage = editor.originalImage;
    const mask = editor.createMask({ width: 20, height: 20 });
    const containerElement = document.getElementById(ids.canvasContainer);
    const placeholderElement = document.getElementById(ids.imgPlaceholder);

    const originalFromURL = fabric.Image.fromURL;
    fabric.Image.fromURL = (source, callback) => callback(null);
    t.after(() => {
        fabric.Image.fromURL = originalFromURL;
    });

    await assert.rejects(
        () => editor.loadImage(makeImageDataUrl({ width: 40, height: 30 })),
        /Image could not be loaded/
    );

    assert.equal(editor.originalImage.type, originalImage.type);
    assert.equal(editor.isImageLoadedToCanvas, true);
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 1);
    assert.equal(editor.canvas.getObjects().find(object => object.maskId).maskId, mask.maskId);
    assert.equal(containerElement.hidden, false);
    assert.equal(placeholderElement.hidden, true);
    assert.equal(containerElement.style.overflow, 'scroll');
});

test('loadImage rollback does not replace the original container overflow captured for dispose', async (t) => {
    const { editor, ids } = await createEditor({
        coverImageToCanvas: true,
        expandCanvasToImage: false
    });
    const containerElement = document.getElementById(ids.canvasContainer);
    containerElement.style.overflow = '';
    await loadFixtureImage(editor, { width: 80, height: 160 });
    assert.equal(containerElement.style.overflow, 'scroll');

    const originalFromURL = fabric.Image.fromURL;
    fabric.Image.fromURL = (source, callback) => callback(null);
    t.after(() => {
        fabric.Image.fromURL = originalFromURL;
        disposeEditor(editor);
    });

    await assert.rejects(
        () => editor.loadImage(makeImageDataUrl({ width: 40, height: 30 })),
        /Image could not be loaded/
    );
    assert.equal(containerElement.style.overflow, 'scroll');

    editor.dispose();
    assert.equal(containerElement.style.overflow, '');
});

test('loadImage warns when mutually exclusive layout modes are enabled together', async (t) => {
    const warnings = [];
    const { editor } = await createEditor({
        fitImageToCanvas: true,
        coverImageToCanvas: true,
        expandCanvasToImage: false,
        onWarning: (error, message) => warnings.push({ error, message })
    });
    t.after(() => disposeEditor(editor));

    await editor.loadImage(makeImageDataUrl({ width: 80, height: 60 }));

    assert.equal(warnings.length, 1);
    assert.match(warnings[0].message, /Only one image layout mode should be enabled/);
    assert.match(warnings[0].message, /fitImageToCanvas/);
    assert.match(warnings[0].message, /coverImageToCanvas/);
});

test('loadImage resets cover-canvas scroll position when replacing an image explicitly', async (t) => {
    const { editor, ids } = await createEditor({
        canvasWidth: 120,
        canvasHeight: 80,
        coverImageToCanvas: true,
        expandCanvasToImage: false
    });
    t.after(() => disposeEditor(editor));
    const container = document.getElementById(ids.canvasContainer);

    await loadFixtureImage(editor, { width: 120, height: 200 });
    container.scrollLeft = 5;
    container.scrollTop = 31;

    await editor.loadImage(makeImageDataUrl({ width: 80, height: 80 }));

    assert.equal(container.scrollLeft, 0);
    assert.equal(container.scrollTop, 0);
});

test('image element creation rejects when decoding exceeds the configured timeout', async (t) => {
    const { editor } = await createEditor({ imageLoadTimeoutMs: 1 });
    t.after(() => disposeEditor(editor));

    const originalImage = globalThis.Image;
    class NeverLoadingImage {
        set src(value) {
            this._src = value;
        }

        get src() {
            return this._src;
        }
    }
    globalThis.Image = NeverLoadingImage;
    t.after(() => {
        globalThis.Image = originalImage;
    });

    await assert.rejects(
        () => editor._createImageElement('data:image/png;base64,AAAA', 1),
        /Image load timed out/
    );
});

test('loadImage downsamples images that exceed configured dimensions', async (t) => {
    const { editor } = await createEditor({
        downsampleOnLoad: true,
        downsampleMaxWidth: 40,
        downsampleMaxHeight: 30
    });
    t.after(() => disposeEditor(editor));

    await editor.loadImage(makeImageDataUrl({ width: 160, height: 120 }));

    assert.equal(editor.originalImage.width <= 40, true);
    assert.equal(editor.originalImage.height <= 30, true);
});

test('downsampling preserves alpha-capable source formats by default', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    const pngDataUrl = makeImageDataUrl({ width: 60, height: 40, format: 'image/png' });
    const imageElement = await editor._createImageElement(pngDataUrl);

    const resampled = editor._resampleImageToDataURL(imageElement, 30, 20, 0.92, pngDataUrl);

    assert.match(resampled, /^data:image\/png;base64,/);
});

test('downsampling can explicitly convert alpha-capable sources to JPEG', async (t) => {
    const { editor } = await createEditor({ downsampleMimeType: 'image/jpeg' });
    t.after(() => disposeEditor(editor));
    const pngDataUrl = makeImageDataUrl({ width: 60, height: 40, format: 'image/png' });
    const imageElement = await editor._createImageElement(pngDataUrl);

    const resampled = editor._resampleImageToDataURL(imageElement, 30, 20, 0.92, pngDataUrl);

    assert.match(resampled, /^data:image\/jpeg;base64,/);
});

test('quality normalization treats absent and invalid values as defaults', async (t) => {
    const { editor } = await createEditor({ downsampleQuality: null });
    t.after(() => disposeEditor(editor));

    assert.equal(editor._normalizeQuality(null), 0.92);
    assert.equal(editor._normalizeQuality(undefined), 0.92);
    assert.equal(editor._normalizeQuality('invalid'), 0.92);
    assert.equal(editor._normalizeQuality('0.8'), 0.8);
    assert.equal(editor._normalizeQuality(-1), 0);
    assert.equal(editor._normalizeQuality(2), 1);
    assert.equal(editor._normalizeQuality(null, 0.75), 0.75);
});

test('downsample and JPEG export conversion fail clearly when a 2D canvas context is unavailable', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));

    const imageElement = {
        naturalWidth: 20,
        naturalHeight: 10
    };
    const sourceDataUrl = makeImageDataUrl({ width: 20, height: 10 });
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = (tagName) => {
        const element = originalCreateElement(tagName);
        if (tagName === 'canvas') {
            element.getContext = () => null;
        }
        return element;
    };
    t.after(() => {
        document.createElement = originalCreateElement;
    });

    assert.throws(
        () => editor._resampleImageToDataURL(imageElement, 10, 5),
        /2D canvas context is unavailable/
    );
    await assert.rejects(
        () => editor._convertDataUrlToOpaqueJpeg(sourceDataUrl),
        /2D canvas context is unavailable/
    );
});

test('coverImageToCanvas creates a scrollable canvas when the covered image overflows', async (t) => {
    const { editor } = await createEditor({
        canvasWidth: 120,
        canvasHeight: 80,
        coverImageToCanvas: true,
        expandCanvasToImage: false
    });
    t.after(() => disposeEditor(editor));

    await loadFixtureImage(editor, { width: 120, height: 200 });

    assert.equal(editor.canvas.getWidth(), 118);
    assert.equal(editor.canvas.getHeight(), 197);
    assert.equal(editor.originalImage.getScaledWidth(), 118);
    assert.ok(Math.abs(editor.originalImage.getScaledHeight() - 196.66666666666669) < 0.001);
});

test('coverImageToCanvas uses the fixed scrollbar viewport and removes scrollable overflow after zooming below it', async (t) => {
    const { editor, ids } = await createEditor({
        canvasWidth: 800,
        canvasHeight: 600,
        coverImageToCanvas: true,
        expandCanvasToImage: false,
        minScale: 0.1
    }, {
        containerWidth: 413,
        containerHeight: 243
    });
    t.after(() => disposeEditor(editor));
    const container = document.getElementById(ids.canvasContainer);
    container.style.overflow = 'auto';
    editor._getScrollbarSize = () => ({ width: 17, height: 17 });

    await loadFixtureImage(editor, { width: 600, height: 400 });

    assert.equal(editor.canvas.getWidth(), 411);
    assert.equal(editor.canvas.getHeight(), 274);
    assert.equal(container.style.overflow, 'scroll');
    assert.ok(Math.abs(editor.originalImage.getScaledWidth() - 411) < 0.001);
    assert.ok(editor.originalImage.getScaledHeight() > 243);

    await editor.scaleImage(0.5);

    assert.equal(editor.canvas.getWidth(), 411);
    assert.equal(editor.canvas.getHeight(), 241);
    assert.equal(container.style.overflow, 'scroll');

    editor.options.coverImageToCanvas = false;
    editor.options.expandCanvasToImage = true;
    await loadFixtureImage(editor, { width: 120, height: 80 });

    assert.equal(container.style.overflow, 'auto');
});

test('coverImageToCanvas does not enlarge images that are smaller than the fixed scrollbar viewport', async (t) => {
    const { editor } = await createEditor({
        canvasWidth: 800,
        canvasHeight: 600,
        coverImageToCanvas: true,
        expandCanvasToImage: false
    }, {
        containerWidth: 413,
        containerHeight: 243
    });
    t.after(() => disposeEditor(editor));

    await loadFixtureImage(editor, { width: 120, height: 80 });

    assert.equal(editor.originalImage.getScaledWidth(), 120);
    assert.equal(editor.originalImage.getScaledHeight(), 80);
    assert.equal(editor.canvas.getWidth(), 411);
    assert.equal(editor.canvas.getHeight(), 241);
});

test('coverImageToCanvas does not add overflow for near-integer cover dimensions', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));

    assert.equal(editor._ceilCanvasDimension(120.0000001), 120);
    assert.equal(editor._ceilCanvasDimension(120.009), 120);
    assert.equal(editor._ceilCanvasDimension(120.02), 121);
});

test('scrollbar measurement is cached after the first DOM probe', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    const originalAppendChild = document.body.appendChild.bind(document.body);
    let probeCount = 0;
    document.body.appendChild = (element) => {
        probeCount += 1;
        return originalAppendChild(element);
    };
    t.after(() => {
        document.body.appendChild = originalAppendChild;
    });

    const first = editor._getScrollbarSize();
    const second = editor._getScrollbarSize();

    assert.deepEqual(second, first);
    assert.equal(probeCount, 1);
});

test('container viewport measurement compensates for existing auto scrollbars', async (t) => {
    const { editor, ids } = await createEditor({}, {
        containerWidth: 183,
        containerHeight: 103
    });
    t.after(() => disposeEditor(editor));
    const container = document.getElementById(ids.canvasContainer);
    container.style.overflow = 'auto';
    Object.defineProperty(container, 'scrollWidth', {
        configurable: true,
        value: 260
    });
    Object.defineProperty(container, 'scrollHeight', {
        configurable: true,
        value: 220
    });
    editor._getScrollbarSize = () => ({ width: 17, height: 17 });

    assert.deepEqual(editor._getContainerViewportSize(), {
        width: 200,
        height: 120
    });

    container.style.overflow = 'scroll';
    assert.deepEqual(editor._getContainerViewportSize(), {
        width: 183,
        height: 103
    });
});

test('container viewport measurement reuses the last visible size when hidden', async (t) => {
    const { editor, ids } = await createEditor({}, {
        containerWidth: 220,
        containerHeight: 140
    });
    t.after(() => disposeEditor(editor));
    const container = document.getElementById(ids.canvasContainer);

    assert.deepEqual(editor._getContainerViewportSize(), {
        width: 220,
        height: 140
    });

    Object.defineProperty(container, 'clientWidth', {
        configurable: true,
        value: 0
    });
    Object.defineProperty(container, 'clientHeight', {
        configurable: true,
        value: 0
    });

    assert.deepEqual(editor._getContainerViewportSize(), {
        width: 220,
        height: 140
    });
});

test('scaleImage, rotateImage, and reset update image transform state', async (t) => {
    const { editor } = await createEditor({
        minScale: 0.5,
        maxScale: 2
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    await editor.scaleImage(1.5);
    assert.equal(editor.currentScale, 1.5);
    assert.equal(editor.originalImage.scaleX, editor.baseImageScale * 1.5);

    await editor.rotateImage(45);
    assert.equal(editor.currentRotation, 45);
    assert.equal(editor.originalImage.angle, 45);

    await editor.resetImageTransform();
    assert.equal(editor.currentScale, 1);
    assert.equal(editor.currentRotation, 0);
});

test('dispose rejects an active animation instead of leaving the queue stalled', async (t) => {
    const { editor } = await createEditor({ animationDuration: 10000 });
    await loadFixtureImage(editor);
    editor.originalImage.animate = () => undefined;
    const scalePromise = editor.scaleImage(1.2);
    await waitForCanvasCallbacks(20);

    editor.dispose();
    t.after(() => disposeEditor(editor));

    await assert.rejects(scalePromise, /disposed/i);
    assert.equal(editor.canvas, null);
});

test('animation queue cancellation keeps a newer drain loop authoritative', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    const firstStarted = createDeferred();
    const firstRelease = createDeferred();
    const secondStarted = createDeferred();
    const secondRelease = createDeferred();

    const firstPromise = editor.animationQueue.add(async () => {
        firstStarted.resolve();
        await firstRelease.promise;
    });
    await firstStarted.promise;

    editor.animationQueue.cancelAll(new Error('cancelled first task'));
    const firstRejection = assert.rejects(firstPromise, /cancelled first task/);

    const secondPromise = editor.animationQueue.add(async () => {
        secondStarted.resolve();
        await secondRelease.promise;
        return 'second complete';
    });
    await secondStarted.promise;

    firstRelease.resolve();
    await waitForCanvasCallbacks(20);
    assert.equal(editor.animationQueue.isBusy(), true);

    secondRelease.resolve();
    assert.equal(await secondPromise, 'second complete');
    await firstRejection;
    assert.equal(editor.animationQueue.isBusy(), false);
});

test('rotateImage restores origin when animation setup fails', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);
    const image = editor.originalImage;
    const originalAnimate = image.animate;
    image.animate = () => {
        throw new Error('forced animation failure');
    };

    await assert.rejects(
        () => editor.rotateImage(45),
        /forced animation failure/
    );

    assert.equal(image.originX, 'left');
    assert.equal(image.originY, 'top');
    assert.equal(editor.isAnimating, false);
    image.animate = originalAnimate;
});

test('reset records a single undoable history transition', async (t) => {
    const { editor } = await createEditor({
        minScale: 0.5,
        maxScale: 2
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    await editor.scaleImage(1.5);
    await editor.rotateImage(45);
    const historyLengthBeforeReset = editor.historyManager.history.length;

    await editor.resetImageTransform();

    assert.equal(editor.historyManager.history.length, historyLengthBeforeReset + 1);
    assert.equal(editor.currentScale, 1);
    assert.equal(editor.currentRotation, 0);

    await editor.undo();

    assert.ok(Math.abs(editor.originalImage.scaleX - editor.baseImageScale * 1.5) < 0.001);
    assert.equal(editor.originalImage.angle, 45);
    assert.ok(Math.abs(editor.currentScale - 1.5) < 0.001);
    assert.equal(editor.currentRotation, 45);
});

test('coverImageToCanvas updates scrollable canvas bounds after zoom changes', async (t) => {
    const { editor } = await createEditor({
        canvasWidth: 120,
        canvasHeight: 80,
        coverImageToCanvas: true,
        expandCanvasToImage: false,
        minScale: 0.1
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor, { width: 120, height: 200 });

    await editor.scaleImage(0.5);

    assert.equal(editor.canvas.getWidth(), 118);
    assert.equal(editor.canvas.getHeight(), 99);

    await editor.scaleImage(0.3);

    assert.equal(editor.canvas.getWidth(), 118);
    assert.equal(editor.canvas.getHeight(), 78);
});

test('fitImageToCanvas keeps zoomed image inside resized scrollable canvas bounds', async (t) => {
    const { editor } = await createEditor({
        canvasWidth: 200,
        canvasHeight: 120,
        fitImageToCanvas: true,
        expandCanvasToImage: false,
        maxScale: 3
    }, {
        containerWidth: 200,
        containerHeight: 120
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor, { width: 400, height: 200 });

    const initialCanvasWidth = editor.canvas.getWidth();
    const initialCanvasHeight = editor.canvas.getHeight();

    await editor.scaleImage(1.5);
    editor.originalImage.setCoords();
    const scaledImageBounds = editor.originalImage.getBoundingRect(true, true);

    assert.ok(editor.canvas.getWidth() > initialCanvasWidth);
    assert.ok(editor.canvas.getHeight() > initialCanvasHeight);
    assert.ok(editor.canvas.getWidth() >= Math.floor(scaledImageBounds.width));
    assert.ok(editor.canvas.getHeight() >= Math.floor(scaledImageBounds.height));

    await editor.rotateImage(90);
    editor.originalImage.setCoords();
    const rotatedImageBounds = editor.originalImage.getBoundingRect(true, true);

    assert.ok(editor.canvas.getWidth() >= Math.floor(rotatedImageBounds.width));
    assert.ok(editor.canvas.getHeight() >= Math.floor(rotatedImageBounds.height));
});

test('fitImageToCanvas uses the visible viewport instead of the default configured canvas size', async (t) => {
    const { editor } = await createEditor({
        canvasWidth: 320,
        canvasHeight: 240,
        fitImageToCanvas: true,
        expandCanvasToImage: false
    }, {
        containerWidth: 500,
        containerHeight: 300
    });
    t.after(() => disposeEditor(editor));

    await loadFixtureImage(editor, { width: 1000, height: 500 });

    assert.equal(editor.canvas.getWidth(), 499);
    assert.equal(editor.canvas.getHeight(), 299);
    assert.ok(Math.abs(editor.originalImage.getScaledWidth() - 499) < 0.001);
    assert.ok(Math.abs(editor.originalImage.getScaledHeight() - 249.5) < 0.001);
});

test('post-load mask edits expand canvas consistently across image layout modes', async (t) => {
    const editors = [];
    t.after(() => editors.forEach(disposeEditor));

    const modeConfigs = [
        ['expand', { expandCanvasToImage: true, fitImageToCanvas: false, coverImageToCanvas: false }],
        ['fit', { expandCanvasToImage: false, fitImageToCanvas: true, coverImageToCanvas: false }],
        ['cover', { expandCanvasToImage: false, fitImageToCanvas: false, coverImageToCanvas: true }]
    ];

    for (const [modeName, modeOptions] of modeConfigs) {
        const { editor } = await createEditor({
            canvasWidth: 100,
            canvasHeight: 80,
            maxScale: 2,
            ...modeOptions
        }, {
            containerWidth: 100,
            containerHeight: 80
        });
        editors.push(editor);
        await loadFixtureImage(editor, { width: 80, height: 60 });

        const initialWidth = editor.canvas.getWidth();
        const initialHeight = editor.canvas.getHeight();
        const mask = editor.createMask({ shape: 'circle', left: 90, top: 70, radius: 20 });

        assert.equal(editor.canvas.getWidth() > initialWidth, true, `${modeName} should expand canvas when adding an out-of-bounds mask`);
        assert.equal(editor.canvas.getHeight() > initialHeight, true, `${modeName} should expand canvas height when adding an out-of-bounds mask`);

        const widthAfterCreate = editor.canvas.getWidth();
        const heightAfterCreate = editor.canvas.getHeight();
        mask.set({ left: 130, top: 95, scaleX: 1.5, scaleY: 1.5 });
        mask.setCoords();
        editor.canvas.fire('object:modified', { target: mask });

        assert.equal(editor.canvas.getWidth() > widthAfterCreate, true, `${modeName} should expand canvas when resizing a mask`);
        assert.equal(editor.canvas.getHeight() > heightAfterCreate, true, `${modeName} should expand canvas height when resizing a mask`);
    }
});

test('createMask supports standard shapes, labels, DOM list updates, and remove operations', async (t) => {
    const { editor, ids } = await createEditor({
        maskName: 'unit-mask-',
        maskLabelOnSelect: true,
        maskRotatable: true
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    const rect = editor.createMask({ width: 30, height: 40 });
    assert.equal(rect.maskId, 1);
    assert.equal(rect.maskName, 'unit-mask-1');
    assert.equal(rect.left, 10);
    assert.equal(rect.top, 10);
    assert.equal(rect.lockRotation, false);
    assert.ok(rect.__label);
    assert.equal(document.getElementById(ids.maskList).children.length, 1);
    assert.equal(document.getElementById(ids.maskList).children[0].dataset.maskId, '1');

    const circle = editor.createMask({ shape: 'circle', radius: 10 });
    assert.equal(circle.type, 'circle');
    rect.setCoords();
    const rectBounds = rect.getBoundingRect(true, true);
    assert.equal(circle.left, Math.round(rectBounds.left + rectBounds.width + 5));

    const polygon = editor.createMask({
        shape: 'polygon',
        points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 10, y: 20 }]
    });
    assert.equal(polygon.type, 'polygon');

    editor.removeSelectedMask();
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 2);

    editor.removeAllMasks();
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 0);
    assert.equal(document.getElementById(ids.maskList).children.length, 0);
});

test('createMask resolves percentage values against the correct canvas axis', async (t) => {
    const { editor } = await createEditor({
        canvasWidth: 800,
        canvasHeight: 600,
        expandCanvasToImage: false
    });
    t.after(() => disposeEditor(editor));

    const rect = editor.createMask({
        left: '25%',
        top: '50%',
        width: '50%',
        height: '50%'
    });
    const circle = editor.createMask({
        shape: 'circle',
        left: 0,
        top: 0,
        radius: '10%'
    });
    const ellipse = editor.createMask({
        shape: 'ellipse',
        left: 0,
        top: 0,
        rx: '25%',
        ry: '25%'
    });

    assert.equal(rect.left, 200);
    assert.equal(rect.top, 300);
    assert.equal(rect.width, 400);
    assert.equal(rect.height, 300);
    assert.equal(circle.radius, 60);
    assert.equal(ellipse.rx, 200);
    assert.equal(ellipse.ry, 150);
});

test('all mask shape variants share hover, history, and expansion behavior', async (t) => {
    const editors = [];
    t.after(() => editors.forEach(disposeEditor));

    const shapeConfigs = [
        ['rect', () => ({ shape: 'rect', left: 90, top: 70, width: 30, height: 24, alpha: 0.4 })],
        ['circle', () => ({ shape: 'circle', left: 90, top: 70, radius: 18, alpha: 0.4 })],
        ['ellipse', () => ({ shape: 'ellipse', left: 90, top: 70, width: 36, height: 24, alpha: 0.4 })],
        ['polygon', () => ({ shape: 'polygon', left: 90, top: 70, points: [[0, 0], [30, 0], [12, 24]], alpha: 0.4 })],
        ['custom', () => ({
            shape: 'custom-triangle',
            left: 90,
            top: 70,
            width: 34,
            height: 26,
            alpha: 0.4,
            fabricGenerator: (config) => new fabric.Triangle({
                left: config.left,
                top: config.top,
                width: config.width,
                height: config.height,
                fill: config.color
            })
        })]
    ];

    for (const [shapeName, createConfig] of shapeConfigs) {
        const { editor } = await createEditor({
            canvasWidth: 100,
            canvasHeight: 80,
            expandCanvasToImage: true,
            maskLabelOnSelect: true,
            maskRotatable: true
        });
        editors.push(editor);
        await loadFixtureImage(editor, { width: 80, height: 60 });

        const mask = editor.createMask(createConfig());
        assert.ok(mask.maskId, `${shapeName} should be tracked as a mask`);
        assert.ok(mask.__label, `${shapeName} should create a selectable label`);
        assert.equal(mask.selectable, true, `${shapeName} should be selectable`);
        assert.equal(mask.hasControls, true, `${shapeName} should expose Fabric controls`);
        assert.equal(mask.lockRotation, false, `${shapeName} should follow maskRotatable`);
        assert.equal(mask.opacity, 0.4, `${shapeName} should apply normalized mask opacity`);
        assert.equal(typeof mask.__imageEditorMaskHandlers.mouseover, 'function', `${shapeName} should bind hover handlers`);
        assert.equal(editor.canvas.getWidth() >= 130, true, `${shapeName} should expand canvas width`);
        assert.equal(editor.canvas.getHeight() >= 100, true, `${shapeName} should expand canvas height`);

        if (shapeName === 'polygon') {
            assert.equal(mask.points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)), true);
        }

        editor._handleSelectionChanged([]);
        mask.fire('mouseover');
        assert.equal(mask.stroke, '#ff5500', `${shapeName} hover should use shared hover stroke`);
        assert.ok(Math.abs(mask.opacity - 0.6) < 0.001, `${shapeName} hover should increase opacity`);
        mask.fire('mouseout');
        assert.equal(mask.stroke, mask.originalStroke, `${shapeName} mouseout should restore stroke`);
        assert.equal(mask.opacity, mask.originalAlpha, `${shapeName} mouseout should restore opacity`);

        const originalLeft = mask.left;
        mask.set({ left: originalLeft + 20, scaleX: 1.4 });
        mask.setCoords();
        editor.canvas.fire('object:modified', { target: mask });

        await editor.undo();
        const undoneMask = editor.canvas.getObjects().find(object => object.maskId === mask.maskId);
        assert.ok(Math.abs(undoneMask.left - originalLeft) < 0.001, `${shapeName} undo should restore previous position`);

        await editor.redo();
        const redoneMask = editor.canvas.getObjects().find(object => object.maskId === mask.maskId);
        assert.ok(Math.abs(redoneMask.left - (originalLeft + 20)) < 0.001, `${shapeName} redo should restore modified position`);
    }
});

test('createMask applies explicit Fabric style and control values without truthy fallbacks', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    const mask = editor.createMask({
        selectable: false,
        hasControls: false,
        borderColor: '#123456',
        cornerColor: '#654321',
        cornerSize: 0,
        transparentCorners: true,
        styles: {
            stroke: '#abcdef',
            strokeWidth: 0,
            strokeDashArray: [],
            strokeUniform: false
        }
    });
    editor._handleSelectionChanged([]);

    assert.equal(mask.selectable, false);
    assert.equal(mask.hasControls, false);
    assert.equal(mask.borderColor, '#123456');
    assert.equal(mask.cornerColor, '#654321');
    assert.equal(mask.cornerSize, 0);
    assert.equal(mask.transparentCorners, true);
    assert.equal(mask.stroke, '#abcdef');
    assert.equal(mask.strokeWidth, 0);
    assert.deepEqual(mask.strokeDashArray, []);
    assert.equal(mask.strokeUniform, false);
    assert.equal(mask.originalStrokeWidth, 0);
});

test('deprecated public aliases remain compatible with preferred API names', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    const mask = editor.addMask({ width: 20, height: 20 });
    assert.equal(mask.maskId, 1);
    assert.match(await editor.getImageBase64({ exportImageArea: true, multiplier: 1 }), /^data:image\/jpeg;base64,/);

    await editor.merge();
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 0);

    await editor.reset();
    assert.equal(editor.currentRotation, 0);
});

test('mask placement memory is cleared after selected and bulk removal', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    const first = editor.createMask({ width: 30, height: 30 });
    assert.equal(first.left, 10);
    editor.removeSelectedMask();

    const afterSelectedRemove = editor.createMask({ width: 30, height: 30 });
    assert.equal(afterSelectedRemove.left, 10);
    assert.equal(afterSelectedRemove.top, 10);

    editor.removeAllMasks();
    const afterRemoveAll = editor.createMask({ width: 30, height: 30 });
    assert.equal(afterRemoveAll.left, 10);
    assert.equal(afterRemoveAll.top, 10);
});

test('non-rectangular masks expand the canvas when placed beyond current bounds', async (t) => {
    const { editor } = await createEditor({
        canvasWidth: 100,
        canvasHeight: 80,
        expandCanvasToImage: true
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor, { width: 80, height: 60 });

    editor.createMask({ shape: 'circle', left: 90, top: 70, radius: 20 });

    assert.equal(editor.canvas.getWidth() >= 140, true);
    assert.equal(editor.canvas.getHeight() >= 120, true);
});

test('rectangular masks use the shared canvas expansion path once', async (t) => {
    const { editor } = await createEditor({
        canvasWidth: 100,
        canvasHeight: 80,
        expandCanvasToImage: true
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor, { width: 80, height: 60 });

    const originalSetCanvasSizeInt = editor._setCanvasSizeInt.bind(editor);
    let resizeCalls = 0;
    editor._setCanvasSizeInt = (...args) => {
        resizeCalls += 1;
        return originalSetCanvasSizeInt(...args);
    };

    editor.createMask({ left: 90, top: 70, width: 40, height: 30 });

    assert.equal(resizeCalls, 1);
    assert.equal(editor.canvas.getWidth() >= 140, true);
    assert.equal(editor.canvas.getHeight() >= 110, true);
});

test('clearing selection restores custom mask stroke styling', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    const mask = editor.createMask({
        styles: {
            stroke: '#123456',
            strokeWidth: 3
        }
    });
    assert.equal(mask.stroke, '#ff0000');
    assert.equal(mask.strokeWidth, 1);

    editor._handleSelectionChanged([]);

    assert.equal(mask.stroke, '#123456');
    assert.equal(mask.strokeWidth, 3);
});

test('history snapshots omit transient selected mask styling', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    const mask = editor.createMask({
        styles: {
            stroke: '#123456',
            strokeWidth: 3
        }
    });
    assert.equal(mask.stroke, '#ff0000');
    assert.equal(mask.strokeWidth, 1);

    await editor.undo();
    await editor.redo();

    const restoredMask = editor.canvas.getObjects().find(object => object.maskId);
    assert.ok(restoredMask);
    assert.equal(restoredMask.stroke, '#123456');
    assert.equal(restoredMask.strokeWidth, 3);
});

test('label getText receives a stable zero-based mask creation index', async (t) => {
    const calls = [];
    const { editor } = await createEditor({
        maskLabelOnSelect: true,
        label: {
            getText: (mask, creationIndex) => {
                calls.push({ maskName: mask.maskName, creationIndex });
                return `${creationIndex}:${mask.maskName}`;
            }
        }
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    const first = editor.createMask({ width: 20, height: 20 });
    const second = editor.createMask({ width: 20, height: 20 });
    const third = editor.createMask({ width: 20, height: 20 });

    assert.deepEqual([...new Set(calls.map(call => call.creationIndex))], [0, 1, 2]);

    editor.canvas.setActiveObject(second);
    editor.removeSelectedMask();
    editor._hideAllMaskLabels();
    editor._showLabelForMask(first);
    editor._showLabelForMask(third);

    assert.deepEqual(calls.slice(-2), [
        { maskName: first.maskName, creationIndex: 0 },
        { maskName: third.maskName, creationIndex: 2 }
    ]);
});

test('invalid custom label factories emit a warning and fall back to default labels', async (t) => {
    const warnings = [];
    const { editor } = await createEditor({
        label: {
            create: () => null
        },
        onWarning: (error, message) => warnings.push({ error, message })
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    const mask = editor.createMask({ width: 20, height: 20 });

    assert.equal(mask.__label.type, 'text');
    assert.equal(warnings.some(entry => /label\.create/.test(entry.message)), true);
});

test('invalid custom mask generators return null and leave state unchanged', async (t) => {
    const warnings = [];
    const { editor } = await createEditor({
        onWarning: (error, message) => warnings.push({ error, message })
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);
    const historyLength = editor.historyManager.history.length;

    const mask = editor.createMask({
        fabricGenerator: () => ({ type: 'not-a-fabric-object' })
    });

    assert.equal(mask, null);
    assert.equal(editor.maskCounter, 0);
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 0);
    assert.equal(editor.historyManager.history.length, historyLength);
    assert.equal(warnings.some(entry => /fabricGenerator/.test(entry.message)), true);
});

test('exportImageBase64 exports image data and restores mask state when export fails', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    const mask = editor.createMask({
        color: 'rgba(12,34,56,0.5)',
        alpha: 0.4,
        styles: {
            stroke: '#123456',
            strokeWidth: 3
        }
    });
    const imageBase64 = await editor.exportImageBase64({ exportImageArea: true, multiplier: 1 });
    assert.match(imageBase64, /^data:image\/jpeg;base64,/);

    const originalState = {
        opacity: mask.opacity,
        fill: mask.fill,
        strokeWidth: mask.strokeWidth,
        stroke: mask.stroke,
        selectable: mask.selectable,
        lockRotation: mask.lockRotation
    };
    const originalToDataURL = editor.canvas.toDataURL.bind(editor.canvas);
    editor.canvas.toDataURL = () => {
        throw new Error('forced export failure');
    };

    await assert.rejects(
        () => editor.exportImageBase64({ exportImageArea: true }),
        /forced export failure/
    );

    editor.canvas.toDataURL = originalToDataURL;
    assert.equal(mask.opacity, originalState.opacity);
    assert.equal(mask.fill, originalState.fill);
    assert.equal(mask.strokeWidth, originalState.strokeWidth);
    assert.equal(mask.stroke, originalState.stroke);
    assert.equal(mask.selectable, originalState.selectable);
    assert.equal(mask.lockRotation, originalState.lockRotation);
});

test('exportImageBase64 preserves selected mask labels and active selection', async (t) => {
    const { editor } = await createEditor({
        maskLabelOnSelect: true
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);
    const mask = editor.createMask({
        styles: {
            stroke: '#123456',
            strokeWidth: 3
        }
    });
    const label = mask.__label;

    for (const exportImageArea of [false, true]) {
        editor.canvas.setActiveObject(mask);
        editor._handleSelectionChanged([mask]);
        await editor.exportImageBase64({ exportImageArea, multiplier: 1 });

        assert.equal(mask.__label, label);
        assert.equal(editor.canvas.getObjects().includes(label), true);
        assert.equal(editor.canvas.getActiveObject(), mask);
        assert.equal(mask.stroke, '#ff0000');
        assert.equal(label.visible, true);
    }
});

test('exportImageBase64 can export directly to PNG', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    const imageBase64 = await editor.exportImageBase64({ exportImageArea: false, fileType: 'png', multiplier: 1 });

    assert.match(imageBase64, /^data:image\/png;base64,/);
});

test('exportImageBase64 exports the scrollable image area in cover-canvas mode', async (t) => {
    const { editor } = await createEditor({
        canvasWidth: 120,
        canvasHeight: 80,
        coverImageToCanvas: true,
        expandCanvasToImage: false
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor, { width: 120, height: 200 });
    editor.createMask({ width: 20, height: 20 });

    const imageBase64 = await editor.exportImageBase64({ exportImageArea: true, multiplier: 1 });
    const size = await getImageDimensionsFromDataUrl(imageBase64);

    assert.equal(editor.canvas.getHeight(), 197);
    assert.equal(size.width, 118);
    assert.equal(size.height, 197);
});

test('mergeMasks preserves the right edge when the image width lands on a partial pixel', async (t) => {
    const { editor } = await createEditor({
        fitImageToCanvas: true,
        expandCanvasToImage: false,
        exportMultiplier: 1
    }, {
        containerWidth: 120,
        containerHeight: 80
    });
    t.after(() => disposeEditor(editor));
    await editor.loadImage(makeEdgeBorderImageDataUrl({ width: 100, height: 200, right: true }));
    editor.createMask({ left: 5, top: 5, width: 10, height: 10 });

    editor.originalImage.setCoords();
    const imageBounds = editor.originalImage.getBoundingRect(true, true);
    assert.equal(imageBounds.width, 39.5);

    await editor.mergeMasks();
    const exportedAfterMerge = await editor.exportImageBase64({
        exportImageArea: false,
        fileType: 'png',
        multiplier: 1
    });
    const size = await getImageDimensionsFromDataUrl(exportedAfterMerge);
    const rightEdgeLuminance = await getEdgeAverageLuminance(exportedAfterMerge, 'right');

    assert.equal(size.width, 40);
    assert.ok(rightEdgeLuminance < 180, `expected a visible dark right edge, got luminance ${rightEdgeLuminance}`);
});

test('mergeMasks preserves the bottom edge when the image height lands on a partial pixel', async (t) => {
    const { editor } = await createEditor({
        fitImageToCanvas: true,
        expandCanvasToImage: false,
        exportMultiplier: 1
    }, {
        containerWidth: 120,
        containerHeight: 80
    });
    t.after(() => disposeEditor(editor));
    await editor.loadImage(makeEdgeBorderImageDataUrl({ width: 200, height: 100, right: false, bottom: true }));
    editor.createMask({ left: 5, top: 5, width: 10, height: 10 });

    editor.originalImage.setCoords();
    const imageBounds = editor.originalImage.getBoundingRect(true, true);
    assert.equal(imageBounds.height, 59.5);

    await editor.mergeMasks();
    const exportedAfterMerge = await editor.exportImageBase64({
        exportImageArea: false,
        fileType: 'png',
        multiplier: 1
    });
    const size = await getImageDimensionsFromDataUrl(exportedAfterMerge);
    const bottomEdgeLuminance = await getEdgeAverageLuminance(exportedAfterMerge, 'bottom');

    assert.equal(size.height, 60);
    assert.ok(bottomEdgeLuminance < 180, `expected a visible dark bottom edge, got luminance ${bottomEdgeLuminance}`);
});

test('JPEG export composites partial transparent edges without introducing black pixels', async (t) => {
    const { editor } = await createEditor({
        fitImageToCanvas: true,
        expandCanvasToImage: false,
        exportMultiplier: 1
    }, {
        containerWidth: 120,
        containerHeight: 80
    });
    t.after(() => disposeEditor(editor));
    await editor.loadImage(makeEdgeBorderImageDataUrl({ width: 200, height: 100, right: false, bottom: false }));

    editor.originalImage.setCoords();
    const imageBounds = editor.originalImage.getBoundingRect(true, true);
    assert.equal(imageBounds.height, 59.5);

    const exported = await editor.exportImageBase64({
        exportImageArea: false,
        fileType: 'jpeg',
        multiplier: 1,
        quality: 0.92
    });
    const size = await getImageDimensionsFromDataUrl(exported);
    const bottomEdgeLuminance = await getEdgeAverageLuminance(exported, 'bottom');

    assert.equal(size.height, 60);
    assert.ok(bottomEdgeLuminance > 230, `expected a light bottom edge, got luminance ${bottomEdgeLuminance}`);
});

test('mergeMasks seals zoomed fractional image edges without adding a bottom fill row', async (t) => {
    const editors = [];
    t.after(() => editors.forEach(disposeEditor));
    const modeConfigs = [
        ['fit', {
            editorOptions: { fitImageToCanvas: true, expandCanvasToImage: false },
            domOptions: { containerWidth: 114, containerHeight: 200 }
        }],
        ['cover', {
            editorOptions: { coverImageToCanvas: true, expandCanvasToImage: false },
            domOptions: { containerWidth: 114, containerHeight: 50 }
        }]
    ];

    for (const [modeName, config] of modeConfigs) {
        const { editor } = await createEditor({
            exportMultiplier: 1,
            maxScale: 2,
            ...config.editorOptions
        }, config.domOptions);
        editors.push(editor);
        await editor.loadImage(makeEdgeBorderImageDataUrl({
            width: 200,
            height: 96,
            fill: '#075083',
            right: false,
            bottom: false
        }));
        await editor.scaleImage(1.3);
        editor.createMask({ left: 5, top: 5, width: 10, height: 10 });

        editor.originalImage.setCoords();
        const imageBounds = editor.originalImage.getBoundingRect(true, true);
        assert.notEqual(imageBounds.height, Math.round(imageBounds.height), `${modeName} should exercise a fractional height`);
        const expectedMergedHeight = Math.ceil(imageBounds.height);
        const originalLoadImage = editor.loadImage.bind(editor);
        let mergedDataUrl = null;
        editor.loadImage = async (imageBase64, options) => {
            if (typeof imageBase64 === 'string' && imageBase64.startsWith('data:image/png')) {
                mergedDataUrl = imageBase64;
            }
            return originalLoadImage(imageBase64, options);
        };

        await editor.mergeMasks();
        editor.loadImage = originalLoadImage;
        assert.ok(mergedDataUrl, `${modeName} should load the merged image data URL`);
        const mergedSize = await getImageDimensionsFromDataUrl(mergedDataUrl);
        const mergedBottomEdgeLuminance = await getEdgeAverageLuminance(mergedDataUrl, 'bottom');
        assert.equal(mergedSize.height, expectedMergedHeight, `${modeName} should merge through the full fractional image height`);
        assert.ok(mergedBottomEdgeLuminance < 130, `${modeName} should merge the blue image edge instead of a white fill row, got luminance ${mergedBottomEdgeLuminance}`);

        const exportedAfterMerge = await editor.exportImageBase64({
            exportImageArea: false,
            fileType: 'jpeg',
            multiplier: 1,
            quality: 0.92
        });
        const size = await getImageDimensionsFromDataUrl(exportedAfterMerge);
        const bottomEdgeLuminance = await getEdgeAverageLuminance(exportedAfterMerge, 'bottom');

        editor.originalImage.setCoords();
        const reloadedBounds = editor.originalImage.getBoundingRect(true, true);
        assert.equal(size.height, Math.ceil(reloadedBounds.height), `${modeName} should export through the full fractional reloaded image height`);
        assert.ok(bottomEdgeLuminance < 130, `${modeName} should keep the blue image edge instead of a white fill row, got luminance ${bottomEdgeLuminance}`);
    }
});

test('exportImageBase64 exportImageArea false preserves image transforms and omits masks', async (t) => {
    const { editor } = await createEditor({
        canvasWidth: 120,
        canvasHeight: 120,
        expandCanvasToImage: true
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor, { width: 80, height: 40 });
    editor.createMask({ width: 20, height: 20 });

    await editor.rotateImage(90);
    const imageBase64 = await editor.exportImageBase64({ exportImageArea: false, multiplier: 1 });
    const size = await getImageDimensionsFromDataUrl(imageBase64);

    assert.equal(size.width, 40);
    assert.equal(size.height, 80);
});

test('export and merge APIs reject while an animation is running', async (t) => {
    const { editor } = await createEditor({ animationDuration: 10000 });
    await loadFixtureImage(editor);
    editor.createMask({ width: 20, height: 20 });
    editor.originalImage.animate = () => undefined;
    const scalePromise = editor.scaleImage(1.2);
    await waitForCanvasCallbacks(20);

    await assert.rejects(
        () => editor.exportImageBase64(),
        /animation is running/
    );
    await assert.rejects(
        () => editor.mergeMasks(),
        /animation is running/
    );

    editor.dispose();
    t.after(() => disposeEditor(editor));
    await assert.rejects(scalePromise, /disposed/i);
});

test('exportImageFile creates a typed image File with and without merged masks', async (t) => {
    const { editor } = await createEditor({
        defaultDownloadFileName: 'unit-export.jpg'
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);
    editor.createMask({ width: 20, height: 20 });

    const maskedFile = await editor.exportImageFile({
        mergeMask: true,
        fileType: 'png',
        fileName: 'masked.png'
    });
    assert.equal(maskedFile.name, 'masked.png');
    assert.equal(maskedFile.type, 'image/png');
    assert.equal(maskedFile.size > 0, true);

    const plainFile = await editor.exportImageFile({
        mergeMask: false,
        fileType: 'jpeg',
        fileName: 'plain.jpg'
    });
    assert.equal(plainFile.name, 'plain.jpg');
    assert.equal(plainFile.type, 'image/jpeg');
    assert.equal(plainFile.size > 0, true);
});

test('exportImageFile can decode output without a global atob', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);
    const originalAtob = globalThis.atob;
    globalThis.atob = undefined;
    t.after(() => {
        globalThis.atob = originalAtob;
    });

    const file = await editor.exportImageFile({
        mergeMask: false,
        fileType: 'png',
        fileName: 'without-atob.png'
    });

    assert.equal(file.name, 'without-atob.png');
    assert.equal(file.type, 'image/png');
    assert.equal(file.size > 0, true);
});

test('JPEG background color treats transparent CSS forms as white fallback', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));

    const transparentColors = [
        'transparent',
        'rgba(0, 0, 0, 0)',
        'rgb(0 0 0 / 0)',
        'hsl(0 0% 0% / 0%)',
        '#0000',
        '#ffffff00'
    ];

    for (const color of transparentColors) {
        editor.options.backgroundColor = color;
        assert.equal(editor._getJpegBackgroundColor(), '#ffffff', `${color} should use white`);
    }

    editor.options.backgroundColor = 'rgba(1, 2, 3, 0.5)';
    assert.equal(editor._getJpegBackgroundColor(), 'rgba(1, 2, 3, 0.5)');
});

test('exportImageFile forwards quality to exportImageBase64 for both export modes', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    const calls = [];
    editor.exportImageBase64 = async (options) => {
        calls.push(options);
        return makeImageDataUrl({ width: 8, height: 8, format: 'image/jpeg' });
    };

    await editor.exportImageFile({ mergeMask: true, fileType: 'png', quality: 0.31, multiplier: 2 });
    await editor.exportImageFile({ mergeMask: false, fileType: 'jpeg', quality: 0.47, multiplier: 3 });

    assert.equal(calls[0].quality, 0.31);
    assert.equal(calls[0].multiplier, 2);
    assert.equal(calls[0].fileType, 'png');
    assert.equal(calls[1].quality, 0.47);
    assert.equal(calls[1].multiplier, 3);
    assert.equal(calls[1].fileType, 'jpeg');
});

test('exportImageFile fails clearly when conversion cannot create a 2D context', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);
    const pngDataUrl = makeImageDataUrl({ width: 8, height: 8, format: 'image/png' });
    editor.exportImageBase64 = async () => pngDataUrl;
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = (tagName) => {
        const element = originalCreateElement(tagName);
        if (tagName === 'canvas') element.getContext = () => null;
        return element;
    };
    t.after(() => {
        document.createElement = originalCreateElement;
    });

    await assert.rejects(
        () => editor.exportImageFile({ fileType: 'jpeg' }),
        /Unable to create 2D canvas context/
    );
});

test('downloadImage builds and clicks an anchor for the exported image', async (t) => {
    const { editor } = await createEditor({
        defaultDownloadFileName: 'download.jpg'
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    const originalCreateElement = document.createElement.bind(document);
    let clickedAnchor = null;
    document.createElement = (tagName) => {
        const element = originalCreateElement(tagName);
        if (String(tagName).toLowerCase() === 'a') {
            element.click = () => {
                clickedAnchor = element;
            };
        }
        return element;
    };
    t.after(() => {
        document.createElement = originalCreateElement;
    });

    editor.downloadImage('custom-download.jpg');
    await waitForCanvasCallbacks(100);

    assert.ok(clickedAnchor);
    assert.equal(clickedAnchor.download, 'custom-download.jpg');
    assert.match(clickedAnchor.href, /^data:image\/jpeg;base64,/);
});

test('mergeMasks flattens masks into a newly loaded base image', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);
    editor.createMask({ width: 30, height: 30 });

    await editor.mergeMasks();

    assert.equal(editor.isImageLoaded(), true);
    assert.equal(editor.isImageLoadedToCanvas, true);
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 0);
    assert.equal(editor.canvas.getObjects().filter(object => object.type === 'image').length, 1);
});

test('mergeMasks restores masks and history when the flattened image load fails', async (t) => {
    const errors = [];
    const { editor } = await createEditor({
        onError: (error, message) => errors.push({ error, message })
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);
    const mask = editor.createMask({ width: 30, height: 30 });
    const historyLength = editor.historyManager.history.length;
    const originalLoadImage = editor.loadImage.bind(editor);

    editor.loadImage = async () => {
        throw new Error('forced merged load failure');
    };

    await assert.rejects(
        () => editor.mergeMasks(),
        /forced merged load failure/
    );

    const masks = editor.canvas.getObjects().filter(object => object.maskId);
    assert.equal(masks.length, 1);
    assert.equal(masks[0].maskId, mask.maskId);
    assert.equal(editor.historyManager.history.length, historyLength);
    assert.equal(errors.some(entry => entry.message === 'merge error'), true);

    editor.loadImage = originalLoadImage;
});

test('mergeMasks undo followed by createMask does not reuse restored mask ids', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);
    editor.createMask({ width: 30, height: 30 });

    await editor.mergeMasks();
    await editor.undo();
    const newMask = editor.createMask({ width: 20, height: 20 });
    const maskIds = editor.canvas.getObjects()
        .filter(object => object.maskId)
        .map(object => object.maskId)
        .sort((a, b) => a - b);

    assert.deepEqual(maskIds, [1, 2]);
    assert.equal(newMask.maskId, 2);
});

test('mergeMasks preserves cover-canvas scroll position while reloading the flattened image', async (t) => {
    const { editor, ids } = await createEditor({
        canvasWidth: 120,
        canvasHeight: 80,
        coverImageToCanvas: true,
        expandCanvasToImage: false
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor, { width: 120, height: 200 });
    editor.createMask({ width: 30, height: 30 });

    const container = document.getElementById(ids.canvasContainer);
    container.scrollLeft = 4;
    container.scrollTop = 23;

    await editor.mergeMasks();

    assert.equal(container.scrollLeft, 4);
    assert.equal(container.scrollTop, 23);
});

test('mergeMasks undo restores mask control styling', async (t) => {
    const { editor } = await createEditor({
        maskRotatable: true
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);
    editor.createMask({
        width: 30,
        height: 30,
        borderColor: '#00ff00',
        cornerColor: '#111111',
        cornerSize: 11,
        transparentCorners: false,
        styles: {
            strokeDashArray: [4, 2]
        }
    });

    await editor.mergeMasks();
    await editor.undo();

    const restoredMask = editor.canvas.getObjects().find(object => object.maskId);
    assert.ok(restoredMask);
    assert.equal(restoredMask.selectable, true);
    assert.equal(restoredMask.evented, true);
    assert.equal(restoredMask.hasControls, true);
    assert.equal(restoredMask.lockRotation, false);
    assert.equal(restoredMask.borderColor, '#00ff00');
    assert.equal(restoredMask.cornerColor, '#111111');
    assert.equal(restoredMask.cornerSize, 11);
    assert.equal(restoredMask.transparentCorners, false);
    assert.deepEqual(restoredMask.strokeDashArray, [4, 2]);
});

test('crop mode can be entered, canceled, and applied while removing unmerged masks', async (t) => {
    const { editor } = await createEditor({
        crop: {
            minWidth: 40,
            minHeight: 40
        }
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor, { width: 200, height: 160 });
    editor.createMask({ width: 30, height: 30 });

    editor.enterCropMode();
    assert.equal(editor._cropMode, true);
    assert.ok(editor._cropRect);
    assert.equal(editor.canvas.getActiveObject(), editor._cropRect);

    editor.cancelCrop();
    assert.equal(editor._cropMode, false);
    assert.equal(editor._cropRect, null);

    editor.enterCropMode();
    await editor.applyCrop();

    assert.equal(editor.isImageLoaded(), true);
    assert.equal(editor.isImageLoadedToCanvas, true);
    assert.equal(editor._cropMode, false);
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 0);
});

test('crop mode enforces configured minimum resize dimensions within image bounds', async (t) => {
    const { editor } = await createEditor({
        crop: {
            minWidth: 80,
            minHeight: 70
        }
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor, { width: 200, height: 160 });

    editor.enterCropMode();
    editor._cropRect.set({ scaleX: 0.1, scaleY: 0.1 });
    editor._cropRect.fire('scaling');

    assert.ok(editor._cropRect.getScaledWidth() >= 80);
    assert.ok(editor._cropRect.getScaledHeight() >= 70);
});

test('crop mode clamps moved rectangles inside image bounds', async (t) => {
    const { editor } = await createEditor({
        crop: {
            minWidth: 40,
            minHeight: 40
        }
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor, { width: 200, height: 160 });

    editor.enterCropMode();
    editor._cropRect.set({ left: -50, top: -40, scaleX: 1, scaleY: 1 });
    editor._cropRect.fire('moving');

    assert.ok(editor._cropRect.left >= 0);
    assert.ok(editor._cropRect.top >= 0);

    editor._cropRect.set({ left: 500, top: 500, scaleX: 1, scaleY: 1 });
    editor._cropRect.fire('moving');
    editor._cropRect.setCoords();
    const bounds = editor._cropRect.getBoundingRect(true, true);

    assert.ok(bounds.left + bounds.width <= 200);
    assert.ok(bounds.top + bounds.height <= 160);
});

test('crop mode hides masks temporarily and restores their visibility on cancel', async (t) => {
    const { editor } = await createEditor({
        crop: {
            hideMasksDuringCrop: true
        }
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);
    const mask = editor.createMask({ width: 30, height: 30 });

    editor.enterCropMode();
    assert.equal(mask.visible, false);

    editor.cancelCrop();
    assert.equal(mask.visible, true);
    assert.equal(mask.evented, true);
    assert.equal(mask.selectable, true);
});

test('applyCrop undo restores interactive masks from the before snapshot', async (t) => {
    const { editor } = await createEditor({
        crop: {
            minWidth: 40,
            minHeight: 40,
            hideMasksDuringCrop: true
        }
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor, { width: 160, height: 120 });
    const mask = editor.createMask({
        left: 24,
        top: 28,
        width: 30,
        height: 30,
        styles: {
            stroke: '#123456',
            strokeWidth: 4
        }
    });
    editor._showLabelForMask(mask);

    editor.enterCropMode();
    await editor.applyCrop();
    await editor.undo();

    const restoredMask = editor.canvas.getObjects().find(object => object.maskId);
    assert.ok(restoredMask);
    assert.equal(restoredMask.maskId, mask.maskId);
    assert.equal(restoredMask.maskName, mask.maskName);
    assert.equal(restoredMask.left, 24);
    assert.equal(restoredMask.top, 28);
    assert.equal(restoredMask.originalStroke, '#123456');
    assert.equal(restoredMask.originalStrokeWidth, 4);
    assert.equal(restoredMask.visible, true);
    assert.equal(restoredMask.evented, true);
    assert.equal(restoredMask.selectable, true);
    editor._showLabelForMask(restoredMask);
    assert.ok(restoredMask.__label);
});

test('applyCrop preserves and shifts masks when preserveMasksAfterCrop is enabled', async (t) => {
    const { editor } = await createEditor({
        crop: {
            minWidth: 40,
            minHeight: 40,
            preserveMasksAfterCrop: true
        }
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor, { width: 200, height: 160 });
    editor.createMask({ left: 30, top: 35, width: 30, height: 30 });

    editor.enterCropMode();
    editor._cropRect.set({ left: 20, top: 25, width: 100, height: 80, scaleX: 1, scaleY: 1 });
    editor._cropRect.setCoords();
    await editor.applyCrop();

    const masks = editor.canvas.getObjects().filter(object => object.maskId);
    assert.equal(masks.length, 1);
    assert.equal(masks[0].left, 10);
    assert.equal(masks[0].top, 10);
    assert.equal(masks[0].evented, true);
    assert.equal(masks[0].selectable, true);
});

test('applyCrop shifts preserved rotated masks by visual center', async (t) => {
    const { editor } = await createEditor({
        maskRotatable: true,
        crop: {
            minWidth: 40,
            minHeight: 40,
            preserveMasksAfterCrop: true
        }
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor, { width: 200, height: 160 });
    const mask = editor.createMask({ left: 50, top: 55, width: 30, height: 30, angle: 35 });
    const centerBefore = mask.getCenterPoint();

    editor.enterCropMode();
    editor._cropRect.set({ left: 20, top: 25, width: 120, height: 90, scaleX: 1, scaleY: 1 });
    editor._cropRect.setCoords();
    await editor.applyCrop();

    const restoredMask = editor.canvas.getObjects().find(object => object.maskId);
    const centerAfter = restoredMask.getCenterPoint();
    assert.ok(Math.abs(centerAfter.x - (centerBefore.x - 20)) < 0.001);
    assert.ok(Math.abs(centerAfter.y - (centerBefore.y - 25)) < 0.001);
    assert.equal(restoredMask.angle, 35);
});

test('applyCrop exports crop regions without trailing partial pixels', async (t) => {
    const { editor } = await createEditor({
        crop: {
            minWidth: 40,
            minHeight: 40
        }
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor, { width: 200, height: 160 });

    editor.enterCropMode();
    const originalGetClampedCanvasRegion = editor._getClampedCanvasRegion.bind(editor);
    let capturedOptions = null;
    editor._getClampedCanvasRegion = (bounds, options = {}) => {
        capturedOptions = options;
        return originalGetClampedCanvasRegion(bounds, options);
    };
    editor._exportCanvasRegionToDataURL = async (region) => makeImageDataUrl({
        width: region.sourceWidth,
        height: region.sourceHeight,
        format: 'image/jpeg'
    });

    await editor.applyCrop();

    assert.equal(capturedOptions.includePartialPixels, false);
});

test('applyCrop falls back to default quality when downsampleQuality is null', async (t) => {
    const { editor } = await createEditor({
        downsampleQuality: null,
        crop: {
            minWidth: 40,
            minHeight: 40
        }
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor, { width: 200, height: 160 });

    let capturedQuality = null;
    editor.enterCropMode();
    editor._exportCanvasRegionToDataURL = async (region) => {
        capturedQuality = region.quality;
        return makeImageDataUrl({
            width: region.sourceWidth,
            height: region.sourceHeight,
            format: 'image/jpeg'
        });
    };

    await editor.applyCrop();

    assert.equal(capturedQuality, 0.92);
});

test('applyCrop rolls back image and masks when crop export fails', async (t) => {
    const errors = [];
    const { editor } = await createEditor({
        crop: {
            minWidth: 40,
            minHeight: 40
        },
        onError: (error, message) => errors.push({ error, message })
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor, { width: 200, height: 160 });
    const mask = editor.createMask({ left: 30, top: 35, width: 30, height: 30 });

    editor.enterCropMode();
    editor._exportCanvasRegionToDataURL = async () => {
        throw new Error('forced crop export failure');
    };

    await editor.applyCrop();

    const masks = editor.canvas.getObjects().filter(object => object.maskId);
    assert.equal(masks.length, 1);
    assert.equal(masks[0].maskId, mask.maskId);
    assert.equal(editor.isImageLoaded(), true);
    assert.equal(editor._cropMode, false);
    assert.equal(editor._cropRect, null);
    assert.equal(errors[0].message, 'applyCrop: failed to create cropped image');
});

test('applyCrop rolls back when mask preparation fails', async (t) => {
    const errors = [];
    const { editor } = await createEditor({
        crop: {
            minWidth: 40,
            minHeight: 40
        },
        onError: (error, message) => errors.push({ error, message })
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor, { width: 200, height: 160 });
    const mask = editor.createMask({ left: 30, top: 35, width: 30, height: 30 });
    const originalRemove = editor.canvas.remove.bind(editor.canvas);
    let didThrow = false;
    editor.canvas.remove = (...objects) => {
        if (!didThrow && objects.some(object => object && object.maskId)) {
            didThrow = true;
            throw new Error('forced mask removal failure');
        }
        return originalRemove(...objects);
    };
    t.after(() => {
        if (editor.canvas) editor.canvas.remove = originalRemove;
    });

    editor.enterCropMode();
    await editor.applyCrop();

    const masks = editor.canvas.getObjects().filter(object => object.maskId);
    assert.equal(masks.length, 1);
    assert.equal(masks[0].maskId, mask.maskId);
    assert.equal(editor._cropMode, false);
    assert.equal(errors[0].message, 'applyCrop: failed to prepare masks');
});

test('first mask addition can be undone after image load', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    editor.createMask({ width: 20, height: 20 });
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 1);

    await editor.undo();

    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 0);
});

test('undo after resizing a newly added mask restores its previous size before removing it', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    const mask = editor.createMask({ width: 20, height: 20 });
    mask.set({ scaleX: 2, scaleY: 1.5 });
    mask.setCoords();
    editor.canvas.fire('object:modified', { target: mask });

    await editor.undo();

    const restoredMask = editor.canvas.getObjects().find(object => object.maskId);
    assert.ok(restoredMask);
    assert.equal(restoredMask.scaleX, 1);
    assert.equal(restoredMask.scaleY, 1);

    await editor.undo();
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 0);
});

test('history undo and redo restore serialized canvas states', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    editor.createMask({ width: 20, height: 20 });
    editor.createMask({ width: 20, height: 20 });
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 2);

    await editor.undo();
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 1);

    await editor.redo();
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 2);
});

test('overlapping undo and redo calls remain serialized by the history queue', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    editor.createMask({ width: 20, height: 20 });
    editor.createMask({ width: 20, height: 20 });

    const firstUndo = editor.undo();
    const secondUndo = editor.undo();
    const firstRedo = editor.redo();

    await Promise.all([firstUndo, secondUndo, firstRedo]);

    const masks = editor.canvas.getObjects().filter(object => object.maskId);
    assert.equal(masks.length, 1);
    assert.equal(masks[0].maskId, 1);
});

test('history undo rejection preserves the current index and reports the failure', async (t) => {
    const errors = [];
    const { editor } = await createEditor({
        onError: (error, message) => errors.push({ error, message })
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);
    editor.createMask({ width: 20, height: 20 });
    const currentIndex = editor.historyManager.currentIndex;
    const originalLoadFromState = editor.loadFromState.bind(editor);
    editor.loadFromState = () => Promise.reject(new Error('forced restore failure'));

    await assert.rejects(
        () => editor.undo(),
        /forced restore failure/
    );

    assert.equal(editor.historyManager.currentIndex, currentIndex);
    assert.equal(errors.some(entry => entry.message === 'undo failed'), true);

    editor.loadFromState = originalLoadFromState;
    await editor.undo();
    assert.equal(editor.historyManager.currentIndex, currentIndex - 1);
});

test('history overflow keeps the current index aligned with shifted commands', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);
    editor.historyManager.maxSize = 2;

    editor.createMask({ width: 20, height: 20 });
    editor.createMask({ width: 20, height: 20 });
    editor.createMask({ width: 20, height: 20 });

    assert.equal(editor.historyManager.history.length, 2);
    assert.equal(editor.historyManager.currentIndex, 1);

    await editor.undo();
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 2);
    assert.equal(editor.historyManager.currentIndex, 0);

    await editor.undo();
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 1);
    assert.equal(editor.historyManager.currentIndex, -1);
});

test('mask hover handlers are rebound after undo and redo restores state', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    editor.createMask({
        width: 20,
        height: 20,
        alpha: 0.4,
        styles: {
            stroke: '#123456',
            strokeWidth: 3
        }
    });
    await editor.undo();
    await editor.redo();

    const mask = editor.canvas.getObjects().find(object => object.maskId);
    assert.ok(mask);

    mask.fire('mouseover');
    assert.equal(mask.stroke, '#ff5500');
    assert.equal(mask.strokeWidth, 2);
    assert.equal(mask.opacity, 0.6000000000000001);

    mask.fire('mouseout');
    assert.equal(mask.stroke, '#123456');
    assert.equal(mask.strokeWidth, 3);
    assert.equal(mask.opacity, 0.4);
});

test('recoverable internal warnings are reported through callbacks', async (t) => {
    const warnings = [];
    const { editor } = await createEditor({
        onWarning: (error, message) => warnings.push({ error, message })
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    const originalToJSON = editor.canvas.toJSON.bind(editor.canvas);
    editor.canvas.toJSON = () => {
        throw new Error('forced snapshot failure');
    };

    editor.saveState();
    editor.canvas.toJSON = originalToJSON;

    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].message, 'saveState: failed to save canvas snapshot');
    assert.match(warnings[0].error.message, /forced snapshot failure/);
});

test('saveState only normalizes masks with temporary selection styles', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    const normalMask = editor.createMask({
        width: 20,
        height: 20,
        styles: {
            stroke: '#123456',
            strokeWidth: 3
        }
    });
    const selectedMask = editor.createMask({ width: 20, height: 20 });

    let normalSetCalls = 0;
    let selectedSetCalls = 0;
    const normalSet = normalMask.set.bind(normalMask);
    const selectedSet = selectedMask.set.bind(selectedMask);
    normalMask.set = (...args) => {
        normalSetCalls += 1;
        return normalSet(...args);
    };
    selectedMask.set = (...args) => {
        selectedSetCalls += 1;
        return selectedSet(...args);
    };

    editor.saveState();

    assert.equal(normalSetCalls, 0);
    assert.equal(selectedSetCalls, 2);
    assert.equal(selectedMask.stroke, '#ff0000');
    assert.equal(selectedMask.strokeWidth, 1);
});

test('loadFromState handles empty or image-less states safely', async (t) => {
    const { editor, ids } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    await editor.loadFromState({ version: '5.5.2', objects: [] });

    assert.equal(editor.originalImage, null);
    assert.equal(editor.isImageLoadedToCanvas, false);
    assert.equal(document.getElementById(ids.addMaskBtn).disabled, true);
});

test('UI button bindings call editor operations', async (t) => {
    const { editor, ids } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    document.getElementById(ids.addMaskBtn).click();
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 1);

    document.getElementById(ids.removeMaskBtn).click();
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 0);

    document.getElementById(ids.cropBtn).click();
    assert.equal(editor._cropMode, true);

    document.getElementById(ids.cancelCropBtn).click();
    assert.equal(editor._cropMode, false);
});

test('upload area click is disabled while crop mode is active', async (t) => {
    const { editor, ids } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    const input = document.getElementById(ids.imageInput);
    let inputClicks = 0;
    input.click = () => {
        inputClicks += 1;
    };

    editor.enterCropMode();
    document.getElementById(ids.uploadArea).click();
    assert.equal(inputClicks, 0);

    editor.cancelCrop();
    document.getElementById(ids.uploadArea).click();
    assert.equal(inputClicks, 1);
});

test('mask list remains clickable after canceling crop mode', async (t) => {
    const { editor, ids } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);
    const firstMask = editor.createMask({ left: 20, top: 20, width: 20, height: 20 });
    editor.createMask({ left: 60, top: 40, width: 20, height: 20 });
    const maskListElement = document.getElementById(ids.maskList);

    editor.enterCropMode();
    assert.equal(maskListElement.style.pointerEvents, 'none');
    assert.equal(maskListElement.getAttribute('aria-disabled'), 'true');

    editor.cancelCrop();

    assert.equal(maskListElement.style.pointerEvents, '');
    assert.equal(maskListElement.hasAttribute('aria-disabled'), false);
    maskListElement.querySelector(`[data-mask-id="${firstMask.maskId}"]`).click();

    assert.equal(editor.canvas.getActiveObject().maskId, firstMask.maskId);
    assert.equal(maskListElement.querySelector(`[data-mask-id="${firstMask.maskId}"]`).classList.contains('active'), true);
});

test('dispose releases canvas references, image loaded state, and restored container overflow', async () => {
    const { editor, ids } = await createEditor({
        coverImageToCanvas: true,
        expandCanvasToImage: false
    }, {
        containerWidth: 120,
        containerHeight: 90
    });
    const container = document.getElementById(ids.canvasContainer);
    container.style.overflow = 'auto';
    await loadFixtureImage(editor);
    assert.equal(container.style.overflow, 'scroll');

    editor.dispose();

    assert.equal(editor.canvas, null);
    assert.equal(editor.canvasElement, null);
    assert.equal(editor.canvasEl, null);
    assert.equal(editor.isImageLoadedToCanvas, false);
    assert.equal(container.style.overflow, 'auto');
});

test('dispose removes file input and rotation button listeners', async (t) => {
    const { editor, ids } = await createEditor();
    t.after(() => disposeEditor(editor));

    let rotateCalls = 0;
    let loadFileCalls = 0;
    editor.rotateImage = () => {
        rotateCalls += 1;
        return Promise.resolve();
    };
    editor._loadImageFile = () => {
        loadFileCalls += 1;
    };

    const input = document.getElementById(ids.imageInput);
    Object.defineProperty(input, 'files', {
        configurable: true,
        value: [{ type: 'image/png' }]
    });

    editor.dispose();

    document.getElementById(ids.rotateLeftBtn).click();
    document.getElementById(ids.rotateRightBtn).click();
    input.dispatchEvent(new window.Event('change', { bubbles: true }));

    assert.equal(rotateCalls, 0);
    assert.equal(loadFileCalls, 0);
});

test('workflow loads through file input, zooms, adds a mask, and exports PNG', async (t) => {
    let resolveLoaded;
    const loadedPromise = new Promise(resolve => { resolveLoaded = resolve; });
    const { editor, ids } = await createEditor({
        fitImageToCanvas: true,
        expandCanvasToImage: false,
        onImageLoaded: resolveLoaded
    }, {
        containerWidth: 160,
        containerHeight: 120
    });
    t.after(() => disposeEditor(editor));

    const input = document.getElementById(ids.imageInput);
    Object.defineProperty(input, 'files', {
        configurable: true,
        value: [dataUrlToFile(makeImageDataUrl({ width: 100, height: 80 }), 'workflow-input.png')]
    });
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
    await loadedPromise;

    await editor.scaleImage(1.1);
    editor.createMask({ left: 12, top: 16, width: 30, height: 24 });
    const file = await editor.exportImageFile({ mergeMask: false, fileType: 'png', fileName: 'plain-workflow.png' });

    assert.equal(editor.isImageLoaded(), true);
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 1);
    assert.equal(file.name, 'plain-workflow.png');
    assert.equal(file.type, 'image/png');
});

test('file loading accepts image extensions when MIME type is empty and resets the input', async (t) => {
    let resolveLoaded;
    const loadedPromise = new Promise(resolve => { resolveLoaded = resolve; });
    const { editor, ids } = await createEditor({
        onImageLoaded: resolveLoaded
    });
    t.after(() => disposeEditor(editor));

    const input = document.getElementById(ids.imageInput);
    const file = dataUrlToFile(makeImageDataUrl({ width: 48, height: 32 }), 'empty-type.png');
    Object.defineProperty(file, 'type', {
        configurable: true,
        value: ''
    });
    Object.defineProperty(input, 'files', {
        configurable: true,
        value: [file]
    });
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
    await loadedPromise;
    await waitForCanvasCallbacks(20);

    assert.equal(editor.isImageLoaded(), true);
    assert.equal(input.value, '');
});

test('workflow loads base64, fits image, rotates, crops, then undo and redo restore crop states', async (t) => {
    const { editor } = await createEditor({
        fitImageToCanvas: true,
        expandCanvasToImage: false,
        minScale: 0.5,
        maxScale: 2,
        crop: {
            minWidth: 30,
            minHeight: 30
        }
    }, {
        containerWidth: 220,
        containerHeight: 160
    });
    t.after(() => disposeEditor(editor));

    await editor.loadImage(makeImageDataUrl({ width: 240, height: 160 }));
    await editor.scaleImage(1.1);
    await editor.rotateImage(90);
    editor.createMask({ left: 15, top: 20, width: 40, height: 35 });

    editor.enterCropMode();
    editor._cropRect.set({ left: 0, top: 0, width: 70, height: 90, scaleX: 1, scaleY: 1 });
    editor._cropRect.setCoords();
    await editor.applyCrop();

    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 0);

    await editor.undo();
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 1);

    await editor.redo();
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 0);
});

test('workflow preserveMasksAfterCrop keeps intersecting masks and removes outside masks', async (t) => {
    const { editor } = await createEditor({
        crop: {
            minWidth: 30,
            minHeight: 30,
            preserveMasksAfterCrop: true
        }
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor, { width: 200, height: 160 });

    const insideMask = editor.createMask({ left: 30, top: 35, width: 30, height: 30 });
    editor.createMask({ left: 155, top: 125, width: 20, height: 20 });

    editor.enterCropMode();
    editor._cropRect.set({ left: 20, top: 25, width: 100, height: 80, scaleX: 1, scaleY: 1 });
    editor._cropRect.setCoords();
    await editor.applyCrop();

    const masks = editor.canvas.getObjects().filter(object => object.maskId);
    assert.equal(masks.length, 1);
    assert.equal(masks[0].maskId, insideMask.maskId);
    assert.equal(masks[0].left, 10);
    assert.equal(masks[0].top, 10);
});

test('workflow crop can leave masks visible when hideMasksDuringCrop is disabled', async (t) => {
    const { editor } = await createEditor({
        crop: {
            hideMasksDuringCrop: false
        }
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);
    const mask = editor.createMask({ width: 24, height: 24 });

    editor.enterCropMode();
    assert.equal(mask.visible, true);

    editor.cancelCrop();
    assert.equal(mask.visible, true);
    assert.equal(mask.evented, true);
});

test('workflow cover mode merges masks, then undo and redo restore editable scale metadata', async (t) => {
    const { editor, ids } = await createEditor({
        canvasWidth: 200,
        canvasHeight: 100,
        coverImageToCanvas: true,
        expandCanvasToImage: false,
        minScale: 0.1,
        maxScale: 3
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor, { width: 400, height: 200 });

    await editor.scaleImage(1.5);
    const baseImageScaleBeforeMerge = editor.baseImageScale;
    editor.createMask({ left: 20, top: 20, width: 25, height: 25 });
    await editor.mergeMasks();

    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 0);

    await editor.undo();
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 1);
    assert.equal(editor.baseImageScale, baseImageScaleBeforeMerge);
    assert.equal(editor.currentScale, 1.5);
    assert.equal(document.getElementById(ids.scaleRate).value, '150');
    assert.ok(Math.abs(editor.originalImage.scaleX - (baseImageScaleBeforeMerge * 1.5)) < 0.01);

    await editor.redo();
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 0);

    const exported = await editor.exportImageFile({ mergeMask: false, fileType: 'webp', fileName: 'cover.webp' });
    assert.equal(exported.name, 'cover.webp');
    assert.equal(exported.type, 'image/webp');
});

test('workflow moved and resized masks are tracked through undo and redo', async (t) => {
    const { editor } = await createEditor({
        expandCanvasToImage: true
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor, { width: 120, height: 90 });

    const mask = editor.createMask({ left: 10, top: 10, width: 30, height: 20 });
    mask.set({ left: 70, top: 55, scaleX: 1.5, scaleY: 1.25 });
    mask.setCoords();
    editor.saveState();

    await editor.undo();
    const restored = editor.canvas.getObjects().find(object => object.maskId);
    assert.equal(restored.left, 10);
    assert.equal(restored.top, 10);
    assert.equal(restored.scaleX, 1);

    await editor.redo();
    const moved = editor.canvas.getObjects().find(object => object.maskId);
    assert.equal(moved.left, 70);
    assert.equal(moved.top, 55);
    assert.equal(moved.scaleX, 1.5);
    assert.equal(moved.scaleY, 1.25);
});

test('workflow with rotatable ellipse and polygon masks exports merged PNG', async (t) => {
    const { editor } = await createEditor({
        groupSelection: true,
        maskRotatable: true,
        maskName: 'workflow-mask-'
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor, { width: 180, height: 120 });

    const ellipse = editor.createMask({
        shape: 'ellipse',
        left: 25,
        top: 20,
        rx: 20,
        ry: 12,
        angle: 15
    });
    const polygon = editor.createMask({
        shape: 'polygon',
        left: 80,
        top: 40,
        points: [{ x: 0, y: 0 }, { x: 30, y: 5 }, { x: 12, y: 28 }]
    });

    assert.equal(ellipse.lockRotation, false);
    assert.equal(polygon.maskName, 'workflow-mask-2');

    const imageBase64 = await editor.exportImageBase64({ exportImageArea: true, fileType: 'png', multiplier: 1 });
    assert.match(imageBase64, /^data:image\/png;base64,/);
});

test('workflow initialImageBase64 loads automatically and participates in undo and redo', async (t) => {
    let resolveLoaded;
    const loadedPromise = new Promise(resolve => { resolveLoaded = resolve; });
    const { editor } = await createEditor({
        initialImageBase64: makeImageDataUrl({ width: 90, height: 70 }),
        onImageLoaded: resolveLoaded
    });
    t.after(() => disposeEditor(editor));
    await loadedPromise;

    editor.createMask({ width: 18, height: 18 });
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 1);

    await editor.undo();
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 0);

    await editor.redo();
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 1);
});

test('workflow crop followed by multiplier export scales the final output dimensions', async (t) => {
    const { editor } = await createEditor({
        crop: {
            minWidth: 30,
            minHeight: 30
        }
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor, { width: 200, height: 120 });

    editor.enterCropMode();
    editor._cropRect.set({ left: 10, top: 15, width: 80, height: 60, scaleX: 1, scaleY: 1 });
    editor._cropRect.setCoords();
    await editor.applyCrop();

    const imageBase64 = await editor.exportImageBase64({ exportImageArea: true, fileType: 'png', multiplier: 1 });
    const doubledBase64 = await editor.exportImageBase64({ exportImageArea: true, fileType: 'png', multiplier: 2 });
    const size = await getImageDimensionsFromDataUrl(imageBase64);
    const doubledSize = await getImageDimensionsFromDataUrl(doubledBase64);

    assert.equal(doubledSize.width, size.width * 2);
    assert.equal(doubledSize.height, size.height * 2);
});

test('workflow download uses exportImageAreaByDefault and exportMultiplier options', async (t) => {
    const { editor } = await createEditor({
        defaultDownloadFileName: 'workflow-download.jpg',
        exportImageAreaByDefault: false,
        exportMultiplier: 3
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);
    editor.createMask({ width: 20, height: 20 });

    const calls = [];
    editor.exportImageBase64 = async (options) => {
        calls.push(options);
        return makeImageDataUrl({ width: 12, height: 8, format: 'image/jpeg' });
    };

    const originalCreateElement = document.createElement.bind(document);
    let clickedAnchor = null;
    document.createElement = (tagName) => {
        const element = originalCreateElement(tagName);
        if (String(tagName).toLowerCase() === 'a') {
            element.click = () => {
                clickedAnchor = element;
            };
        }
        return element;
    };
    t.after(() => {
        document.createElement = originalCreateElement;
    });

    editor.downloadImage();
    await waitForCanvasCallbacks(100);

    assert.equal(calls[0].exportImageArea, false);
    assert.equal(calls[0].multiplier, 3);
    assert.equal(clickedAnchor.download, 'workflow-download.jpg');
    assert.match(clickedAnchor.href, /^data:image\/jpeg;base64,/);
});

test('workflow mask move and rotate are undoable through object:modified', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    const mask = editor.createMask({ left: 10, top: 12, width: 24, height: 20 });
    mask.set({ left: 48, top: 36, angle: 25 });
    mask.setCoords();
    editor.canvas.fire('object:modified', { target: mask });

    await editor.undo();
    let restored = editor.canvas.getObjects().find(object => object.maskId);
    assert.equal(restored.left, 10);
    assert.equal(restored.top, 12);
    assert.equal(restored.angle, 0);

    await editor.redo();
    restored = editor.canvas.getObjects().find(object => object.maskId);
    assert.equal(restored.left, 48);
    assert.equal(restored.top, 36);
    assert.equal(restored.angle, 25);
});

test('workflow group-selected masks are saved as one undoable modification', async (t) => {
    const { editor } = await createEditor({
        groupSelection: true
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    const first = editor.createMask({ left: 10, top: 10, width: 20, height: 20 });
    const second = editor.createMask({ left: 50, top: 50, width: 20, height: 20 });
    first.set({ left: 24, top: 18 });
    second.set({ left: 70, top: 62 });
    first.setCoords();
    second.setCoords();
    editor.canvas.fire('object:modified', {
        target: {
            getObjects: () => [first, second]
        }
    });

    await editor.undo();
    let masks = editor.canvas.getObjects().filter(object => object.maskId).sort((a, b) => a.maskId - b.maskId);
    assert.equal(masks[0].left, 10);
    assert.equal(masks[0].top, 10);
    assert.equal(masks[1].left, 50);
    assert.equal(masks[1].top, 50);

    await editor.redo();
    masks = editor.canvas.getObjects().filter(object => object.maskId).sort((a, b) => a.maskId - b.maskId);
    assert.equal(masks[0].left, 24);
    assert.equal(masks[0].top, 18);
    assert.equal(masks[1].left, 70);
    assert.equal(masks[1].top, 62);
});

test('workflow group mask modification expands the canvas once for the full selection bounds', async (t) => {
    const { editor } = await createEditor({
        canvasWidth: 100,
        canvasHeight: 80,
        expandCanvasToImage: true,
        groupSelection: true
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor, { width: 100, height: 80 });
    const first = editor.createMask({ left: 10, top: 10, width: 20, height: 20 });
    const second = editor.createMask({ left: 40, top: 25, width: 20, height: 20 });
    let resizeCount = 0;
    const originalSetCanvasSizeInt = editor._setCanvasSizeInt.bind(editor);
    editor._setCanvasSizeInt = (...args) => {
        resizeCount += 1;
        return originalSetCanvasSizeInt(...args);
    };

    first.set({ left: 130, top: 90 });
    second.set({ left: 170, top: 120 });
    first.setCoords();
    second.setCoords();
    editor.canvas.fire('object:modified', {
        target: {
            getObjects: () => [first, second]
        }
    });

    assert.equal(resizeCount, 1);
    assert.ok(editor.canvas.getWidth() >= 200);
    assert.ok(editor.canvas.getHeight() >= 150);
});

test('saveState serializes without removing the selected mask label', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);
    const mask = editor.createMask({ left: 10, top: 10, width: 20, height: 20 });
    editor.canvas.setActiveObject(mask);
    editor._handleSelectionChanged([mask]);
    const label = mask.__label;
    let removedLabels = 0;
    const originalRemove = editor.canvas.remove.bind(editor.canvas);
    editor.canvas.remove = (...objects) => {
        removedLabels += objects.filter(object => object && object.maskLabel).length;
        return originalRemove(...objects);
    };

    mask.set({ left: 30 });
    mask.setCoords();
    editor.saveState();

    assert.equal(mask.__label, label);
    assert.equal(removedLabels, 0);
});

test('workflow remove selected mask can be undone and redone', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    const mask = editor.createMask({ left: 20, top: 20, width: 20, height: 20 });
    editor.canvas.setActiveObject(mask);
    editor.removeSelectedMask();

    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 0);

    await editor.undo();
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 1);

    await editor.redo();
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 0);
});

test('workflow remove selected masks supports Fabric ActiveSelection undo and redo', async (t) => {
    const { editor } = await createEditor({
        groupSelection: true
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    const first = editor.createMask({ left: 20, top: 20, width: 20, height: 20 });
    const second = editor.createMask({ left: 60, top: 45, width: 20, height: 20 });
    const selection = new fabric.ActiveSelection([first, second], {
        canvas: editor.canvas
    });
    editor.canvas.setActiveObject(selection);

    editor.removeSelectedMask();
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 0);

    await editor.undo();
    let masks = editor.canvas.getObjects().filter(object => object.maskId);
    assert.equal(masks.length, 2);

    await editor.redo();
    masks = editor.canvas.getObjects().filter(object => object.maskId);
    assert.equal(masks.length, 0);
});

test('workflow remove all masks can be undone and redone', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    editor.createMask({ left: 10, top: 10, width: 20, height: 20 });
    editor.createMask({ left: 40, top: 30, width: 20, height: 20 });
    editor.createMask({ shape: 'circle', left: 80, top: 60, radius: 10 });
    editor.removeAllMasks();

    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 0);

    await editor.undo();
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 3);

    await editor.redo();
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 0);
});

test('workflow toolbar zoom and rotate buttons create undoable states', async (t) => {
    const { editor, ids } = await createEditor({
        scaleStep: 0.2,
        rotationStep: 45
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    document.getElementById(ids.zoomInBtn).click();
    await waitForCondition(() => !editor.isAnimating && editor.currentScale === 1.2);
    assert.equal(editor.currentScale, 1.2);

    document.getElementById(ids.rotationRightInput).value = '30';
    document.getElementById(ids.rotateRightBtn).click();
    await waitForCondition(() => !editor.isAnimating && editor.currentRotation === 30);
    assert.equal(editor.currentRotation, 30);

    await editor.undo();
    assert.equal(editor.currentRotation, 0);
    assert.equal(editor.currentScale, 1.2);

    await editor.undo();
    assert.equal(editor.currentScale, 1);
});

test('workflow crop toolbar cancel is non-destructive and apply is undoable', async (t) => {
    const { editor, ids } = await createEditor({
        crop: {
            minWidth: 30,
            minHeight: 30
        }
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor, { width: 180, height: 120 });
    editor.createMask({ left: 20, top: 20, width: 20, height: 20 });

    const historyLength = editor.historyManager.history.length;
    document.getElementById(ids.cropBtn).click();
    assert.equal(editor._cropMode, true);
    document.getElementById(ids.cancelCropBtn).click();
    assert.equal(editor._cropMode, false);
    assert.equal(editor.historyManager.history.length, historyLength);

    document.getElementById(ids.cropBtn).click();
    editor._cropRect.set({ left: 0, top: 0, width: 70, height: 60, scaleX: 1, scaleY: 1 });
    editor._cropRect.setCoords();
    document.getElementById(ids.applyCropBtn).click();
    await waitForCanvasCallbacks(150);

    assert.equal(editor._cropMode, false);
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 0);

    await editor.undo();
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 1);
});

test('workflow adding a new mask after undo truncates redo history', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    editor.createMask({ left: 10, top: 10, width: 20, height: 20 });
    editor.createMask({ left: 100, top: 100, width: 20, height: 20 });
    await editor.undo();
    editor.createMask({ left: 42, top: 42, width: 20, height: 20 });
    await editor.redo();

    const masks = editor.canvas.getObjects().filter(object => object.maskId);
    assert.equal(masks.length, 2);
    assert.equal(masks.some(mask => mask.left === 42 && mask.top === 42), true);
    assert.equal(masks.some(mask => mask.left === 100 && mask.top === 100), false);
});

test('workflow merged export does not mutate editable masks', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor, { width: 160, height: 120 });

    const mask = editor.createMask({
        left: 25,
        top: 25,
        width: 35,
        height: 30,
        alpha: 0.35,
        styles: {
            stroke: '#abcdef',
            strokeWidth: 4
        }
    });

    const file = await editor.exportImageFile({ mergeMask: true, fileType: 'png', fileName: 'merged-mask.png' });

    const masks = editor.canvas.getObjects().filter(object => object.maskId);
    assert.equal(file.type, 'image/png');
    assert.equal(masks.length, 1);
    assert.equal(masks[0].maskId, mask.maskId);
    assert.equal(masks[0].stroke, '#ff0000');
    assert.equal(masks[0].originalStroke, '#abcdef');
    assert.equal(masks[0].originalStrokeWidth, 4);
});

test('workflow reset after mask edits preserves mask edit history ordering', async (t) => {
    const { editor } = await createEditor({
        minScale: 0.5,
        maxScale: 2
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    const mask = editor.createMask({ left: 10, top: 10, width: 20, height: 20 });
    mask.set({ scaleX: 1.8, scaleY: 1.2 });
    mask.setCoords();
    editor.canvas.fire('object:modified', { target: mask });
    await editor.scaleImage(1.5);
    await editor.rotateImage(45);
    await editor.resetImageTransform();

    await editor.undo();
    assert.equal(editor.currentRotation, 45);
    assert.equal(editor.currentScale, 1.5);

    await editor.undo();
    await editor.undo();
    const restoredMask = editor.canvas.getObjects().find(object => object.maskId);
    assert.equal(restoredMask.scaleX, 1.8);
    assert.equal(restoredMask.scaleY, 1.2);

    await editor.undo();
    const originalMask = editor.canvas.getObjects().find(object => object.maskId);
    assert.equal(originalMask.scaleX, 1);
    assert.equal(originalMask.scaleY, 1);
});
