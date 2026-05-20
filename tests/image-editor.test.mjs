import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    createEditor,
    disposeEditor,
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

test('dispose releases canvas references and image loaded state', async () => {
    const { editor } = await createEditor();
    await loadFixtureImage(editor);

    editor.dispose();

    assert.equal(editor.canvas, null);
    assert.equal(editor.canvasEl, null);
    assert.equal(editor.isImageLoadedToCanvas, false);
});
