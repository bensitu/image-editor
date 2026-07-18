import { domControlsPlugin } from '@bensitu/image-editor/plugins/dom-controls';
import { createFullPreset } from '@bensitu/image-editor/presets/full';
import { fabric } from 'fabric';

globalThis.__IMAGE_EDITOR_BUNDLE_FIXTURE__ = createFullPreset(fabric, {
    domControls: () => domControlsPlugin(),
});
