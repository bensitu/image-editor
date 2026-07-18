import { createRedactionPreset } from '@bensitu/image-editor/presets/redaction';
import { fabric } from 'fabric';

globalThis.__IMAGE_EDITOR_BUNDLE_FIXTURE__ = createRedactionPreset(fabric);
