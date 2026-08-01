Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: 'Module' } });
const require_core_capabilities = require('../../chunks/core-capabilities-DPdoMgAf.cjs');
const require_core = require('../../chunks/core-Ctvm1xqe.cjs');
const require_overlay = require('../../chunks/overlay-Cu0ag11p.cjs');
const require_annotation = require('../../chunks/annotation-Cp1Tja0T.cjs');
const require_transform = require('../../chunks/transform-BRbeAqOU.cjs');
const require_mask = require('../../chunks/mask-BSbuN9qL.cjs');
const require_history = require('../../chunks/history-DnbHmRWw.cjs');
const require_filters = require('../../chunks/filters-C992jBn0.cjs');
const require_crop = require('../../chunks/crop-avAH0Ox4.cjs');
const require_mosaic = require('../../chunks/mosaic-w9vfJ7xj.cjs');
const require_annotation_text = require('../../chunks/annotation-text-Du-VcM2b.cjs');
const require_annotation_shape = require('../../chunks/annotation-shape-VFl66rgs.cjs');
const require_annotation_draw = require('../../chunks/annotation-draw-D_WAB6KY.cjs');
const require_overlay_state = require('../../chunks/overlay-state-C3wWTb7N.cjs');
const require_preset_support = require('../../chunks/preset-support-BDSqE4Hg.cjs');

//#region dist/esm/presets/full/index.js
function createFullPreset(fabric, options = {}) {
	const editor = new require_core.ImageEditorCore(fabric, options.core);
	const definitions = {
		transform: require_transform.transformPlugin(options.transform),
		history: require_history.historyPlugin(options.history),
		overlays: require_overlay.overlayFoundationPlugin(),
		masks: require_mask.maskPlugin(options.masks),
		filters: require_filters.filtersPlugin(options.filters),
		crop: require_crop.cropPlugin(options.crop),
		mosaic: require_mosaic.mosaicPlugin(options.mosaic),
		annotations: require_annotation.annotationFoundationPlugin(options.annotations),
		text: require_annotation_text.textAnnotationPlugin(options.text),
		shape: require_annotation_shape.shapeAnnotationPlugin(options.shape),
		draw: require_annotation_draw.drawAnnotationPlugin(options.draw),
		overlayState: require_overlay_state.overlayStatePlugin(options.overlayState)
	};
	const bindings = Object.freeze({
		transform: require_preset_support.createDomBinding(editor, require_transform.transformPluginRef),
		history: require_preset_support.createDomBinding(editor, require_history.historyPluginRef),
		overlays: require_preset_support.createDomBinding(editor, require_overlay.overlayFoundationRef),
		masks: require_preset_support.createDomBinding(editor, require_mask.maskPluginRef),
		filters: require_preset_support.createDomBinding(editor, require_filters.filtersPluginRef),
		crop: require_preset_support.createDomBinding(editor, require_crop.cropPluginRef),
		mosaic: require_preset_support.createDomBinding(editor, require_mosaic.mosaicPluginRef),
		annotations: require_preset_support.createDomBinding(editor, require_annotation.annotationFoundationRef),
		text: require_preset_support.createDomBinding(editor, require_annotation_text.textAnnotationPluginRef),
		shape: require_preset_support.createDomBinding(editor, require_annotation_shape.shapeAnnotationPluginRef),
		draw: require_preset_support.createDomBinding(editor, require_annotation_draw.drawAnnotationPluginRef),
		overlayState: require_preset_support.createDomBinding(editor, require_overlay_state.overlayStatePluginRef)
	});
	const domDefinition = require_preset_support.createDomPlugin(options.domControls, bindings);
	if (domDefinition) {
		const apis = editor.install(require_core_capabilities.composePlugins({
			...definitions,
			domControls: domDefinition
		}));
		return Object.freeze({
			editor,
			...apis
		});
	}
	const apis = editor.install(require_core_capabilities.composePlugins(definitions));
	return Object.freeze({
		editor,
		...apis,
		domControls: null
	});
}

//#endregion
exports.createFullPreset = createFullPreset;
exports.default = createFullPreset;
//# sourceMappingURL=index.cjs.map