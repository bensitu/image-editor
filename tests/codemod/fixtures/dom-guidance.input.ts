import { ImageEditor } from '@bensitu/image-editor';

const editor = new ImageEditor(fabric);
editor.init({ canvas: 'canvas', uploadInput: 'upload', scaleSlider: 'scale' });
