import { ImageEditorCore } from '@bensitu/image-editor/core';
import { overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';
import { overlayStatePlugin } from '@bensitu/image-editor/plugins/overlay-state';
import { fabric } from 'fabric';

const editor = new ImageEditorCore(fabric);
const overlay = editor.use(overlayFoundationPlugin());
const state = editor.use(overlayStatePlugin());

globalThis.__IMAGE_EDITOR_BUNDLE_FIXTURE__ = { editor, overlay, state };
