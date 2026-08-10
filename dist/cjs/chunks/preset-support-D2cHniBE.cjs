//#region dist/esm/presets/preset-support.js
function createDomBinding(editor, ref) {
	return Object.freeze({
		ref,
		resolve: () => editor.requirePlugin(ref)
	});
}
function createCanvasBinding(editor, ref) {
	return Object.freeze({
		ref,
		resolve: () => editor.requirePlugin(ref)
	});
}
function createDomPlugin(factory, bindings) {
	if (!factory) return null;
	const plugin = factory(bindings);
	if (!plugin || plugin.ref.id !== "plugin:dom-controls" || plugin.ref.apiVersion !== "1.0.0") throw new TypeError("domControls must create the public DOM Controls Plugin with API version 1.0.0.");
	return plugin;
}
function createCanvasPlugin(factory, bindings) {
	if (!factory) return null;
	const plugin = factory(bindings);
	if (!plugin || plugin.ref.id !== "plugin:canvas-interactions" || plugin.ref.apiVersion !== "1.0.0") throw new TypeError("canvasInteractions must create the public Canvas Interactions Plugin with API version 1.0.0.");
	return plugin;
}

//#endregion
Object.defineProperty(exports, 'createCanvasBinding', {
  enumerable: true,
  get: function () {
    return createCanvasBinding;
  }
});
Object.defineProperty(exports, 'createCanvasPlugin', {
  enumerable: true,
  get: function () {
    return createCanvasPlugin;
  }
});
Object.defineProperty(exports, 'createDomBinding', {
  enumerable: true,
  get: function () {
    return createDomBinding;
  }
});
Object.defineProperty(exports, 'createDomPlugin', {
  enumerable: true,
  get: function () {
    return createDomPlugin;
  }
});
//# sourceMappingURL=preset-support-D2cHniBE.cjs.map