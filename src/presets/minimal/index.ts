import {
    ImageEditorCore,
    type FabricModule,
    type ImageEditorCoreOptions,
} from '../../core/index.js';
import {
    historyPlugin,
    historyPluginRef,
    type HistoryPluginOptions,
    type HistoryPort,
} from '../../plugins/history/index.js';
import type { DomControlsPluginApi, DomPluginBinding } from '../../plugins/dom-controls/index.js';
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

export interface MinimalPresetDomBindings {
    readonly transform: DomPluginBinding<TransformPluginApi>;
    readonly history: DomPluginBinding<HistoryPort> | null;
}

export interface MinimalPresetOptions {
    readonly core?: ImageEditorCoreOptions;
    readonly transform?: TransformPluginOptions;
    readonly history?: false | HistoryPluginOptions;
    readonly domControls?: PresetDomControlsFactory<MinimalPresetDomBindings>;
}

export type MinimalPresetHistoryApi<TOptions> = TOptions extends {
    readonly history: false | undefined;
}
    ? null
    : TOptions extends { readonly history: HistoryPluginOptions }
      ? HistoryPort
      : 'history' extends keyof TOptions
        ? HistoryPort | null
        : null;

export interface MinimalPresetResult<
    THistory extends HistoryPort | null = HistoryPort | null,
    TDomControls extends DomControlsPluginApi | null = DomControlsPluginApi | null,
> {
    readonly editor: ImageEditorCore;
    readonly transform: TransformPluginApi;
    readonly history: THistory;
    readonly domControls: TDomControls;
}

export function createMinimalPreset<
    const TOptions extends MinimalPresetOptions = Record<never, never>,
>(
    fabric: FabricModule,
    options: TOptions & MinimalPresetOptions = {} as TOptions & MinimalPresetOptions,
): MinimalPresetResult<MinimalPresetHistoryApi<TOptions>, PresetDomApi<TOptions>> {
    const editor = new ImageEditorCore(fabric, options.core);
    const transformDefinition = transformPlugin(options.transform);
    const historyDefinition =
        options.history === false || options.history === undefined
            ? null
            : historyPlugin(options.history);
    const bindings: MinimalPresetDomBindings = Object.freeze({
        transform: createDomBinding(editor, transformPluginRef),
        history: historyDefinition ? createDomBinding(editor, historyPluginRef) : null,
    });
    const domDefinition = createDomPlugin(options.domControls, bindings);

    if (historyDefinition && domDefinition) {
        const apis = editor.install(
            composePlugins({
                transform: transformDefinition,
                history: historyDefinition,
                domControls: domDefinition,
            }),
        );
        return Object.freeze({ editor, ...apis }) as MinimalPresetResult<
            MinimalPresetHistoryApi<TOptions>,
            PresetDomApi<TOptions>
        >;
    }
    if (historyDefinition) {
        const apis = editor.install(
            composePlugins({ transform: transformDefinition, history: historyDefinition }),
        );
        return Object.freeze({ editor, ...apis, domControls: null }) as MinimalPresetResult<
            MinimalPresetHistoryApi<TOptions>,
            PresetDomApi<TOptions>
        >;
    }
    if (domDefinition) {
        const apis = editor.install(
            composePlugins({ transform: transformDefinition, domControls: domDefinition }),
        );
        return Object.freeze({ editor, ...apis, history: null }) as MinimalPresetResult<
            MinimalPresetHistoryApi<TOptions>,
            PresetDomApi<TOptions>
        >;
    }
    const apis = editor.install(composePlugins({ transform: transformDefinition }));
    return Object.freeze({
        editor,
        ...apis,
        history: null,
        domControls: null,
    }) as MinimalPresetResult<MinimalPresetHistoryApi<TOptions>, PresetDomApi<TOptions>>;
}

export default createMinimalPreset;
