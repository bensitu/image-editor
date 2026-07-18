import { ImageEditor } from '@bensitu/image-editor';

const editor = new ImageEditor(fabric, {
    onImageLoaded: (info) => console.log(info),
});
editor.init({ canvas: 'canvas' });
