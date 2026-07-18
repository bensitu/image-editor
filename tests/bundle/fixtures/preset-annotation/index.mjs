import { createAnnotationPreset } from '@bensitu/image-editor/presets/annotation';
import { fabric } from 'fabric';

globalThis.__IMAGE_EDITOR_BUNDLE_FIXTURE__ = createAnnotationPreset(fabric);
