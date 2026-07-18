import type { CoreEventMap } from '../core/index.js';
import type { ImageEditorCore } from '../core/index.js';
import type { DomControlsPluginApi, DomPluginBinding } from '../plugins/dom-controls/index.js';
import type { PluginRef, SynchronousEditorPlugin } from '../sdk/index.js';

export type PresetDomControlsFactory<TBindings> = (
    bindings: TBindings,
) => SynchronousEditorPlugin<DomControlsPluginApi, CoreEventMap>;

export type PresetDomApi<TOptions> = TOptions extends { readonly domControls: unknown }
    ? DomControlsPluginApi
    : 'domControls' extends keyof TOptions
      ? DomControlsPluginApi | null
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
