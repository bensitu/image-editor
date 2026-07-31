import assert from 'node:assert/strict';
import test from 'node:test';

import { ImageEditorCore } from '../../src/core/index.js';
import { transformPlugin } from '../../src/plugins/transform/index.js';
import { fabric, makeImageDataUrl, resetEditorDom } from '../helpers/fabric-environment.mjs';

function pngHeaderDataUrl(width, height) {
    const bytes = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0);
    Buffer.from('IHDR').copy(bytes, 12);
    bytes.writeUInt32BE(width, 16);
    bytes.writeUInt32BE(height, 20);
    return `data:image/png;base64,${bytes.toString('base64')}`;
}

test('external state restore enforces the active Core dimension budget atomically', async () => {
    const ids = resetEditorDom();
    const editor = new ImageEditorCore(fabric, {
        canvasWidth: 320,
        canvasHeight: 240,
        maxExportDimension: 16_384,
        maxExportPixels: 64 * 1024 * 1024,
    });
    const transform = editor.use(transformPlugin({ animationDuration: 0 }));
    await editor.init({ canvas: ids.canvas });
    await editor.loadImage(makeImageDataUrl({ width: 120, height: 80 }));
    await transform.rotate(17);

    const before = editor.saveState();
    const malicious = JSON.parse(before);
    malicious.core.canvasWidth = 20_000;
    malicious.core.canvasHeight = 100;

    await assert.rejects(editor.loadFromState(malicious), /budget/i);
    assert.equal(editor.saveState(), before);
    assert.deepEqual(transform.getState(), {
        scale: 1,
        rotationDegrees: 17,
        flipX: false,
        flipY: false,
    });
    await editor.disposeAsync();
});

test('encoded image headers reject an oversized single dimension before decode', async () => {
    const ids = resetEditorDom();
    let decodeCalls = 0;
    class TrackingFabricImage extends fabric.FabricImage {
        static fromURL() {
            decodeCalls += 1;
            return Promise.reject(new Error('decode must not run'));
        }
    }
    const editor = new ImageEditorCore(
        { ...fabric, FabricImage: TrackingFabricImage },
        {
            canvasWidth: 320,
            canvasHeight: 240,
            maxInputPixels: 64 * 1024 * 1024,
            maxExportDimension: 16_384,
        },
    );
    await editor.init({ canvas: ids.canvas });

    await assert.rejects(editor.loadImage(pngHeaderDataUrl(30_000, 1_000)), /dimension|budget/i);
    assert.equal(decodeCalls, 0);
    assert.equal(editor.getImageInfo(), null);
    await editor.disposeAsync();
});

test('a decoded image rejected by the dimension budget is disposed without document mutation', async () => {
    const ids = resetEditorDom();
    const safeSource = makeImageDataUrl({ width: 64, height: 48 });
    const oversizedSource = 'data:image/png;base64,AA==';
    const oversizedImage = await fabric.FabricImage.fromURL(safeSource);
    oversizedImage.width = 30_000;
    oversizedImage.height = 1_000;
    let oversizedDisposed = false;
    const originalDispose = oversizedImage.dispose.bind(oversizedImage);
    oversizedImage.dispose = () => {
        oversizedDisposed = true;
        return originalDispose();
    };
    class ControlledFabricImage extends fabric.FabricImage {
        static fromURL(source, options) {
            return source === oversizedSource
                ? Promise.resolve(oversizedImage)
                : fabric.FabricImage.fromURL(source, options);
        }
    }
    const editor = new ImageEditorCore(
        { ...fabric, FabricImage: ControlledFabricImage },
        {
            canvasWidth: 320,
            canvasHeight: 240,
            maxInputPixels: 64 * 1024 * 1024,
            maxExportDimension: 16_384,
        },
    );
    await editor.init({ canvas: ids.canvas });
    await editor.loadImage(safeSource);
    const before = editor.saveState();

    await assert.rejects(editor.loadImage(oversizedSource), /dimension|budget/i);
    assert.equal(oversizedDisposed, true);
    assert.equal(editor.saveState(), before);
    await editor.disposeAsync();
});
