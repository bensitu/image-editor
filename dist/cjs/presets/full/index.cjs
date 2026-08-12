Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: 'Module' } });
const require_core_capabilities = require('../../chunks/core-capabilities-DPdoMgAf.cjs');
const require_core = require('../../chunks/core-IzQmeOnC.cjs');
const require_overlay = require('../../chunks/overlay-CK9dFJPW.cjs');
const require_annotation = require('../../chunks/annotation-Drb-vPam.cjs');
const require_transform = require('../../chunks/transform-BRbeAqOU.cjs');
const require_mask = require('../../chunks/mask-FpsCJfd6.cjs');
const require_history = require('../../chunks/history-D5eaCnO6.cjs');
const require_filters = require('../../chunks/filters-C992jBn0.cjs');
const require_crop = require('../../chunks/crop-Punea8fd.cjs');
const require_mosaic = require('../../chunks/mosaic-uXCA19xz.cjs');
const require_annotation_text = require('../../chunks/annotation-text-DqfI56w7.cjs');
const require_annotation_shape = require('../../chunks/annotation-shape-DYgbtEgC.cjs');
const require_annotation_draw = require('../../chunks/annotation-draw-Dy_yP4KD.cjs');
const require_overlay_state = require('../../chunks/overlay-state-Jb8nfUe3.cjs');
const require_preset_support = require('../../chunks/preset-support-D2cHniBE.cjs');

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
	const domBindings = Object.freeze({
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
	const canvasBindings = Object.freeze({
		overlays: require_preset_support.createCanvasBinding(editor, require_overlay.overlayFoundationRef),
		mosaic: require_preset_support.createCanvasBinding(editor, require_mosaic.mosaicPluginRef),
		annotations: require_preset_support.createCanvasBinding(editor, require_annotation.annotationFoundationRef),
		text: require_preset_support.createCanvasBinding(editor, require_annotation_text.textAnnotationPluginRef),
		shape: require_preset_support.createCanvasBinding(editor, require_annotation_shape.shapeAnnotationPluginRef),
		draw: require_preset_support.createCanvasBinding(editor, require_annotation_draw.drawAnnotationPluginRef)
	});
	const domDefinition = require_preset_support.createDomPlugin(options.domControls, domBindings);
	const canvasDefinition = require_preset_support.createCanvasPlugin(options.canvasInteractions, canvasBindings);
	if (domDefinition && canvasDefinition) {
		const apis = editor.install(require_core_capabilities.composePlugins({
			...definitions,
			canvasInteractions: canvasDefinition,
			domControls: domDefinition
		}));
		return Object.freeze({
			editor,
			...apis
		});
	}
	if (canvasDefinition) {
		const apis = editor.install(require_core_capabilities.composePlugins({
			...definitions,
			canvasInteractions: canvasDefinition
		}));
		return Object.freeze({
			editor,
			...apis,
			domControls: null
		});
	}
	if (domDefinition) {
		const apis = editor.install(require_core_capabilities.composePlugins({
			...definitions,
			domControls: domDefinition
		}));
		return Object.freeze({
			editor,
			...apis,
			canvasInteractions: null
		});
	}
	const apis = editor.install(require_core_capabilities.composePlugins(definitions));
	return Object.freeze({
		editor,
		...apis,
		domControls: null,
		canvasInteractions: null
	});
}

//#endregion
exports.createFullPreset = createFullPreset;
exports.default = createFullPreset;
//# sourceMappingURL=index.cjs.map