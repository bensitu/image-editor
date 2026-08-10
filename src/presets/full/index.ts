/**
 * Composes the Full preset and publishes its options, DOM bindings, and installed APIs.
 *
 * @module
 */

import {
    ImageEditorCore,
    type FabricModule,
    type ImageEditorCoreOptions,
} from '../../core/index.js';
import {
    annotationFoundationPlugin,
    annotationFoundationRef,
    type AnnotationFoundationOptions,
    type AnnotationPluginApi,
} from '../../foundations/annotation/index.js';
import {
    overlayFoundationPlugin,
    overlayFoundationRef,
    type OverlayFoundationApi,
} from '../../foundations/overlay/index.js';
import {
    drawAnnotationPlugin,
    drawAnnotationPluginRef,
    type DrawAnnotationPluginApi,
    type DrawAnnotationPluginOptions,
} from '../../plugins/annotation-draw/index.js';
import {
    shapeAnnotationPlugin,
    shapeAnnotationPluginRef,
    type ShapeAnnotationPluginApi,
    type ShapeAnnotationPluginOptions,
} from '../../plugins/annotation-shape/index.js';
import {
    textAnnotationPlugin,
    textAnnotationPluginRef,
    type TextAnnotationPluginApi,
    type TextAnnotationPluginOptions,
} from '../../plugins/annotation-text/index.js';
import {
    cropPlugin,
    cropPluginRef,
    type CropPluginApi,
    type CropPluginOptions,
} from '../../plugins/crop/index.js';
import type { DomControlsPluginApi, DomPluginBinding } from '../../plugins/dom-controls/index.js';
import type {
    CanvasInteractionsPluginApi,
    CanvasPluginBinding,
} from '../../plugins/canvas-interactions/index.js';
import {
    filtersPlugin,
    filtersPluginRef,
    type FiltersPluginApi,
    type FiltersPluginOptions,
} from '../../plugins/filters/index.js';
import {
    historyPlugin,
    historyPluginRef,
    type HistoryPluginOptions,
    type HistoryPort,
} from '../../plugins/history/index.js';
import {
    maskPlugin,
    maskPluginRef,
    type MaskPluginApi,
    type MaskPluginOptions,
} from '../../plugins/mask/index.js';
import {
    mosaicPlugin,
    mosaicPluginRef,
    type MosaicPluginApi,
    type MosaicPluginOptions,
} from '../../plugins/mosaic/index.js';
import {
    overlayStatePlugin,
    overlayStatePluginRef,
    type OverlayStatePluginApi,
    type OverlayStatePluginOptions,
} from '../../plugins/overlay-state/index.js';
import {
    transformPlugin,
    transformPluginRef,
    type TransformPluginApi,
    type TransformPluginOptions,
} from '../../plugins/transform/index.js';
import { composePlugins } from '../../sdk/index.js';
import {
    createDomBinding,
    createCanvasBinding,
    createCanvasPlugin,
    createDomPlugin,
    type PresetCanvasInteractionsApi,
    type PresetCanvasInteractionsFactory,
    type PresetDomApi,
    type PresetDomControlsFactory,
} from '../preset-support.js';

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

export interface FullPresetCanvasBindings {
    readonly overlays: CanvasPluginBinding<OverlayFoundationApi>;
    readonly mosaic: CanvasPluginBinding<MosaicPluginApi>;
    readonly annotations: CanvasPluginBinding<AnnotationPluginApi>;
    readonly text: CanvasPluginBinding<TextAnnotationPluginApi>;
    readonly shape: CanvasPluginBinding<ShapeAnnotationPluginApi>;
    readonly draw: CanvasPluginBinding<DrawAnnotationPluginApi>;
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
    readonly canvasInteractions?: PresetCanvasInteractionsFactory<FullPresetCanvasBindings>;
}

export interface FullPresetResult<
    TDomControls extends DomControlsPluginApi | null = DomControlsPluginApi | null,
    TCanvasInteractions extends CanvasInteractionsPluginApi | null =
        CanvasInteractionsPluginApi | null,
