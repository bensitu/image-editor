/**
 * Creates optional DOM binding Plugins and maps their installed APIs for preset factories.
 *
 * @module
 */

import type { CoreEventMap } from '../core/index.js';
import type { ImageEditorCore } from '../core/index.js';
import type { DomControlsPluginApi, DomPluginBinding } from '../plugins/dom-controls/index.js';
import type {
    CanvasInteractionsPluginApi,
    CanvasPluginBinding,
} from '../plugins/canvas-interactions/index.js';
import type { PluginRef, SynchronousEditorPlugin } from '../sdk/index.js';

export type PresetDomControlsFactory<TBindings> = (
    bindings: TBindings,
) => SynchronousEditorPlugin<DomControlsPluginApi, CoreEventMap>;

export type PresetDomApi<TOptions> = TOptions extends { readonly domControls: unknown }
    ? DomControlsPluginApi
    : 'domControls' extends keyof TOptions
      ? DomControlsPluginApi | null
      : null;

export type PresetCanvasInteractionsFactory<TBindings> = (
    bindings: TBindings,
) => SynchronousEditorPlugin<CanvasInteractionsPluginApi, CoreEventMap>;

export type PresetCanvasInteractionsApi<TOptions> = TOptions extends {
    readonly canvasInteractions: unknown;
}
    ? CanvasInteractionsPluginApi
    : 'canvasInteractions' extends keyof TOptions
      ? CanvasInteractionsPluginApi | null
      : null;

export function createDomBinding<TApi>(
    editor: ImageEditorCore,
    ref: PluginRef<TApi>,
): DomPluginBinding<TApi> {
    return Object.freeze({
        ref,
        resolve: () => editor.requirePlugin(ref),
    });
}

export function createCanvasBinding<TApi>(
    editor: ImageEditorCore,
    ref: PluginRef<TApi>,
): CanvasPluginBinding<TApi> {
    return Object.freeze({
        ref,
        resolve: () => editor.requirePlugin(ref),
    });
}

export function createDomPlugin<TBindings>(
    factory: PresetDomControlsFactory<TBindings> | undefined,
    bindings: TBindings,
): SynchronousEditorPlugin<DomControlsPluginApi, CoreEventMap> | null {
    if (!factory) return null;
    const plugin = factory(bindings);
    if (!plugin || plugin.ref.id !== 'plugin:dom-controls' || plugin.ref.apiVersion !== '1.0.0') {
        throw new TypeError(
            'domControls must create the public DOM Controls Plugin with API version 1.0.0.',
        );
    }
    return plugin;
}

export function createCanvasPlugin<TBindings>(
    factory: PresetCanvasInteractionsFactory<TBindings> | undefined,
    bindings: TBindings,
): SynchronousEditorPlugin<CanvasInteractionsPluginApi, CoreEventMap> | null {
    if (!factory) return null;
    const plugin = factory(bindings);
    if (
        !plugin ||
        plugin.ref.id !== 'plugin:canvas-interactions' ||
        plugin.ref.apiVersion !== '1.0.0'
    ) {
        throw new TypeError(
            'canvasInteractions must create the public Canvas Interactions Plugin with API version 1.0.0.',
        );
    }
    return plugin;
}
