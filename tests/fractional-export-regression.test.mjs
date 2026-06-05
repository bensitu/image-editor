import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    createEditor,
    disposeEditor,
    fabric,
    getImageDimensionsFromDataUrl,
    loadFixtureImage,
} from './helpers/fabric-environment.mjs';

function makeEdgeBorderImageDataUrl({
    width = 100,
    height = 200,
    fill = '#ffffff',
    right = true,
    bottom = false,
    edgeColor = '#000000',
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
    const imageData =
        edge === 'bottom'
            ? context.getImageData(0, canvas.height - 1, canvas.width, 1).data
            : context.getImageData(canvas.width - 1, 0, 1, canvas.height).data;
    let luminanceSum = 0;
    for (let index = 0; index < imageData.length; index += 4) {
        luminanceSum += (imageData[index] + imageData[index + 1] + imageData[index + 2]) / 3;
    }
    return luminanceSum / (imageData.length / 4);
}

test('mergeMasks preserves the right edge when image width lands on a partial pixel', async (t) => {
    const { editor } = await createEditor(
        {
            fitImageToCanvas: true,
            expandCanvasToImage: false,
            exportMultiplier: 1,
        },
        {
            containerWidth: 120,
            containerHeight: 80,
        },
    );
    t.after(() => disposeEditor(editor));

    await editor.loadImage(makeEdgeBorderImageDataUrl({ width: 100, height: 200, right: true }));
    editor.createMask({ left: 5, top: 5, width: 10, height: 10 });

    editor.originalImage.setCoords();
    const imageBounds = editor.originalImage.getBoundingRect();
    assert.equal(imageBounds.width, 39.5);

    await editor.mergeMasks();
    const exportedAfterMerge = await editor.exportImageBase64({
        exportArea: 'image',
        mergeMask: true,
        fileType: 'png',
        multiplier: 1,
    });
    const size = await getImageDimensionsFromDataUrl(exportedAfterMerge);
    const rightEdgeLuminance = await getEdgeAverageLuminance(exportedAfterMerge, 'right');

    assert.equal(size.width, 40);
    assert.ok(
        rightEdgeLuminance < 180,
        `expected a visible dark right edge, got luminance ${rightEdgeLuminance}`,
    );
});

test('mergeMasks preserves the bottom edge when image height lands on a partial pixel', async (t) => {
    const { editor } = await createEditor(
        {
            fitImageToCanvas: true,
            expandCanvasToImage: false,
            exportMultiplier: 1,
        },
        {
            containerWidth: 120,
            containerHeight: 80,
        },
    );
    t.after(() => disposeEditor(editor));

    await editor.loadImage(
        makeEdgeBorderImageDataUrl({ width: 200, height: 100, right: false, bottom: true }),
    );
    editor.createMask({ left: 5, top: 5, width: 10, height: 10 });

    editor.originalImage.setCoords();
    const imageBounds = editor.originalImage.getBoundingRect();
    assert.equal(imageBounds.height, 59.5);

    await editor.mergeMasks();
    const exportedAfterMerge = await editor.exportImageBase64({
        exportArea: 'image',
        mergeMask: true,
        fileType: 'png',
        multiplier: 1,
    });
    const size = await getImageDimensionsFromDataUrl(exportedAfterMerge);
    const bottomEdgeLuminance = await getEdgeAverageLuminance(exportedAfterMerge, 'bottom');

    assert.equal(size.height, 60);
    assert.ok(
        bottomEdgeLuminance < 180,
        `expected a visible dark bottom edge, got luminance ${bottomEdgeLuminance}`,
    );
});

test('JPEG export composites partial transparent edges without introducing black pixels', async (t) => {
    const { editor } = await createEditor(
        {
            fitImageToCanvas: true,
            expandCanvasToImage: false,
            exportMultiplier: 1,
        },
        {
            containerWidth: 120,
            containerHeight: 80,
        },
    );
    t.after(() => disposeEditor(editor));

    await editor.loadImage(
        makeEdgeBorderImageDataUrl({ width: 200, height: 100, right: false, bottom: false }),
    );
    editor.originalImage.setCoords();
    const imageBounds = editor.originalImage.getBoundingRect();
    assert.equal(imageBounds.height, 59.5);

    const exported = await editor.exportImageBase64({
        exportArea: 'image',
        mergeMask: true,
        fileType: 'jpeg',
        multiplier: 1,
        quality: 0.92,
    });
    const size = await getImageDimensionsFromDataUrl(exported);
    const bottomEdgeLuminance = await getEdgeAverageLuminance(exported, 'bottom');

    assert.equal(size.height, 60);
    assert.ok(
        bottomEdgeLuminance > 230,
        `expected a light bottom edge, got luminance ${bottomEdgeLuminance}`,
    );
});

test('facade blocks mutating operations while a load is active', async (t) => {
    const { editor } = await createEditor();
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);

    editor.operationGuard.beginLoading();
    try {
        assert.equal(editor.createMask({ width: 20, height: 20 }), null);
        assert.equal(await editor.exportImageBase64({ exportArea: 'image' }), '');
        await assert.rejects(() => editor.scaleImage(1.1), /image is loading/);
    } finally {
        editor.operationGuard.endLoading();
    }
});
