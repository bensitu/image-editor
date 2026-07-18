import { ImageEditor } from '@bensitu/image-editor';

const editor = new ImageEditor(fabric);
editor.init({ canvas: 'canvas' });
const undo = editor.undo;
await undo();
