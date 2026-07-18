import { ImageEditor } from '@bensitu/image-editor';
import * as fabric from 'fabric';

const editor = new ImageEditor(fabric);
editor.init({ canvas: 'canvas' });
await editor.rotateImage(90);

export const view = <button onClick={() => void editor.undo()}>Undo</button>;