> {
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
    readonly canvasInteractions: TCanvasInteractions;
}

export function createFullPreset<const TOptions extends FullPresetOptions = Record<never, never>>(
    fabric: FabricModule,
    options: TOptions & FullPresetOptions = {} as TOptions & FullPresetOptions,
): FullPresetResult<PresetDomApi<TOptions>, PresetCanvasInteractionsApi<TOptions>> {
    const editor = new ImageEditorCore(fabric, options.core);
    const definitions = {
        transform: transformPlugin(options.transform),
        history: historyPlugin(options.history),
        overlays: overlayFoundationPlugin(),
        masks: maskPlugin(options.masks),
        filters: filtersPlugin(options.filters),
        crop: cropPlugin(options.crop),
        mosaic: mosaicPlugin(options.mosaic),
        annotations: annotationFoundationPlugin(options.annotations),
        text: textAnnotationPlugin(options.text),
        shape: shapeAnnotationPlugin(options.shape),
        draw: drawAnnotationPlugin(options.draw),
        overlayState: overlayStatePlugin(options.overlayState),
    } as const;
    const domBindings: FullPresetDomBindings = Object.freeze({
        transform: createDomBinding(editor, transformPluginRef),
        history: createDomBinding(editor, historyPluginRef),
        overlays: createDomBinding(editor, overlayFoundationRef),
        masks: createDomBinding(editor, maskPluginRef),
        filters: createDomBinding(editor, filtersPluginRef),
        crop: createDomBinding(editor, cropPluginRef),
        mosaic: createDomBinding(editor, mosaicPluginRef),
        annotations: createDomBinding(editor, annotationFoundationRef),
        text: createDomBinding(editor, textAnnotationPluginRef),
        shape: createDomBinding(editor, shapeAnnotationPluginRef),
        draw: createDomBinding(editor, drawAnnotationPluginRef),
        overlayState: createDomBinding(editor, overlayStatePluginRef),
    });
    const canvasBindings: FullPresetCanvasBindings = Object.freeze({
        overlays: createCanvasBinding(editor, overlayFoundationRef),
        mosaic: createCanvasBinding(editor, mosaicPluginRef),
        annotations: createCanvasBinding(editor, annotationFoundationRef),
        text: createCanvasBinding(editor, textAnnotationPluginRef),
        shape: createCanvasBinding(editor, shapeAnnotationPluginRef),
        draw: createCanvasBinding(editor, drawAnnotationPluginRef),
    });
    const domDefinition = createDomPlugin(options.domControls, domBindings);
    const canvasDefinition = createCanvasPlugin(options.canvasInteractions, canvasBindings);
    if (domDefinition && canvasDefinition) {
        const apis = editor.install(
            composePlugins({
                ...definitions,
                canvasInteractions: canvasDefinition,
                domControls: domDefinition,
            }),
        );
        return Object.freeze({ editor, ...apis }) as FullPresetResult<
            PresetDomApi<TOptions>,
            PresetCanvasInteractionsApi<TOptions>
        >;
    }
    if (canvasDefinition) {
        const apis = editor.install(
            composePlugins({ ...definitions, canvasInteractions: canvasDefinition }),
        );
        return Object.freeze({ editor, ...apis, domControls: null }) as FullPresetResult<
            PresetDomApi<TOptions>,
            PresetCanvasInteractionsApi<TOptions>
        >;
    }
    if (domDefinition) {
        const apis = editor.install(composePlugins({ ...definitions, domControls: domDefinition }));
        return Object.freeze({ editor, ...apis, canvasInteractions: null }) as FullPresetResult<
            PresetDomApi<TOptions>,
            PresetCanvasInteractionsApi<TOptions>
        >;
    }
    const apis = editor.install(composePlugins(definitions));
    return Object.freeze({
        editor,
        ...apis,
        domControls: null,
        canvasInteractions: null,
    }) as FullPresetResult<PresetDomApi<TOptions>, PresetCanvasInteractionsApi<TOptions>>;
}

export default createFullPreset;
