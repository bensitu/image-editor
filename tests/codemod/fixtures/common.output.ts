import { createFullPreset } from '@bensitu/image-editor/presets/full';
import { loadV2Snapshot } from '@bensitu/image-editor/migrate-v2';
import * as fabric from 'fabric';
import { type FabricModule } from '@bensitu/image-editor';

const editor = createFullPreset(fabric, { core: { canvasWidth: 800 }, transform: { animationDuration: 0 }, history: { maxSize: 10 }, masks: { defaultWidth: 40 } });
editor.editor.init({ canvas: 'canvas', canvasContainer: 'container' });
await editor.editor.loadImage(source);
await editor.transform.scale(1.2);
editor.masks.create();
await editor.history.undo();
const state = editor.editor.saveState();
await loadV2Snapshot(editor.editor, snapshot);
const png = await editor.editor.exportImageBase64({ format: 'png' });
await editor.editor.disposeAsync();

void state;
void png;
declare const source: string;
declare const snapshot: unknown;
declare const fabricModule: FabricModule;
void fabricModule;
