import { ImageEditorCore, type FabricModule, type ImageEditorCoreOptions } from '../../core/index.js';
import { type AnnotationFoundationOptions, type AnnotationPluginApi } from '../../foundations/annotation/index.js';
import { type OverlayFoundationApi } from '../../foundations/overlay/index.js';
import { type DrawAnnotationPluginApi, type DrawAnnotationPluginOptions } from '../../plugins/annotation-draw/index.js';
import { type ShapeAnnotationPluginApi, type ShapeAnnotationPluginOptions } from '../../plugins/annotation-shape/index.js';
import { type TextAnnotationPluginApi, type TextAnnotationPluginOptions } from '../../plugins/annotation-text/index.js';
import type { DomControlsPluginApi, DomPluginBinding } from '../../plugins/dom-controls/index.js';
import { type HistoryPluginOptions, type HistoryPort } from '../../plugins/history/index.js';
import { type OverlayStatePluginApi, type OverlayStatePluginOptions } from '../../plugins/overlay-state/index.js';
import { type TransformPluginApi, type TransformPluginOptions } from '../../plugins/transform/index.js';
import { type PresetDomApi, type PresetDomControlsFactory } from '../preset-support.js';
export interface AnnotationPresetDomBindings {
    readonly transform: DomPluginBinding<TransformPluginApi>;
    readonly history: DomPluginBinding<HistoryPort>;
    readonly overlays: DomPluginBinding<OverlayFoundationApi>;
    readonly annotations: DomPluginBinding<AnnotationPluginApi>;
    readonly text: DomPluginBinding<TextAnnotationPluginApi>;
    readonly shape: DomPluginBinding<ShapeAnnotationPluginApi>;
    readonly draw: DomPluginBinding<DrawAnnotationPluginApi>;
    readonly overlayState: DomPluginBinding<OverlayStatePluginApi>;
}
export interface AnnotationPresetOptions {
    readonly core?: ImageEditorCoreOptions;
    readonly transform?: TransformPluginOptions;
    readonly history?: HistoryPluginOptions;
    readonly annotations?: AnnotationFoundationOptions;
    readonly text?: TextAnnotationPluginOptions;
    readonly shape?: ShapeAnnotationPluginOptions;
    readonly draw?: DrawAnnotationPluginOptions;
    readonly overlayState?: OverlayStatePluginOptions;
    readonly domControls?: PresetDomControlsFactory<AnnotationPresetDomBindings>;
}
export interface AnnotationPresetResult<TDomControls extends DomControlsPluginApi | null = DomControlsPluginApi | null> {
    readonly editor: ImageEditorCore;
    readonly transform: TransformPluginApi;
    readonly history: HistoryPort;
    readonly overlays: OverlayFoundationApi;
    readonly annotations: AnnotationPluginApi;
    readonly text: TextAnnotationPluginApi;
    readonly shape: ShapeAnnotationPluginApi;
    readonly draw: DrawAnnotationPluginApi;
    readonly overlayState: OverlayStatePluginApi;
    readonly domControls: TDomControls;
}
export declare function createAnnotationPreset<const TOptions extends AnnotationPresetOptions = Record<never, never>>(fabric: FabricModule, options?: TOptions & AnnotationPresetOptions): AnnotationPresetResult<PresetDomApi<TOptions>>;
export default createAnnotationPreset;
