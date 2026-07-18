import { ImageEditor } from '@bensitu/image-editor';

const editor = new ImageEditor(fabric, { ...baseOptions, canvasWidth: 800 });
editor.init({ canvas: 'canvas' });
