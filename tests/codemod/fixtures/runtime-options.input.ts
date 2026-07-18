import { ImageEditor } from '@bensitu/image-editor';

const options = makeOptions();
const editor = new ImageEditor(fabric, options);
editor.init({ canvas: 'canvas' });
