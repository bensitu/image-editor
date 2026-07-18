import ImageEditor from '@bensitu/image-editor';
import * as fabric from 'fabric';

const source = 'data:image/png;base64,fixture';
const editor = new ImageEditor(fabric, {
    canvasWidth: 640,
    canvasHeight: 480,
});
editor.init({ canvas: 'canvas' });
await editor.loadImage(source);
const png = await editor.exportImageBase64({ format: 'png' });
await editor.disposeAsync();
void png;
