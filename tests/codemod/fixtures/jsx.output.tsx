import { createFullPreset } from '@bensitu/image-editor/presets/full';
import * as fabric from 'fabric';

const editor = createFullPreset(fabric);
editor.editor.init({ canvas: 'canvas' });
await editor.transform.rotate(90);

export const view = <button onClick={() => void editor.history.undo()}>Undo</button>;
