import { expectTypeOf } from 'expect-type';

import type { AnnotationPluginApi } from '../../../src/foundations/annotation/index.js';
import type { OverlayFoundationApi } from '../../../src/foundations/overlay/index.js';
import type { DrawAnnotationPluginApi } from '../../../src/plugins/annotation-draw/index.js';
import type { ShapeAnnotationPluginApi } from '../../../src/plugins/annotation-shape/index.js';
import type { TextAnnotationPluginApi } from '../../../src/plugins/annotation-text/index.js';
import type { CropPluginApi } from '../../../src/plugins/crop/index.js';
import {
    domControlsPlugin,
    type DomControlsPluginApi,
    type DomPluginBinding,
} from '../../../src/plugins/dom-controls/index.js';
import type { FiltersPluginApi } from '../../../src/plugins/filters/index.js';
import type { HistoryPort } from '../../../src/plugins/history/index.js';
import type { MaskPluginApi } from '../../../src/plugins/mask/index.js';
import type { MosaicPluginApi } from '../../../src/plugins/mosaic/index.js';
import type { OverlayStatePluginApi } from '../../../src/plugins/overlay-state/index.js';
import type { TransformPluginApi } from '../../../src/plugins/transform/index.js';
import { createAnnotationPreset } from '../../../src/presets/annotation/index.js';
import { createFullPreset } from '../../../src/presets/full/index.js';
import { createMinimalPreset } from '../../../src/presets/minimal/index.js';
import { createRedactionPreset } from '../../../src/presets/redaction/index.js';
import type { FabricModule } from '../../../src/core/index.js';

declare const fabric: FabricModule;

const minimal = createMinimalPreset(fabric);
expectTypeOf(minimal.transform).toEqualTypeOf<TransformPluginApi>();
expectTypeOf(minimal.history).toEqualTypeOf<null>();
expectTypeOf(minimal.domControls).toEqualTypeOf<null>();

const minimalHistory = createMinimalPreset(fabric, { history: {} });
expectTypeOf(minimalHistory.history).toEqualTypeOf<HistoryPort>();

const minimalDisabledHistory = createMinimalPreset(fabric, { history: false });
expectTypeOf(minimalDisabledHistory.history).toEqualTypeOf<null>();

const redaction = createRedactionPreset(fabric);
expectTypeOf(redaction.overlays).toEqualTypeOf<OverlayFoundationApi>();
expectTypeOf(redaction.masks).toEqualTypeOf<MaskPluginApi>();
expectTypeOf(redaction.filters).toEqualTypeOf<FiltersPluginApi>();
expectTypeOf(redaction.crop).toEqualTypeOf<CropPluginApi>();
expectTypeOf(redaction.mosaic).toEqualTypeOf<MosaicPluginApi>();
expectTypeOf(redaction.overlayState).toEqualTypeOf<OverlayStatePluginApi>();
expectTypeOf(redaction.domControls).toEqualTypeOf<null>();

const annotation = createAnnotationPreset(fabric);
expectTypeOf(annotation.annotations).toEqualTypeOf<AnnotationPluginApi>();
expectTypeOf(annotation.text).toEqualTypeOf<TextAnnotationPluginApi>();
expectTypeOf(annotation.shape).toEqualTypeOf<ShapeAnnotationPluginApi>();
expectTypeOf(annotation.draw).toEqualTypeOf<DrawAnnotationPluginApi>();

const full = createFullPreset(fabric, {
    domControls: (bindings) => {
        expectTypeOf(bindings.transform).toEqualTypeOf<DomPluginBinding<TransformPluginApi>>();
        expectTypeOf(bindings.history).toEqualTypeOf<DomPluginBinding<HistoryPort>>();
        return domControlsPlugin();
    },
});
expectTypeOf(full.domControls).toEqualTypeOf<DomControlsPluginApi>();
expectTypeOf(full.annotations).toEqualTypeOf<AnnotationPluginApi>();
expectTypeOf(full.overlayState).toEqualTypeOf<OverlayStatePluginApi>();
