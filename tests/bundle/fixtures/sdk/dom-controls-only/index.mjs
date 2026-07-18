import { ImageEditorCore } from '@bensitu/image-editor/core';
import { domControlsPlugin } from '@bensitu/image-editor/plugins/dom-controls';
import { fabric } from 'fabric';

const editor = new ImageEditorCore(fabric);
const domControls = editor.use(domControlsPlugin());

globalThis.__IMAGE_EDITOR_BUNDLE_FIXTURE__ = { domControls, editor };
