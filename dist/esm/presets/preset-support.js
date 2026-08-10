export function createDomBinding(editor, ref) {
    return Object.freeze({
        ref,
        resolve: () => editor.requirePlugin(ref),
    });
}
export function createCanvasBinding(editor, ref) {
    return Object.freeze({
        ref,
        resolve: () => editor.requirePlugin(ref),
    });
}
export function createDomPlugin(factory, bindings) {
    if (!factory)
        return null;
    const plugin = factory(bindings);
    if (!plugin || plugin.ref.id !== 'plugin:dom-controls' || plugin.ref.apiVersion !== '1.0.0') {
        throw new TypeError('domControls must create the public DOM Controls Plugin with API version 1.0.0.');
    }
    return plugin;
}
export function createCanvasPlugin(factory, bindings) {
    if (!factory)
        return null;
    const plugin = factory(bindings);
    if (!plugin ||
        plugin.ref.id !== 'plugin:canvas-interactions' ||
        plugin.ref.apiVersion !== '1.0.0') {
        throw new TypeError('canvasInteractions must create the public Canvas Interactions Plugin with API version 1.0.0.');
    }
    return plugin;
}
//# sourceMappingURL=preset-support.js.map