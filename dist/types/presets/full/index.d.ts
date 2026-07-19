/**
 * Composes the Full preset and publishes its options, DOM bindings, and installed APIs.
 *
 * @module
 */
import { ImageEditorCore, type FabricModule, type ImageEditorCoreOptions } from '../../core/index.js';
import { type AnnotationFoundationOptions, type AnnotationPluginApi } from '../../foundations/annotation/index.js';
import { type OverlayFoundationApi } from '../../foundations/overlay/index.js';
import { type DrawAnnotationPluginApi, type DrawAnnotationPluginOptions } from '../../plugins/annotation-draw/index.js';
import { type ShapeAnnotationPluginApi, type ShapeAnnotationPluginOptions } from '../../plugins/annotation-shape/index.js';
import { type TextAnnotationPluginApi, type TextAnnotationPluginOptions } from '../../plugins/annotation-text/index.js';
import { type CropPluginApi, type CropPluginOptions } from '../../plugins/crop/index.js';
import type { DomControlsPluginApi, DomPluginBinding } from '../../plugins/dom-controls/index.js';
import { type FiltersPluginApi, type FiltersPluginOptions } from '../../plugins/filters/index.js';
import { type HistoryPluginOptions, type HistoryPort } from '../../plugins/history/index.js';
import { type MaskPluginApi, type MaskPluginOptions } from '../../plugins/mask/index.js';
import { type MosaicPluginApi, type MosaicPluginOptions } from '../../plugins/mosaic/index.js';
import { type OverlayStatePluginApi, type OverlayStatePluginOptions } from '../../plugins/overlay-state/index.js';
import { type TransformPluginApi, type TransformPluginOptions } from '../../plugins/transform/index.js';
import { type PresetDomApi, type PresetDomControlsFactory } from '../preset-support.js';
export interface FullPresetDomBindings {
    readonly transform: DomPluginBinding<TransformPluginApi>;
    readonly history: DomPluginBinding<HistoryPort>;
    readonly overlays: DomPluginBinding<OverlayFoundationApi>;
    readonly masks: DomPluginBinding<MaskPluginApi>;
    readonly filters: DomPluginBinding<FiltersPluginApi>;
    readonly crop: DomPluginBinding<CropPluginApi>;
    readonly mosaic: DomPluginBinding<MosaicPluginApi>;
    readonly annotations: DomPluginBinding<AnnotationPluginApi>;
    readonly text: DomPluginBinding<TextAnnotationPluginApi>;
    readonly shape: DomPluginBinding<ShapeAnnotationPluginApi>;
    readonly draw: DomPluginBinding<DrawAnnotationPluginApi>;
    readonly overlayState: DomPluginBinding<OverlayStatePluginApi>;
}
export interface FullPresetOptions {
    readonly core?: ImageEditorCoreOptions;
    readonly transform?: TransformPluginOptions;
    readonly history?: HistoryPluginOptions;
    readonly masks?: MaskPluginOptions;
    readonly filters?: FiltersPluginOptions;
    readonly crop?: CropPluginOptions;
    readonly mosaic?: MosaicPluginOptions;
    readonly annotations?: AnnotationFoundationOptions;
    readonly text?: TextAnnotationPluginOptions;
    readonly shape?: ShapeAnnotationPluginOptions;
    readonly draw?: DrawAnnotationPluginOptions;
    readonly overlayState?: OverlayStatePluginOptions;
    readonly domControls?: PresetDomControlsFactory<FullPresetDomBindings>;
}
export interface FullPresetResult<TDomControls extends DomControlsPluginApi | null = DomControlsPluginApi | null> {
    readonly editor: ImageEditorCore;
    readonly transform: TransformPluginApi;
    readonly history: HistoryPort;
    readonly overlays: OverlayFoundationApi;
    readonly masks: MaskPluginApi;
    readonly filters: FiltersPluginApi;
    readonly crop: CropPluginApi;
    readonly mosaic: MosaicPluginApi;
    readonly annotations: AnnotationPluginApi;
    readonly text: TextAnnotationPluginApi;
    readonly shape: ShapeAnnotationPluginApi;
    readonly draw: DrawAnnotationPluginApi;
    readonly overlayState: OverlayStatePluginApi;
    readonly domControls: TDomControls;
}
export declare function createFullPreset<const TOptions extends FullPresetOptions = Record<never, never>>(fabric: FabricModule, options?: TOptions & FullPresetOptions): FullPresetResult<PresetDomApi<TOptions>>;
export default createFullPreset;
