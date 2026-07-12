/* eslint-disable @typescript-eslint/no-require-imports */

import core = require('@bensitu/image-editor/core');
import historyEntry = require('@bensitu/image-editor/plugins/history');
import maskEntry = require('@bensitu/image-editor/plugins/mask');
import overlayEntry = require('@bensitu/image-editor/plugins/overlay');
import transformEntry = require('@bensitu/image-editor/plugins/transform');

declare const fabric: core.FabricModule;

const editor = new core.ImageEditorCore(fabric);
const overlay: overlayEntry.OverlayFoundationApi = editor.use(
    overlayEntry.overlayFoundationPlugin(),
);
const masks: maskEntry.MaskPluginApi = editor.use(maskEntry.maskPlugin());
const history: historyEntry.HistoryPort = editor.use(historyEntry.historyPlugin());
const transform: transformEntry.TransformPluginApi = editor.use(transformEntry.transformPlugin());

void overlay;
void masks;
void history;
void transform;
