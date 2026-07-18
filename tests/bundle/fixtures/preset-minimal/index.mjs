import { createMinimalPreset } from '@bensitu/image-editor/presets/minimal';
import { fabric } from 'fabric';

globalThis.__IMAGE_EDITOR_BUNDLE_FIXTURE__ = createMinimalPreset(fabric);
