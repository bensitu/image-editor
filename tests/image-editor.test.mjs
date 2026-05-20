import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    createEditor,
    disposeEditor,
    getImageDimensionsFromDataUrl,
    loadFixtureImage,
    makeImageDataUrl,
    waitForCanvasCallbacks
} from './helpers/fabric-environment.mjs';

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

    await editor.reset();
    assert.equal(editor.currentScale, 1);
    assert.equal(editor.currentRotation, 0);
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

test('addMask supports standard shapes, labels, DOM list updates, and remove operations', async (t) => {
    const { editor, ids } = await createEditor({
        maskName: 'unit-mask-',
        maskLabelOnSelect: true,
        maskRotatable: true
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    const rect = editor.addMask({ width: 30, height: 40 });
    assert.equal(rect.maskId, 1);
    assert.equal(rect.maskName, 'unit-mask-1');
    assert.equal(rect.left, 10);
    assert.equal(rect.top, 10);
    assert.equal(rect.lockRotation, false);
    assert.ok(rect.__label);
    assert.equal(document.getElementById(ids.maskList).children.length, 1);

    const circle = editor.addMask({ shape: 'circle', radius: 10 });
    assert.equal(circle.type, 'circle');
    assert.equal(circle.left, rect.left + rect.getScaledWidth() + 5);

    const polygon = editor.addMask({
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

test('mask placement memory is cleared after selected and bulk removal', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    const first = editor.addMask({ width: 30, height: 30 });
    assert.equal(first.left, 10);
    editor.removeSelectedMask();

    const afterSelectedRemove = editor.addMask({ width: 30, height: 30 });
    assert.equal(afterSelectedRemove.left, 10);
    assert.equal(afterSelectedRemove.top, 10);

    editor.removeAllMasks();
    const afterRemoveAll = editor.addMask({ width: 30, height: 30 });
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

    editor.addMask({ shape: 'circle', left: 90, top: 70, radius: 20 });

    assert.equal(editor.canvas.getWidth() >= 140, true);
    assert.equal(editor.canvas.getHeight() >= 120, true);
});

test('getImageBase64 exports image data and restores mask state when export fails', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    const mask = editor.addMask({
        color: 'rgba(12,34,56,0.5)',
        alpha: 0.4,
        styles: {
            stroke: '#123456',
            strokeWidth: 3
        }
    });
    const base64 = await editor.getImageBase64({ exportImageArea: true, multiplier: 1 });
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
        () => editor.getImageBase64({ exportImageArea: true }),
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

test('getImageBase64 exports the scrollable image area in cover-canvas mode', async (t) => {
    const { editor } = await createEditor({
        canvasWidth: 120,
        canvasHeight: 80,
        coverImageToCanvas: true,
        expandCanvasToImage: false
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor, { width: 120, height: 200 });
    editor.addMask({ width: 20, height: 20 });

    const base64 = await editor.getImageBase64({ exportImageArea: true, multiplier: 1 });
    const size = await getImageDimensionsFromDataUrl(base64);

    assert.equal(size.width, 118);
    assert.equal(size.height, 197);
});

test('getImageBase64 exportImageArea false preserves image transforms and omits masks', async (t) => {
    const { editor } = await createEditor({
        canvasWidth: 120,
        canvasHeight: 120,
        expandCanvasToImage: true
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor, { width: 80, height: 40 });
    editor.addMask({ width: 20, height: 20 });

    await editor.rotateImage(90);
    const base64 = await editor.getImageBase64({ exportImageArea: false, multiplier: 1 });
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
    editor.addMask({ width: 20, height: 20 });

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

test('exportImageFile forwards quality to getImageBase64 for both export modes', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    const calls = [];
    editor.getImageBase64 = async (opts) => {
        calls.push(opts);
        return makeImageDataUrl({ width: 8, height: 8, format: 'image/jpeg' });
    };

    await editor.exportImageFile({ mergeMask: true, quality: 0.31, multiplier: 2 });
    await editor.exportImageFile({ mergeMask: false, quality: 0.47, multiplier: 3 });

    assert.equal(calls[0].quality, 0.31);
    assert.equal(calls[0].multiplier, 2);
    assert.equal(calls[1].quality, 0.47);
    assert.equal(calls[1].multiplier, 3);
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

test('merge flattens masks into a newly loaded base image', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);
    editor.addMask({ width: 30, height: 30 });

    await editor.merge();

    assert.equal(editor.isImageLoaded(), true);
    assert.equal(editor.isImageLoadedToCanvas, true);
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 0);
    assert.equal(editor.canvas.getObjects().filter(object => object.type === 'image').length, 1);
});

test('merge undo restores mask control styling', async (t) => {
    const { editor } = await createEditor({
        maskRotatable: true
    });
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);
    editor.addMask({
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

    await editor.merge();
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
    editor.addMask({ width: 30, height: 30 });

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
    const mask = editor.addMask({ width: 30, height: 30 });

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
    editor.addMask({ width: 30, height: 30 });

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
    editor.addMask({ left: 30, top: 35, width: 30, height: 30 });

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

test('first mask addition can be undone after image load', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    editor.addMask({ width: 20, height: 20 });
    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 1);

    editor.undo();
    await waitForCanvasCallbacks(100);

    assert.equal(editor.canvas.getObjects().filter(object => object.maskId).length, 0);
});

test('history undo and redo restore serialized canvas states', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    editor.addMask({ width: 20, height: 20 });
    editor.addMask({ width: 20, height: 20 });
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

    editor.addMask({
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

    editor.loadFromState({ version: '5.5.2', objects: [] });
    await waitForCanvasCallbacks(100);

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
    assert.equal(editor.canvasEl, null);
    assert.equal(editor.isImageLoadedToCanvas, false);
    assert.equal(container.style.overflow, 'auto');
});
