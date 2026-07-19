/**
 * Composes the Annotation preset and publishes its options, DOM bindings, and installed APIs.
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
import type { DomControlsPluginApi, DomPluginBinding } from '../../plugins/dom-controls/index.js';
import {
    historyPlugin,
    historyPluginRef,
    type HistoryPluginOptions,
    type HistoryPort,
} from '../../plugins/history/index.js';
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
    createDomPlugin,
    type PresetDomApi,
    type PresetDomControlsFactory,
} from '../preset-support.js';

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

export interface AnnotationPresetResult<
    TDomControls extends DomControlsPluginApi | null = DomControlsPluginApi | null,
> {
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

export function createAnnotationPreset<
    const TOptions extends AnnotationPresetOptions = Record<never, never>,
>(
    fabric: FabricModule,
    options: TOptions & AnnotationPresetOptions = {} as TOptions & AnnotationPresetOptions,
): AnnotationPresetResult<PresetDomApi<TOptions>> {
    const editor = new ImageEditorCore(fabric, options.core);
    const definitions = {
        transform: transformPlugin(options.transform),
        history: historyPlugin(options.history),
        overlays: overlayFoundationPlugin(),
        annotations: annotationFoundationPlugin(options.annotations),
        text: textAnnotationPlugin(options.text),
        shape: shapeAnnotationPlugin(options.shape),
        draw: drawAnnotationPlugin(options.draw),
        overlayState: overlayStatePlugin(options.overlayState),
    } as const;
    const bindings: AnnotationPresetDomBindings = Object.freeze({
        transform: createDomBinding(editor, transformPluginRef),
        history: createDomBinding(editor, historyPluginRef),
        overlays: createDomBinding(editor, overlayFoundationRef),
        annotations: createDomBinding(editor, annotationFoundationRef),
        text: createDomBinding(editor, textAnnotationPluginRef),
        shape: createDomBinding(editor, shapeAnnotationPluginRef),
        draw: createDomBinding(editor, drawAnnotationPluginRef),
        overlayState: createDomBinding(editor, overlayStatePluginRef),
    });
    const domDefinition = createDomPlugin(options.domControls, bindings);
    if (domDefinition) {
        const apis = editor.install(composePlugins({ ...definitions, domControls: domDefinition }));
        return Object.freeze({ editor, ...apis }) as AnnotationPresetResult<PresetDomApi<TOptions>>;
    }
    const apis = editor.install(composePlugins(definitions));
    return Object.freeze({ editor, ...apis, domControls: null }) as AnnotationPresetResult<
        PresetDomApi<TOptions>
    >;
}

export default createAnnotationPreset;
