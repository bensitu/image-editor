/**
 * Composes the Minimal preset and publishes its options, optional History, and installed APIs.
 *
 * @module
 */
import { ImageEditorCore, type FabricModule, type ImageEditorCoreOptions } from '../../core/index.js';
import { type HistoryPluginOptions, type HistoryPort } from '../../plugins/history/index.js';
import type { DomControlsPluginApi, DomPluginBinding } from '../../plugins/dom-controls/index.js';
import { type TransformPluginApi, type TransformPluginOptions } from '../../plugins/transform/index.js';
import { type PresetDomApi, type PresetDomControlsFactory } from '../preset-support.js';
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
} ? null : TOptions extends {
    readonly history: HistoryPluginOptions;
} ? HistoryPort : 'history' extends keyof TOptions ? HistoryPort | null : null;
export interface MinimalPresetResult<THistory extends HistoryPort | null = HistoryPort | null, TDomControls extends DomControlsPluginApi | null = DomControlsPluginApi | null> {
    readonly editor: ImageEditorCore;
    readonly transform: TransformPluginApi;
    readonly history: THistory;
    readonly domControls: TDomControls;
}
export declare function createMinimalPreset<const TOptions extends MinimalPresetOptions = Record<never, never>>(fabric: FabricModule, options?: TOptions & MinimalPresetOptions): MinimalPresetResult<MinimalPresetHistoryApi<TOptions>, PresetDomApi<TOptions>>;
export default createMinimalPreset;
