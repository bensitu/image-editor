import assert from 'node:assert/strict';
import test from 'node:test';

import { ImageEditorCore } from '../../src/core/index.js';
import { readJpegExifOrientation } from '../../src/image/image-preprocessor.js';
import { transformPlugin } from '../../src/plugins/transform/index.js';
import { fabric, makeImageDataUrl, resetEditorDom } from '../helpers/fabric-environment.mjs';

function pngHeaderDataUrl(width: number, height: number): string {
    const bytes = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0);
    Buffer.from('IHDR').copy(bytes, 12);
    bytes.writeUInt32BE(width, 16);
    bytes.writeUInt32BE(height, 20);
    return `data:image/png;base64,${bytes.toString('base64')}`;
}

function withExifOrientation(dataUrl: string, orientation: number): string {
    const source = Buffer.from(dataUrl.split(',', 2)[1]!, 'base64');
    assert.deepEqual([...source.subarray(0, 2)], [0xff, 0xd8]);
    const payload = Buffer.alloc(32);
    Buffer.from('Exif\0\0', 'binary').copy(payload, 0);
    Buffer.from('MM', 'binary').copy(payload, 6);
    payload.writeUInt16BE(42, 8);
    payload.writeUInt32BE(8, 10);
    payload.writeUInt16BE(1, 14);
    payload.writeUInt16BE(0x0112, 16);
    payload.writeUInt16BE(3, 18);
    payload.writeUInt32BE(1, 20);
    payload.writeUInt16BE(orientation, 24);
    payload.writeUInt32BE(0, 28);
    const app1 = Buffer.alloc(payload.length + 4);
    app1[0] = 0xff;
    app1[1] = 0xe1;
    app1.writeUInt16BE(payload.length + 2, 2);
    payload.copy(app1, 4);
    const encoded = Buffer.concat([source.subarray(0, 2), app1, source.subarray(2)]);
    return `data:image/jpeg;base64,${encoded.toString('base64')}`;
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
        static fromURL(source: string, options?: unknown) {
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

test('image preprocessing bounds dimensions and retains or converts the source format by policy', async () => {
    const ids = resetEditorDom();
    const editor = new ImageEditorCore(fabric, {
        canvasWidth: 320,
        canvasHeight: 240,
    });
    await editor.init({ canvas: ids.canvas });
    const source = makeImageDataUrl({ width: 120, height: 80, format: 'image/png' });

    await editor.loadImage(source, {
        preprocessing: { maxWidth: 60, maxHeight: 60 },
    });
    assert.deepEqual(
        {
            width: editor.getImageInfo()?.naturalWidth,
            height: editor.getImageInfo()?.naturalHeight,
            mimeType: editor.getImageInfo()?.mimeType,
        },
        { width: 60, height: 40, mimeType: 'image/png' },
    );

    await editor.loadImage(source, {
        preprocessing: {
            maxWidth: 60,
            maxHeight: 60,
            preserveSourceFormat: false,
            quality: 0.8,
        },
    });
    assert.deepEqual(
        {
            width: editor.getImageInfo()?.naturalWidth,
            height: editor.getImageInfo()?.naturalHeight,
            mimeType: editor.getImageInfo()?.mimeType,
        },
        { width: 60, height: 40, mimeType: 'image/jpeg' },
    );
    await editor.disposeAsync();
});

test('JPEG EXIF orientation is parsed and normalized before Fabric adopts the image', async () => {
    const ids = resetEditorDom();
    const editor = new ImageEditorCore(fabric, {
        canvasWidth: 320,
        canvasHeight: 240,
    });
    await editor.init({ canvas: ids.canvas });
    const source = withExifOrientation(
        makeImageDataUrl({ width: 80, height: 40, format: 'image/jpeg' }),
        6,
    );
    const bytes = Buffer.from(source.split(',', 2)[1]!, 'base64');

    assert.equal(readJpegExifOrientation(bytes), 6);
    await editor.loadImage(source);
    assert.deepEqual(
        {
            width: editor.getImageInfo()?.naturalWidth,
            height: editor.getImageInfo()?.naturalHeight,
            mimeType: editor.getImageInfo()?.mimeType,
        },
        { width: 40, height: 80, mimeType: 'image/jpeg' },
    );
    await editor.disposeAsync();
});
