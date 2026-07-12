import { ImageEditorCore, type FabricModule } from '@bensitu/image-editor/core';
import { historyPlugin, type HistoryPort } from '@bensitu/image-editor/plugins/history';
import { maskPlugin, type MaskPluginApi } from '@bensitu/image-editor/plugins/mask';
import {
    overlayFoundationPlugin,
    type OverlayFoundationApi,
} from '@bensitu/image-editor/plugins/overlay';
import { transformPlugin, type TransformPluginApi } from '@bensitu/image-editor/plugins/transform';

declare const fabric: FabricModule;

const editor = new ImageEditorCore(fabric);
const overlay: OverlayFoundationApi = editor.use(overlayFoundationPlugin());
const masks: MaskPluginApi = editor.use(maskPlugin());
const history: HistoryPort = editor.use(historyPlugin());
const transform: TransformPluginApi = editor.use(transformPlugin());

void overlay;
void masks;
void history;
void transform;
