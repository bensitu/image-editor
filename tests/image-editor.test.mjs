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
    const [header, base64] = dataUrl.split(',');
    const mime = (header.match(/^data:([^;]+);base64$/) || [])[1] || 'image/png';
    const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
    return new File([bytes], fileName, { type: mime });
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

    const circle = editor.createMask({ shape: 'circle', radius: 10 });
    assert.equal(circle.type, 'circle');
    assert.equal(circle.left, rect.left + rect.getScaledWidth() + 5);

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

test('label getText receives the current mask list index', async (t) => {
    const calls = [];
    const { editor } = await createEditor({
        maskLabelOnSelect: true,
        label: {
            getText: (mask, maskIndex) => {
                calls.push({ maskName: mask.maskName, maskIndex });
                return `${maskIndex}:${mask.maskName}`;
            }
        }
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    editor.createMask({ width: 20, height: 20 });
    editor.createMask({ width: 20, height: 20 });

    assert.deepEqual([...new Set(calls.map(call => call.maskIndex))], [0, 1]);
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
    const base64 = await editor.exportImageBase64({ exportImageArea: true, multiplier: 1 });
    assert.match(base64, /^data:image\/jpeg;base64,/);

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

test('exportImageBase64 can export directly to PNG', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    const base64 = await editor.exportImageBase64({ exportImageArea: false, fileType: 'png', multiplier: 1 });

    assert.match(base64, /^data:image\/png;base64,/);
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

    const base64 = await editor.exportImageBase64({ exportImageArea: true, multiplier: 1 });
    const size = await getImageDimensionsFromDataUrl(base64);

    assert.equal(editor.canvas.getHeight(), 197);
    assert.equal(size.width, 118);
    assert.equal(size.height, 196);
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
    const base64 = await editor.exportImageBase64({ exportImageArea: false, multiplier: 1 });
    const size = await getImageDimensionsFromDataUrl(base64);

    assert.equal(size.width, 40);
    assert.equal(size.height, 80);
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
    editor.undo();
    await waitForCanvasCallbacks(100);

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
    editor.createMask({ width: 30, height: 30 });

    editor.enterCropMode();
    await editor.applyCrop();
    editor.undo();
    await waitForCanvasCallbacks(100);

    const restoredMask = editor.canvas.getObjects().find(object => object.maskId);
    assert.ok(restoredMask);
    assert.equal(restoredMask.visible, true);
    assert.equal(restoredMask.evented, true);
    assert.equal(restoredMask.selectable, true);
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

test('first mask addition can be undone after image load', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    editor.createMask({ width: 20, height: 20 });
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 1);

    editor.undo();
    await waitForCanvasCallbacks(100);

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

    editor.undo();
    await waitForCanvasCallbacks(100);
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 1);

    editor.redo();
    await waitForCanvasCallbacks(100);
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 2);
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
    editor.undo();
    await waitForCanvasCallbacks(100);
    editor.redo();
    await waitForCanvasCallbacks(100);

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

test('workflow cover mode merges masks, then undo and redo switch between editable and flattened states', async (t) => {
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
    editor.createMask({ left: 20, top: 20, width: 25, height: 25 });
    await editor.mergeMasks();

    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 0);

    await editor.undo();
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 1);

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

    const base64 = await editor.exportImageBase64({ exportImageArea: true, fileType: 'png', multiplier: 1 });
    assert.match(base64, /^data:image\/png;base64,/);
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

    const base64 = await editor.exportImageBase64({ exportImageArea: true, fileType: 'png', multiplier: 1 });
    const doubledBase64 = await editor.exportImageBase64({ exportImageArea: true, fileType: 'png', multiplier: 2 });
    const size = await getImageDimensionsFromDataUrl(base64);
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
