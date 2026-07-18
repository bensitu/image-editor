import { ImageEditor } from '@bensitu/image-editor';

const editor = new ImageEditor(fabric);
editor.init({ canvas: 'canvas' });
await editor.downloadImage();
