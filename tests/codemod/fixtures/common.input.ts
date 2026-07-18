import * as fabric from 'fabric';
import { ImageEditor, type FabricModule } from '@bensitu/image-editor';

const editor = new ImageEditor(fabric, {
    canvasWidth: 800,
    animationDuration: 0,
    maxHistorySize: 10,
    defaultMaskWidth: 40,
});
editor.init({ canvas: 'canvas', canvasContainer: 'container' });
await editor.loadImage(source);
await editor.scaleImage(1.2);
editor.createMask();
await editor.undo();
const state = editor.saveState();
await editor.loadFromState(snapshot);
const png = await editor.exportImageBase64({ format: 'png' });
await editor.disposeAsync();

void state;
void png;
declare const source: string;
declare const snapshot: unknown;
declare const fabricModule: FabricModule;
void fabricModule;
