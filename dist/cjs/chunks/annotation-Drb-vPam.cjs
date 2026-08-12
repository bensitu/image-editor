const require_core_capabilities = require('./core-capabilities-DPdoMgAf.cjs');
const require_internal_operation_conflict_domains = require('./internal-operation-conflict-domains-Cx-QNq29.cjs');
const require_sdk = require('./sdk-CkdOSZDn.cjs');
const require_overlay = require('./overlay-CK9dFJPW.cjs');
const require_internal_layer_placement = require('./internal-layer-placement-CP6C0Dc2.cjs');
const require_safe_object_key = require('./safe-object-key-SlUB_ab4.cjs');

//#region dist/esm/foundations/annotation/annotation-geometry.js
function isFiniteMatrix(matrix) {
	return matrix.length === 6 && matrix.every((value) => Number.isFinite(value));
}
function hasReflection(matrix) {
	return isFiniteMatrix(matrix) && matrix[0] * matrix[3] - matrix[1] * matrix[2] < 0;
}
function stripReflection(matrix, fabric) {
	if (!hasReflection(matrix)) return matrix;
	const flipX = fabric.multiplyTransformMatrices(matrix, [
		-1,
		0,
		0,
		1,
		0,
		0
	]);
	const flipY = fabric.multiplyTransformMatrices(matrix, [
		1,
		0,
		0,
		-1,
		0,
		0
	]);
	const angleMagnitude = (candidate) => {
		const angle = fabric.qrDecompose(candidate).angle;
		return Number.isFinite(angle) ? Math.abs((angle % 360 + 540) % 360 - 180) : Number.POSITIVE_INFINITY;
	};
	return angleMagnitude(flipY) < angleMagnitude(flipX) ? flipY : flipX;
}
function applyAnnotationGeometry(object, mutation, fabricModule, preserveReadable) {
	var _a;
	if (mutation.kind !== "transform") return;
	const delta = mutation.affineDelta;
	if (!delta || !isFiniteMatrix(delta)) return;
	const fabric = {
		multiplyTransformMatrices: (left, right) => fabricModule.util.multiplyTransformMatrices(left, right),
		qrDecompose: (matrix) => fabricModule.util.qrDecompose(matrix),
		Point: fabricModule.Point
	};
	object.setCoords();
	const originalCenter = object.getCenterPoint();
	const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = delta;
	const targetCenter = new fabric.Point(a * originalCenter.x + c * originalCenter.y + e, b * originalCenter.x + d * originalCenter.y + f);
	const orientationDelta = preserveReadable ? stripReflection(delta, fabric) : delta;
	let restoreCenter = originalCenter;
	try {
		const nextMatrix = fabric.multiplyTransformMatrices(orientationDelta, object.calcTransformMatrix());
		if (!isFiniteMatrix(nextMatrix)) return;
		const decomposed = fabric.qrDecompose(nextMatrix);
		object.set({
			flipX: false,
			flipY: false
		});
		object.set({
			angle: decomposed.angle,
			scaleX: decomposed.scaleX,
			scaleY: decomposed.scaleY,
			skewX: decomposed.skewX,
			skewY: (_a = decomposed.skewY) !== null && _a !== void 0 ? _a : 0
		});
		if (typeof decomposed.flipX === "boolean" || typeof decomposed.flipY === "boolean") object.set({
			...typeof decomposed.flipX === "boolean" ? { flipX: decomposed.flipX } : {},
			...typeof decomposed.flipY === "boolean" ? { flipY: decomposed.flipY } : {}
		});
		restoreCenter = targetCenter;
	} finally {
		object.setPositionByOrigin(restoreCenter, "center", "center");
		object.setCoords();
	}
}

//#endregion
//#region dist/esm/foundations/annotation/annotation-errors.js
var AnnotationError = class extends Error {
	constructor(message) {
		super(`[ImageEditor] ${message}`);
		this.name = "AnnotationError";
	}
};
var AnnotationValidationError = class extends AnnotationError {
	constructor(message) {
		super(message);
		this.name = "AnnotationValidationError";
	}
};
var AnnotationNotFoundError = class extends AnnotationError {
	constructor(message) {
		super(message);
		this.name = "AnnotationNotFoundError";
	}
};

//#endregion
//#region dist/esm/foundations/annotation/annotation-metadata.js
const MAX_ANNOTATION_NAME_LENGTH = 128;
const MAX_ANNOTATION_METADATA_DEPTH = 4;
const MAX_ANNOTATION_METADATA_KEYS = 32;
const MAX_ANNOTATION_METADATA_STRING_BYTES = 8192;
function isPlainRecord$2(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}
function cloneMetadataValue(value, depth, budget) {
	if (value === null || typeof value === "boolean") return value;
	if (typeof value === "number") {
		if (!Number.isFinite(value)) throw new AnnotationValidationError("Annotation metadata numbers must be finite.");
		return value;
	}
	if (typeof value === "string") {
		budget.stringBytes += new TextEncoder().encode(value).byteLength;
		if (budget.stringBytes > 8192) throw new AnnotationValidationError("Annotation metadata string data is too large.");
		return value;
	}
	if (typeof value !== "object" || value === null) throw new AnnotationValidationError("Annotation metadata must be JSON-serializable.");
	if (depth >= 4) throw new AnnotationValidationError("Annotation metadata is nested too deeply.");
	if (budget.ancestors.has(value)) throw new AnnotationValidationError("Annotation metadata cannot contain cycles.");
	budget.ancestors.add(value);
	try {
		if (Array.isArray(value)) {
			if (value.length > 32) throw new AnnotationValidationError("Annotation metadata arrays are too large.");
			return Object.freeze(value.map((entry) => cloneMetadataValue(entry, depth + 1, budget)));
		}
		if (!isPlainRecord$2(value)) throw new AnnotationValidationError("Annotation metadata objects must be plain.");
		const entries = Object.entries(value);
		budget.keyCount += entries.length;
		if (budget.keyCount > 32) throw new AnnotationValidationError("Annotation metadata contains too many keys.");
		const clone = {};
		for (const [key, entry] of entries) {
			if (require_safe_object_key.isUnsafeObjectKey(key) || key.length === 0 || key.length > 128) throw new AnnotationValidationError("Annotation metadata contains an unsafe key.");
			budget.stringBytes += new TextEncoder().encode(key).byteLength;
			clone[key] = cloneMetadataValue(entry, depth + 1, budget);
		}
		return Object.freeze(clone);
	} finally {
		budget.ancestors.delete(value);
	}
}
function normalizeAnnotationName(value, fallback) {
	const candidate = value === void 0 ? fallback : value;
	if (typeof candidate !== "string" || candidate.length === 0 || candidate.trim() !== candidate || candidate.length > 128) throw new AnnotationValidationError(`Annotation name must be a trimmed string of at most ${128} characters.`);
	return candidate;
}
function normalizeAnnotationMetadata(value = {}) {
	if (!isPlainRecord$2(value)) throw new AnnotationValidationError("Annotation metadata must be a plain object.");
	return cloneMetadataValue(value, 0, {
		keyCount: 0,
		stringBytes: 0,
		ancestors: /* @__PURE__ */ new Set()
	});
}
function isValidAnnotationMetadata(value) {
	try {
		normalizeAnnotationMetadata(value);
		return true;
	} catch {
		return false;
	}
}

//#endregion
//#region dist/esm/foundations/annotation/annotation-presentation-manager.js
const DEFAULT_LOCK_INDICATOR = Object.freeze({
	size: 16,
	offset: 3,
	backgroundColor: "#111827",
	iconColor: "#ffffff"
});
function isPlainRecord$1(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}
function finiteRange(value, label, minimum, maximum) {
	if (value === void 0) return void 0;
	if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) throw new AnnotationValidationError(`${label} must be a finite number from ${minimum} through ${maximum}.`);
	return value;
}
function color(value, label) {
	if (value === void 0) return void 0;
	if (typeof value !== "string" || value.length === 0 || value.length > 256) throw new AnnotationValidationError(`${label} must be a non-empty CSS color string.`);
	return value;
}
function nullableColor(value, label) {
	if (value === null) return null;
	return color(value, label);
}
function resolveHoverStyle(value) {
	if (value === void 0 || value === false) return false;
	if (!isPlainRecord$1(value)) throw new AnnotationValidationError("Annotation hoverStyle must be an object or false.");
	const allowed = /* @__PURE__ */ new Set([
		"fill",
		"opacity",
		"stroke",
		"strokeWidth"
	]);
	if (Object.keys(value).some((key) => !allowed.has(key))) throw new AnnotationValidationError("Annotation hoverStyle contains unknown keys.");
	return Object.freeze({
		...value.fill !== void 0 ? { fill: nullableColor(value.fill, "Annotation hover fill") } : {},
		...value.opacity !== void 0 ? { opacity: finiteRange(value.opacity, "Annotation hover opacity", 0, 1) } : {},
		...value.stroke !== void 0 ? { stroke: nullableColor(value.stroke, "Annotation hover stroke") } : {},
		...value.strokeWidth !== void 0 ? { strokeWidth: finiteRange(value.strokeWidth, "Annotation hover strokeWidth", 0, 256) } : {}
	});
}
function resolveControlStyle(value) {
	if (value === void 0) return Object.freeze({});
	if (!isPlainRecord$1(value)) throw new AnnotationValidationError("Annotation controlStyle must be an object.");
	const allowed = /* @__PURE__ */ new Set([
		"borderColor",
		"cornerColor",
		"cornerStrokeColor",
		"cornerSize",
		"touchCornerSize",
		"transparentCorners",
		"padding"
	]);
	if (Object.keys(value).some((key) => !allowed.has(key))) throw new AnnotationValidationError("Annotation controlStyle contains unknown keys.");
	if (value.transparentCorners !== void 0 && typeof value.transparentCorners !== "boolean") throw new AnnotationValidationError("Annotation controlStyle.transparentCorners must be boolean.");
	return Object.freeze({
		...value.borderColor !== void 0 ? { borderColor: color(value.borderColor, "Annotation borderColor") } : {},
		...value.cornerColor !== void 0 ? { cornerColor: color(value.cornerColor, "Annotation cornerColor") } : {},
		...value.cornerStrokeColor !== void 0 ? { cornerStrokeColor: color(value.cornerStrokeColor, "Annotation cornerStrokeColor") } : {},
		...value.cornerSize !== void 0 ? { cornerSize: finiteRange(value.cornerSize, "Annotation cornerSize", 1, 128) } : {},
		...value.touchCornerSize !== void 0 ? { touchCornerSize: finiteRange(value.touchCornerSize, "Annotation touchCornerSize", 1, 256) } : {},
		...value.transparentCorners === void 0 ? {} : { transparentCorners: value.transparentCorners },
		...value.padding !== void 0 ? { padding: finiteRange(value.padding, "Annotation control padding", 0, 128) } : {}
	});
}
function resolveLabel(value) {
	var _a, _b;
	if (value === void 0 || value === false) return false;
	if (!isPlainRecord$1(value)) throw new AnnotationValidationError("Annotation label must be an object or false.");
	const allowed = /* @__PURE__ */ new Set([
		"showOn",
		"offset",
		"getText",
		"textOptions"
	]);
	if (Object.keys(value).some((key) => !allowed.has(key))) throw new AnnotationValidationError("Annotation label contains unknown keys.");
	if (value.showOn !== void 0 && value.showOn !== "selected" && value.showOn !== "always") throw new AnnotationValidationError("Annotation label.showOn must be selected or always.");
	if (value.getText !== void 0 && typeof value.getText !== "function") throw new AnnotationValidationError("Annotation label.getText must be a function.");
	if (value.textOptions !== void 0 && !isPlainRecord$1(value.textOptions)) throw new AnnotationValidationError("Annotation label.textOptions must be an object.");
	return Object.freeze({
		showOn: (_a = value.showOn) !== null && _a !== void 0 ? _a : "selected",
		offset: (_b = finiteRange(value.offset, "Annotation label offset", 0, 256)) !== null && _b !== void 0 ? _b : 3,
		...value.getText ? { getText: value.getText } : {},
		...value.textOptions ? { textOptions: Object.freeze({ ...value.textOptions }) } : {}
	});
}
function resolveLockIndicator(value) {
	var _a, _b, _c, _d;
	if (value === false) return false;
	if (value !== void 0 && !isPlainRecord$1(value)) throw new AnnotationValidationError("Annotation lockIndicator must be an object or false.");
	const config = value !== null && value !== void 0 ? value : {};
	const allowed = /* @__PURE__ */ new Set([
		"size",
		"offset",
		"backgroundColor",
		"iconColor"
	]);
	if (Object.keys(config).some((key) => !allowed.has(key))) throw new AnnotationValidationError("Annotation lockIndicator contains unknown keys.");
	return Object.freeze({
		size: (_a = finiteRange(config.size, "Annotation lock indicator size", 8, 64)) !== null && _a !== void 0 ? _a : DEFAULT_LOCK_INDICATOR.size,
		offset: (_b = finiteRange(config.offset, "Annotation lock indicator offset", 0, 64)) !== null && _b !== void 0 ? _b : DEFAULT_LOCK_INDICATOR.offset,
		backgroundColor: (_c = color(config.backgroundColor, "Annotation lock indicator backgroundColor")) !== null && _c !== void 0 ? _c : DEFAULT_LOCK_INDICATOR.backgroundColor,
		iconColor: (_d = color(config.iconColor, "Annotation lock indicator iconColor")) !== null && _d !== void 0 ? _d : DEFAULT_LOCK_INDICATOR.iconColor
	});
}
function resolveAnnotationPresentationOptions(options) {
	return Object.freeze({
		exportByDefault: options.exportByDefault !== false,
		hoverStyle: resolveHoverStyle(options.hoverStyle),
		controlStyle: resolveControlStyle(options.controlStyle),
		label: resolveLabel(options.label),
		lockIndicator: resolveLockIndicator(options.lockIndicator)
	});
}
var AnnotationPresentationManager = class {
	constructor(host, options, describe, isSelected) {
		Object.defineProperty(this, "host", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: host
		});
		Object.defineProperty(this, "options", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: options
		});
		Object.defineProperty(this, "describe", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: describe
		});
		Object.defineProperty(this, "isSelected", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: isSelected
		});
		Object.defineProperty(this, "labels", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Map()
		});
		Object.defineProperty(this, "lockIndicators", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Map()
		});
		Object.defineProperty(this, "hoverBindings", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Map()
		});
	}
	withBaseStyle(object, task) {
		const binding = this.suspendHover(object);
		try {
			return task();
		} finally {
			this.resumeHover(object, binding);
		}
	}
	async withBaseStyleAsync(object, task) {
		const binding = this.suspendHover(object);
		try {
			return await task();
		} finally {
			this.resumeHover(object, binding);
		}
	}
	synchronize(object) {
		const descriptor = this.describe(object);
		if (!descriptor) return;
		this.applyControlStyle(object);
		this.ensureHoverBinding(object);
		if (descriptor.hidden || descriptor.locked) this.restoreHover(object);
		this.synchronizeLabel(object, descriptor);
		this.synchronizeLockIndicator(object, descriptor);
		this.host.requestRender();
	}
	synchronizeAll(objects) {
		const live = new Set(objects);
		for (const object of [...this.labels.keys()]) if (!live.has(object)) this.removeFor(object);
		for (const object of [...this.lockIndicators.keys()]) if (!live.has(object)) this.removeFor(object);
		for (const object of [...this.hoverBindings.keys()]) if (!live.has(object)) this.removeFor(object);
		for (const object of objects) this.synchronize(object);
	}
	removeFor(object) {
		this.removePresentation(this.labels, object);
		this.removePresentation(this.lockIndicators, object);
		this.detachHoverBinding(object);
	}
	reset() {
		for (const object of /* @__PURE__ */ new Set([
			...this.labels.keys(),
			...this.lockIndicators.keys(),
			...this.hoverBindings.keys()
		])) this.removeFor(object);
		this.host.requestRender();
	}
	applyControlStyle(object) {
		if (Object.keys(this.options.controlStyle).length === 0) return;
		object.set(this.options.controlStyle);
		object.setCoords();
	}
	ensureHoverBinding(object) {
		const style = this.options.hoverStyle;
		if (style === false || this.hoverBindings.has(object)) return;
		const binding = {
			hovered: false,
			original: null,
			over: () => {
				if (object.editorOverlayHidden || object.editorOverlayLocked) return;
				binding.hovered = true;
				if (binding.original) return;
				binding.original = this.captureHoverProperties(object, style);
				object.set(style);
				object.setCoords();
				this.host.requestRender();
			},
			out: () => {
				binding.hovered = false;
				this.restoreHover(object);
				this.host.requestRender();
			}
		};
		object.on("mouseover", binding.over);
		object.on("mouseout", binding.out);
		this.hoverBindings.set(object, binding);
	}
	restoreHover(object) {
		const binding = this.hoverBindings.get(object);
		if (!(binding === null || binding === void 0 ? void 0 : binding.original)) return;
		object.set(binding.original);
		object.setCoords();
		binding.original = null;
	}
	suspendHover(object) {
		const binding = this.hoverBindings.get(object);
		if (!(binding === null || binding === void 0 ? void 0 : binding.original)) return null;
		object.set(binding.original);
		object.setCoords();
		binding.original = null;
		return binding;
	}
	resumeHover(object, binding) {
		if (!binding || this.hoverBindings.get(object) !== binding || binding.original) return;
		if (object.editorOverlayHidden || object.editorOverlayLocked) {
			binding.hovered = false;
			return;
		}
		if (!binding.hovered) return;
		const style = this.options.hoverStyle;
		if (style === false) return;
		binding.original = this.captureHoverProperties(object, style);
		object.set(style);
		object.setCoords();
		this.host.requestRender();
	}
	captureHoverProperties(object, style) {
		return Object.freeze({
			..."fill" in style ? { fill: object.fill } : {},
			..."opacity" in style ? { opacity: object.opacity } : {},
			..."stroke" in style ? { stroke: object.stroke } : {},
			..."strokeWidth" in style ? { strokeWidth: object.strokeWidth } : {}
		});
	}
	detachHoverBinding(object) {
		const binding = this.hoverBindings.get(object);
		if (!binding) return;
		binding.hovered = false;
		this.restoreHover(object);
		object.off("mouseover", binding.over);
		object.off("mouseout", binding.out);
		this.hoverBindings.delete(object);
	}
	synchronizeLabel(object, descriptor) {
		var _a, _b;
		const config = this.options.label;
		if (config === false) {
			this.removePresentation(this.labels, object);
			return;
		}
		if (!(!descriptor.hidden && (config.showOn === "always" || this.isSelected(descriptor.id)))) {
			this.removePresentation(this.labels, object);
			return;
		}
		let label = this.labels.get(object);
		const text = this.labelText(config, descriptor);
		if (!label) {
			label = require_internal_layer_placement.markSessionObject(new this.host.fabric.FabricText(text, {
				fontFamily: "monospace",
				fontSize: 12,
				fill: "#ffffff",
				backgroundColor: "rgba(0, 0, 0, 0.75)",
				...(_a = config.textOptions) !== null && _a !== void 0 ? _a : {},
				originX: "left",
				originY: "top",
				selectable: false,
				evented: false,
				hasControls: false,
				excludeFromExport: true
			}), "annotationLabel");
			this.markPresentation(label, descriptor.id);
			this.labels.set(object, label);
			require_internal_layer_placement.placeSessionObject(this.host.requireCanvas("show an Annotation label"), label);
		} else if (label.text !== text) label.set({ text });
		const bounds = object.getBoundingRect();
		label.set({
			left: bounds.left,
			top: Math.max(0, bounds.top - label.getScaledHeight() - ((_b = config.offset) !== null && _b !== void 0 ? _b : 3)),
			visible: true
		});
		label.setCoords();
	}
	labelText(config, descriptor) {
		if (!config.getText) return descriptor.name;
		try {
			const value = config.getText(descriptor);
			return typeof value === "string" ? value : descriptor.name;
		} catch (error) {
			this.host.reportWarning(error, "Annotation label.getText callback failed.");
			return descriptor.name;
		}
	}
	synchronizeLockIndicator(object, descriptor) {
		const config = this.options.lockIndicator;
		if (config === false || descriptor.hidden || !descriptor.locked) {
			this.removePresentation(this.lockIndicators, object);
			return;
		}
		let indicator = this.lockIndicators.get(object);
		if (!indicator) {
			indicator = this.createLockIndicator(config, descriptor.id);
			this.lockIndicators.set(object, indicator);
			require_internal_layer_placement.placeSessionObject(this.host.requireCanvas("show an Annotation lock indicator"), indicator);
		}
		const bounds = object.getBoundingRect();
		indicator.set({
			left: Math.max(0, bounds.left + bounds.width - config.size - config.offset),
			top: Math.max(0, bounds.top + config.offset),
			visible: true
		});
		indicator.setCoords();
	}
	createLockIndicator(config, ownerId) {
		const strokeWidth = Math.max(1, config.size / 10);
		const shackle = new this.host.fabric.Rect({
			left: config.size * .27,
			top: strokeWidth / 2,
			width: config.size * .46,
			height: config.size * .52,
			rx: config.size * .2,
			ry: config.size * .2,
			fill: "transparent",
			stroke: config.iconColor,
			strokeWidth,
			selectable: false,
			evented: false
		});
		const body = new this.host.fabric.Rect({
			left: strokeWidth / 2,
			top: config.size * .42,
			width: config.size - strokeWidth,
			height: config.size * .55,
			rx: config.size * .1,
			ry: config.size * .1,
			fill: config.backgroundColor,
			stroke: config.iconColor,
			strokeWidth,
			selectable: false,
			evented: false
		});
		const keyhole = new this.host.fabric.Circle({
			left: config.size * .44,
			top: config.size * .6,
			radius: config.size * .07,
			fill: config.iconColor,
			selectable: false,
			evented: false
		});
		const group = require_internal_layer_placement.markSessionObject(new this.host.fabric.Group([
			shackle,
			body,
			keyhole
		], {
			originX: "left",
			originY: "top",
			selectable: false,
			evented: false,
			hasControls: false,
			excludeFromExport: true
		}), "annotationLockIndicator");
		this.markPresentation(group, ownerId);
		return group;
	}
	markPresentation(object, ownerId) {
		const presentation = object;
		presentation.annotationPresentation = true;
		presentation.annotationOwnerId = ownerId;
	}
	removePresentation(collection, owner) {
		const presentation = collection.get(owner);
		if (!presentation) return;
		collection.delete(owner);
		const canvas = this.host.getCanvas();
		if (canvas === null || canvas === void 0 ? void 0 : canvas.getObjects().includes(presentation)) canvas.remove(presentation);
		presentation.dispose();
	}
};
function isAnnotationPresentationObject(object) {
	return object.annotationPresentation === true;
}

//#endregion
//#region dist/esm/foundations/annotation/annotation-runtime-state.js
function booleanOr(value, fallback) {
	return typeof value === "boolean" ? value : fallback;
}
function captureAnnotationInteraction(object) {
	return Object.freeze({
		selectable: booleanOr(object.editorAnnotationSelectable, object.selectable !== false),
		evented: booleanOr(object.editorAnnotationEvented, object.evented !== false),
		hasControls: booleanOr(object.editorAnnotationHasControls, object.hasControls !== false),
		...typeof object.editorAnnotationEditable === "boolean" || typeof object.editable === "boolean" ? { editable: booleanOr(object.editorAnnotationEditable, object.editable !== false) } : {}
	});
}
function applyAnnotationInteraction(object, interaction) {
	object.editorAnnotationSelectable = interaction.selectable;
	object.editorAnnotationEvented = interaction.evented;
	object.editorAnnotationHasControls = interaction.hasControls;
	if (typeof interaction.editable === "boolean") object.editorAnnotationEditable = interaction.editable;
	synchronizeAnnotationRuntimeState(object);
}
function synchronizeAnnotationRuntimeState(object) {
	const hidden = object.editorOverlayHidden === true;
	const locked = object.editorOverlayLocked === true;
	const interaction = captureAnnotationInteraction(object);
	object.set({
		visible: !hidden,
		selectable: locked ? false : interaction.selectable,
		evented: locked ? false : interaction.evented,
		hasControls: locked ? false : interaction.hasControls,
		lockMovementX: locked,
		lockMovementY: locked,
		lockScalingX: locked,
		lockScalingY: locked,
		lockRotation: locked
	});
	if (typeof interaction.editable === "boolean") object.editable = locked ? false : interaction.editable;
	object.setCoords();
}

//#endregion
//#region dist/esm/foundations/annotation/annotation-controller.js
const ANNOTATION_FOUNDATION_ID = "foundation:annotation";
const ANNOTATION_PREVIEW_KIND = "annotation:preview";
const FEATURE_KIND_PATTERN = /^annotation:[a-z][a-z0-9-]{0,63}$/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9@][A-Za-z0-9@._:/-]{0,127}$/;
const DEFAULT_MAX_ANNOTATION_COUNT = 2e3;
const HARD_MAX_ANNOTATION_COUNT = 1e4;
function isPlainRecord(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}
function isInteractionState(value) {
	if (!isPlainRecord(value)) return false;
	return Object.keys(value).every((key) => [
		"selectable",
		"evented",
		"hasControls",
		"editable"
	].includes(key)) && typeof value.selectable === "boolean" && typeof value.evented === "boolean" && typeof value.hasControls === "boolean" && (value.editable === void 0 || typeof value.editable === "boolean");
}
function isEnvelopeShape(value) {
	if (!isPlainRecord(value)) return false;
	return Object.keys(value).every((key) => [
		"version",
		"name",
		"metadata",
		"interaction",
		"feature"
	].includes(key)) && value.version === 1 && typeof value.name === "string" && isValidAnnotationMetadata(value.metadata) && isInteractionState(value.interaction) && "feature" in value;
}
function equalMetadata(left, right) {
	if (Object.is(left, right)) return true;
	if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((entry, index) => equalMetadata(entry, right[index]));
	if (isPlainRecord(left) && isPlainRecord(right)) {
		const leftKeys = Object.keys(left).sort();
		const rightKeys = Object.keys(right).sort();
		return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && equalMetadata(left[key], right[key]));
	}
	return false;
}
function freezeEnvelope(object, feature) {
	return Object.freeze({
		version: 1,
		name: normalizeAnnotationName(object.editorAnnotationName),
		metadata: normalizeAnnotationMetadata(object.editorAnnotationMetadata),
		interaction: captureAnnotationInteraction(object),
		feature
	});
}
function isStateData(value) {
	return isPlainRecord(value) && Object.keys(value).every((key) => [
		"version",
		"name",
		"interaction",
		"feature"
	].includes(key)) && value.version === 1 && typeof value.name === "string" && isInteractionState(value.interaction) && Object.prototype.hasOwnProperty.call(value, "feature");
}
function validateBoolean(value, label) {
	if (value === void 0) return void 0;
	if (typeof value !== "boolean") throw new AnnotationValidationError(`${label} must be boolean.`);
	return value;
}
function normalizeSharedUpdate(value) {
	if (!isPlainRecord(value)) throw new AnnotationValidationError("Annotation update must be a plain object.");
	const allowed = /* @__PURE__ */ new Set([
		"name",
		"metadata",
		"hidden",
		"locked"
	]);
	if (Object.keys(value).some((key) => !allowed.has(key))) throw new AnnotationValidationError("Annotation update contains unknown keys.");
	return Object.freeze({
		...value.name !== void 0 ? { name: normalizeAnnotationName(value.name) } : {},
		...value.metadata !== void 0 ? { metadata: normalizeAnnotationMetadata(value.metadata) } : {},
		...value.hidden !== void 0 ? { hidden: validateBoolean(value.hidden, "Annotation hidden state") } : {},
		...value.locked !== void 0 ? { locked: validateBoolean(value.locked, "Annotation locked state") } : {}
	});
}
function validateStringList(value, label) {
	if (value === void 0) return void 0;
	if (!Array.isArray(value) || value.length > 2e3 || value.some((entry) => typeof entry !== "string" || entry.length === 0 || entry.length > 128 || entry.trim() !== entry)) throw new AnnotationValidationError(`${label} is invalid.`);
	return Object.freeze([...new Set(value)]);
}
var AnnotationController = class {
	constructor(host, overlay, options, state) {
		Object.defineProperty(this, "host", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: host
		});
		Object.defineProperty(this, "overlay", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: overlay
		});
		Object.defineProperty(this, "features", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Map()
		});
		Object.defineProperty(this, "listeners", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Set()
		});
		Object.defineProperty(this, "registrations", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: []
		});
		Object.defineProperty(this, "maxAnnotationCount", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "listOrder", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "presentationOptions", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "presentations", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "mutationSequence", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: 0
		});
		Object.defineProperty(this, "generatedIdSequence", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: 0
		});
		Object.defineProperty(this, "lastInteractionId", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: null
		});
		Object.defineProperty(this, "disposed", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: false
		});
		const configuredLimit = options.maxAnnotationCount;
		if (configuredLimit !== void 0 && (!Number.isSafeInteger(configuredLimit) || configuredLimit <= 0 || configuredLimit > HARD_MAX_ANNOTATION_COUNT)) throw new AnnotationValidationError(`Annotation count limit must be an integer from 1 to ${HARD_MAX_ANNOTATION_COUNT}.`);
		this.maxAnnotationCount = configuredLimit !== null && configuredLimit !== void 0 ? configuredLimit : DEFAULT_MAX_ANNOTATION_COUNT;
		this.listOrder = options.listOrder === "back-to-front" ? "back-to-front" : "front-to-back";
		this.presentationOptions = resolveAnnotationPresentationOptions(options);
		this.presentations = new AnnotationPresentationManager(host, this.presentationOptions, (object) => this.describePresentationOwner(object), (id) => this.overlay.getSelection().ids.includes(id));
		this.registrations.push(overlay.registerKind({
			id: ANNOTATION_PREVIEW_KIND,
			ownerPluginId: ANNOTATION_FOUNDATION_ID,
			classify: (object) => object.editorAnnotationPreviewOwner !== void 0 && object.editorOverlayKind === ANNOTATION_PREVIEW_KIND,
			getPersistentId: (object) => {
				var _a;
				return (_a = object.editorAnnotationPreviewId) !== null && _a !== void 0 ? _a : null;
			},
			setPersistentId: (object, id) => {
				const preview = object;
				preview.editorAnnotationPreviewId = id;
				preview.editorOverlayId = id;
			},
			persistence: { mode: "transient" }
		}));
		if (state) this.registrations.push(state.registerTransientObject(ANNOTATION_FOUNDATION_ID, (object) => isAnnotationPresentationObject(object)));
		this.registrations.push(overlay.onSelectionChange(() => {
			this.synchronizePresentations();
			this.emitStatus();
		}));
	}
	list(query = {}) {
		this.assertActive("list Annotations");
		const normalized = this.normalizeQuery(query);
		const objects = this.overlay.list(normalized);
		const selected = new Set(this.overlay.getSelection().ids);
		const allLayers = this.persistentOverlayObjects();
		const descriptors = objects.filter((object) => this.isAnnotationObject(object)).map((object) => this.describe(object, selected, allLayers));
		if (this.listOrder === "front-to-back") descriptors.reverse();
		return Object.freeze(descriptors);
	}
	get(id) {
		this.assertIdentifier(id, "Annotation id");
		const object = this.overlay.getByPersistentId(id);
		if (!object || !this.isAnnotationObject(object)) return null;
		return this.describe(object, new Set(this.overlay.getSelection().ids), this.persistentOverlayObjects());
	}
	async update(id, patch) {
		const object = this.requireAnnotation(id);
		const normalized = normalizeSharedUpdate(patch);
		if (!this.hasSharedUpdate(object, normalized)) return;
		await this.overlay.mutate({
			id: this.nextMutationId("update"),
			operationId: "annotation:update",
			action: "programmatic",
			objectIds: [id],
			metadata: Object.freeze({ annotationKind: object.editorAnnotationKind }),
			mutate: () => this.applySharedUpdate(object, normalized),
			synchronize: () => this.emitStatus()
		});
	}
	async remove(id) {
		await this.removeFeatures({
			ids: [id],
			operationId: "annotation:remove"
		});
	}
	async removeAll(options = {}) {
		var _a, _b;
		const { force, query } = this.normalizeRemoveAllOptions(options);
		const ids = this.list({
			...query,
			includeHidden: (_a = query.includeHidden) !== null && _a !== void 0 ? _a : true,
			includeLocked: (_b = query.includeLocked) !== null && _b !== void 0 ? _b : true
		}).filter((entry) => force || !entry.locked).map((entry) => entry.id);
		await this.removeFeatures({
			ids,
			operationId: "annotation:remove-all"
		});
	}
	async select(ids) {
		var _a;
		const normalized = (_a = validateStringList(ids, "Annotation selection")) !== null && _a !== void 0 ? _a : [];
		for (const id of normalized) {
			const descriptor = this.get(id);
			if (!descriptor) throw new AnnotationNotFoundError(`Annotation "${id}" was not found.`);
			if (descriptor.hidden || descriptor.locked) throw new AnnotationValidationError(`Annotation "${id}" cannot be selected while hidden or locked.`);
		}
		this.overlay.select(normalized);
	}
	async clearSelection() {
		this.overlay.discardSelection();
	}
	bringForward(id) {
		return this.moveLayer(id, "forward");
	}
	sendBackward(id) {
		return this.moveLayer(id, "backward");
	}
	bringToFront(id) {
		return this.moveLayer(id, "front");
	}
	sendToBack(id) {
		return this.moveLayer(id, "back");
	}
	async flatten(query = {}, options = {}) {
		const matches = this.list({
			...query,
			includeLocked: true
		});
		if (matches.length === 0) return;
		await this.overlay.flatten({
			ids: matches.map((entry) => entry.id),
			kinds: [...this.features.keys()],
			includeHidden: query.includeHidden === true,
			includeLocked: true
		}, options);
		this.emitStatus();
	}
	subscribe(listener) {
		this.assertActive("subscribe to Annotation status");
		if (typeof listener !== "function") throw new AnnotationValidationError("Annotation listener must be a function.");
		this.listeners.add(listener);
		return require_core_capabilities.createDisposable(() => {
			this.listeners.delete(listener);
		});
	}
	registerFeature(definition) {
		this.assertActive("register an Annotation Feature");
		this.validateFeatureDefinition(definition);
		if (this.features.has(definition.kind)) throw new AnnotationError(`Annotation Feature "${definition.kind}" is already registered.`);
		const normalizedDefinition = Object.freeze({ ...definition });
		const registrations = [];
		try {
			registrations.push(this.overlay.registerKind(this.buildOverlayKindDefinition(normalizedDefinition)));
			registrations.push(this.overlay.registerGeometryPolicy(this.buildGeometryPolicy(normalizedDefinition)));
			registrations.push(this.overlay.registerExportRenderer(this.buildExportRenderer(normalizedDefinition)));
			registrations.push(this.overlay.registerInteractionPolicy(this.buildInteractionPolicy(normalizedDefinition)));
		} catch (error) {
			this.disposeRegistrations(registrations);
			throw error;
		}
		const record = Object.freeze({
			definition: normalizedDefinition,
			registrations: Object.freeze(registrations)
		});
		this.features.set(normalizedDefinition.kind, record);
		return require_core_capabilities.createDisposable(() => {
			if (this.features.get(normalizedDefinition.kind) !== record) return;
			this.features.delete(normalizedDefinition.kind);
			this.disposeRegistrations(registrations);
			this.synchronizePresentations();
			this.emitStatus();
		});
	}
	async create(request) {
		this.assertActive("create an Annotation");
		const feature = this.requireFeature(request.kind);
		this.assertIdentifier(request.operationId, "Annotation operation id");
		if (this.list({
			includeHidden: true,
			includeLocked: true
		}).length >= this.maxAnnotationCount) throw new AnnotationValidationError("Annotation count limit was reached.");
		const object = request.object;
		object.editorAnnotationKind = request.kind;
		if (!feature.definition.classify(object)) throw new AnnotationValidationError(`Annotation object does not satisfy Feature "${request.kind}".`);
		const id = this.createAnnotationId();
		object.editorOverlayId = id;
		object.editorAnnotationName = normalizeAnnotationName(request.name);
		object.editorAnnotationMetadata = normalizeAnnotationMetadata(request.metadata);
		object.editorOverlayHidden = request.hidden === true;
		object.editorOverlayLocked = request.locked === true;
		applyAnnotationInteraction(object, captureAnnotationInteraction(object));
		const canvas = this.host.requireCanvas("create an Annotation");
		await this.overlay.mutate({
			id: this.nextMutationId("create"),
			operationId: request.operationId,
			action: "create",
			metadata: Object.freeze({ annotationKind: request.kind }),
			mutate: () => canvas.add(object),
			affectedObjects: () => [object],
			synchronize: () => {
				if (request.select !== false && !object.editorOverlayHidden && !object.editorOverlayLocked) this.overlay.select([id]);
				this.emitStatus();
			}
		});
		this.synchronizePresentations();
		return id;
	}
	async updateFeature(request) {
		this.assertIdentifier(request.operationId, "Annotation operation id");
		const feature = this.requireFeature(request.kind).definition;
		const object = this.requireAnnotation(request.id, request.kind);
		const normalizedFeaturePatch = feature.normalizeUpdate ? feature.normalizeUpdate(request.patch) : request.patch;
		const normalizedShared = request.shared ? normalizeSharedUpdate(request.shared) : Object.freeze({});
		const featureChanged = feature.hasUpdate ? feature.hasUpdate(object, normalizedFeaturePatch) : false;
		const sharedChanged = this.hasSharedUpdate(object, normalizedShared);
		if (!featureChanged && !sharedChanged) return;
		await this.presentations.withBaseStyleAsync(object, () => this.overlay.mutate({
			id: this.nextMutationId("feature-update"),
			operationId: request.operationId,
			action: "programmatic",
			objectIds: [request.id],
			metadata: Object.freeze({ annotationKind: request.kind }),
			mutate: () => {
				var _a, _b;
				if (featureChanged) (_a = feature.applyUpdate) === null || _a === void 0 || _a.call(feature, object, normalizedFeaturePatch);
				if (sharedChanged) this.applySharedUpdate(object, normalizedShared);
				(_b = feature.synchronize) === null || _b === void 0 || _b.call(feature, object);
			},
			synchronize: () => this.emitStatus()
		}));
		this.synchronizePresentations();
	}
	async removeFeatures(request) {
		var _a;
		this.assertIdentifier(request.operationId, "Annotation operation id");
		const ids = (_a = validateStringList(request.ids, "Annotation removal ids")) !== null && _a !== void 0 ? _a : [];
		if (ids.length === 0) return;
		const objects = ids.map((id) => this.requireAnnotation(id, request.kind));
		await this.overlay.mutate({
			id: this.nextMutationId("remove"),
			operationId: request.operationId,
			action: "delete",
			objectIds: ids,
			metadata: Object.freeze({
				...request.kind ? { annotationKind: request.kind } : {},
				objectCount: objects.length
			}),
			mutate: () => {
				const canvas = this.host.requireCanvas("remove Annotations");
				for (const object of objects) canvas.remove(object);
			},
			synchronize: () => this.emitStatus()
		});
		this.synchronizePresentations();
	}
	getObject(id, kind) {
		const object = this.overlay.getByPersistentId(id);
		if (!object || !this.isAnnotationObject(object)) return null;
		const classification = this.overlay.classify(object);
		return !kind || (classification === null || classification === void 0 ? void 0 : classification.kind) === kind ? object : null;
	}
	listObjects(kind) {
		if (!this.features.has(kind)) return Object.freeze([]);
		return Object.freeze(this.overlay.list({
			kinds: [kind],
			includeHidden: true,
			includeLocked: true
		}));
	}
	addPreview(request) {
		this.assertActive("add an Annotation preview");
		this.assertPreviewRequest(request);
		const canvas = this.host.requireCanvas("add an Annotation preview");
		const preview = request.object;
		preview.editorAnnotationPreviewId = request.id;
		preview.editorAnnotationPreviewOwner = request.ownerKind;
		preview.editorOverlayKind = ANNOTATION_PREVIEW_KIND;
		preview.editorOverlayId = request.id;
		preview.set({
			visible: true,
			selectable: request.interactive === true,
			evented: request.interactive === true,
			hasControls: false,
			excludeFromExport: true
		});
		require_internal_layer_placement.placeSessionObject(canvas, preview);
		if (request.select === true) canvas.setActiveObject(preview);
		const classification = this.overlay.classify(preview);
		if ((classification === null || classification === void 0 ? void 0 : classification.kind) !== ANNOTATION_PREVIEW_KIND) {
			canvas.remove(preview);
			throw new AnnotationError("Annotation preview was not indexed as transient.");
		}
		this.host.requestRender();
	}
	replacePreview(previousIds, request) {
		this.removePreview(previousIds);
		this.addPreview(request);
	}
	removePreview(ids) {
		var _a;
		const normalized = (_a = validateStringList(ids, "Annotation preview ids")) !== null && _a !== void 0 ? _a : [];
		const canvas = this.host.getCanvas();
		if (!canvas) return;
		for (const id of normalized) {
			const object = this.overlay.getByPersistentId(id);
			if (object === null || object === void 0 ? void 0 : object.editorAnnotationPreviewOwner) {
				if (canvas.getActiveObject() === object) canvas.discardActiveObject();
				canvas.remove(object);
				object.dispose();
			}
		}
		this.host.requestRender();
	}
	hideForPreview(ids) {
		return this.overlay.hideForPreview(ids);
	}
	applyGeometry(object, mutation, preserveReadable) {
		applyAnnotationGeometry(object, mutation, this.host.fabric, preserveReadable);
	}
	resetForImage() {
		this.removeAllPreviews();
		this.presentations.reset();
		this.emitStatus();
	}
	synchronizeRuntimePresentation() {
		this.synchronizePresentations();
	}
	dispose() {
		if (this.disposed) return;
		this.removeAllPreviews();
		this.presentations.reset();
		this.listeners.clear();
		for (const feature of [...this.features.values()].reverse()) this.disposeRegistrations(feature.registrations);
		this.features.clear();
		this.disposeRegistrations(this.registrations);
		this.registrations.length = 0;
		this.disposed = true;
	}
	buildOverlayKindDefinition(definition) {
		var _a;
		const stateCodec = this.buildOverlayStateCodec(definition);
		return {
			id: definition.kind,
			ownerPluginId: definition.ownerPluginId,
			classify: (object) => object.editorAnnotationKind === definition.kind && definition.classify(object),
			getPersistentId: (object) => {
				var _a;
				return (_a = object.editorOverlayId) !== null && _a !== void 0 ? _a : null;
			},
			setPersistentId: (object, id) => {
				object.editorOverlayId = id;
			},
			isHidden: (object) => object.editorOverlayHidden === true,
			setHidden: (object, hidden) => {
				const annotation = object;
				annotation.editorOverlayHidden = hidden;
				synchronizeAnnotationRuntimeState(annotation);
			},
			isLocked: (object) => object.editorOverlayLocked === true,
			setLocked: (object, locked) => {
				const annotation = object;
				annotation.editorOverlayLocked = locked;
				synchronizeAnnotationRuntimeState(annotation);
			},
			exportByDefault: (_a = definition.exportByDefault) !== null && _a !== void 0 ? _a : this.presentationOptions.exportByDefault,
			persistence: {
				mode: "persistent",
				codec: {
					type: definition.codec.type,
					version: definition.codec.version,
					serialize: (object) => {
						const annotation = object;
						return this.presentations.withBaseStyle(annotation, () => freezeEnvelope(annotation, definition.codec.serialize(object)));
					},
					validate: (value) => isEnvelopeShape(value) && (() => {
						try {
							normalizeAnnotationName(value.name);
							normalizeAnnotationMetadata(value.metadata);
							return definition.codec.validate(value.feature);
						} catch {
							return false;
						}
					})(),
					deserialize: async (value, context) => {
						var _a;
						if (!isEnvelopeShape(value) || !definition.codec.validate(value.feature)) throw new AnnotationValidationError(`Serialized ${definition.kind} data is malformed.`);
						const object = await definition.codec.deserialize(value.feature, context);
						object.editorAnnotationKind = definition.kind;
						object.editorAnnotationName = normalizeAnnotationName(value.name);
						object.editorAnnotationMetadata = normalizeAnnotationMetadata(value.metadata);
						applyAnnotationInteraction(object, value.interaction);
						(_a = definition.synchronize) === null || _a === void 0 || _a.call(definition, object);
						return object;
					}
				}
			},
			...stateCodec ? { stateCodec } : {}
		};
	}
	buildOverlayStateCodec(definition) {
		const stateCodec = definition.stateCodec;
		if (!stateCodec) return void 0;
		return {
			type: stateCodec.type,
			version: stateCodec.version,
			serialize: (object, context) => {
				const annotation = object;
				return this.presentations.withBaseStyle(annotation, () => {
					const feature = stateCodec.serialize(object, context);
					return Object.freeze({
						geometry: feature.geometry,
						metadata: normalizeAnnotationMetadata(annotation.editorAnnotationMetadata),
						data: Object.freeze({
							version: 1,
							name: normalizeAnnotationName(annotation.editorAnnotationName),
							interaction: captureAnnotationInteraction(annotation),
							feature: feature.data
						})
					});
				});
			},
			validate: (value) => {
				if (!isStateData(value.data) || !isValidAnnotationMetadata(value.metadata)) return false;
				try {
					normalizeAnnotationName(value.data.name);
					return stateCodec.validate({
						geometry: value.geometry,
						data: value.data.feature
					});
				} catch {
					return false;
				}
			},
			deserialize: async (value, context) => {
				var _a;
				if (!isStateData(value.data) || !isValidAnnotationMetadata(value.metadata)) throw new AnnotationValidationError(`Serialized ${definition.kind} State data is malformed.`);
				const object = await stateCodec.deserialize({
					geometry: value.geometry,
					data: value.data.feature
				}, context);
				object.editorAnnotationKind = definition.kind;
				object.editorAnnotationName = normalizeAnnotationName(value.data.name);
				object.editorAnnotationMetadata = normalizeAnnotationMetadata(value.metadata);
				applyAnnotationInteraction(object, value.data.interaction);
				(_a = definition.synchronize) === null || _a === void 0 || _a.call(definition, object);
				return object;
			}
		};
	}
	buildGeometryPolicy(definition) {
		return {
			id: `${definition.kind}-geometry`,
			kind: definition.kind,
			ownerPluginId: definition.ownerPluginId,
			supports: (mutation) => {
				var _a;
				return mutation.kind === "crop" || mutation.kind === "transform" && ((_a = definition.bindToImageTransform) === null || _a === void 0 ? void 0 : _a.call(definition)) === true;
			},
			apply: (object, mutation) => {
				var _a;
				if (mutation.kind !== "transform") return;
				this.applyGeometry(object, mutation, ((_a = definition.preserveReadable) === null || _a === void 0 ? void 0 : _a.call(definition)) === true);
			},
			synchronize: () => {
				var _a;
				for (const object of this.listObjects(definition.kind)) {
					synchronizeAnnotationRuntimeState(object);
					(_a = definition.synchronize) === null || _a === void 0 || _a.call(definition, object);
					this.presentations.synchronize(object);
				}
			}
		};
	}
	buildExportRenderer(definition) {
		return {
			id: `${definition.kind}-export`,
			kind: definition.kind,
			ownerPluginId: definition.ownerPluginId,
			order: 200,
			render: async (context) => {
				await this.presentations.withBaseStyleAsync(context.source, async () => {
					if (definition.render) {
						await definition.render(context);
						return;
					}
					const clone = await context.source.clone();
					clone.set({
						visible: true,
						selectable: false,
						evented: false,
						hasControls: false
					});
					context.targetCanvas.add(clone);
				});
			}
		};
	}
	buildInteractionPolicy(definition) {
		return {
			id: `${definition.kind}-interaction`,
			kind: definition.kind,
			ownerPluginId: definition.ownerPluginId,
			preview: (object) => {
				this.presentations.synchronize(object);
			},
			synchronize: (object, context) => {
				var _a;
				synchronizeAnnotationRuntimeState(object);
				(_a = definition.synchronize) === null || _a === void 0 || _a.call(definition, object);
				this.presentations.synchronize(object);
				if (this.lastInteractionId !== context.descriptor.id) {
					this.lastInteractionId = context.descriptor.id;
					this.emitStatus();
				}
			},
			validate: (object) => {
				const annotation = object;
				normalizeAnnotationName(annotation.editorAnnotationName);
				normalizeAnnotationMetadata(annotation.editorAnnotationMetadata);
			}
		};
	}
	normalizeQuery(query) {
		if (!isPlainRecord(query)) throw new AnnotationValidationError("Annotation query must be a plain object.");
		const allowed = /* @__PURE__ */ new Set([
			"kinds",
			"ids",
			"includeHidden",
			"includeLocked"
		]);
		if (Object.keys(query).some((key) => !allowed.has(key))) throw new AnnotationValidationError("Annotation query contains unknown keys.");
		const kinds = validateStringList(query.kinds, "Annotation query kinds");
		if (kinds) for (const kind of kinds) this.requireFeature(kind);
		return Object.freeze({
			kinds: kinds !== null && kinds !== void 0 ? kinds : Object.freeze([...this.features.keys()]),
			...query.ids === void 0 ? {} : { ids: validateStringList(query.ids, "Annotation query ids") },
			...query.includeHidden === void 0 ? {} : { includeHidden: validateBoolean(query.includeHidden, "Query includeHidden") },
			...query.includeLocked === void 0 ? {} : { includeLocked: validateBoolean(query.includeLocked, "Query includeLocked") }
		});
	}
	normalizeRemoveAllOptions(options) {
		var _a;
		if (!isPlainRecord(options)) throw new AnnotationValidationError("Annotation removeAll options must be a plain object.");
		const allowed = /* @__PURE__ */ new Set([
			"kinds",
			"ids",
			"includeHidden",
			"includeLocked",
			"force"
		]);
		if (Object.keys(options).some((key) => !allowed.has(key))) throw new AnnotationValidationError("Annotation removeAll options contain unknown keys.");
		const typedOptions = options;
		const force = (_a = validateBoolean(typedOptions.force, "Annotation removeAll force")) !== null && _a !== void 0 ? _a : false;
		const query = Object.freeze({
			...typedOptions.kinds === void 0 ? {} : { kinds: typedOptions.kinds },
			...typedOptions.ids === void 0 ? {} : { ids: typedOptions.ids },
			...typedOptions.includeHidden === void 0 ? {} : { includeHidden: typedOptions.includeHidden },
			...typedOptions.includeLocked === void 0 ? {} : { includeLocked: typedOptions.includeLocked }
		});
		this.normalizeQuery(query);
		return Object.freeze({
			force,
			query
		});
	}
	describe(object, selected, layers) {
		const annotation = object;
		const classification = this.overlay.classify(object);
		if (!classification || !this.features.has(classification.kind)) throw new AnnotationError("Annotation descriptor lost its Overlay classification.");
		return Object.freeze({
			id: classification.persistentId,
			kind: classification.kind,
			name: normalizeAnnotationName(annotation.editorAnnotationName),
			hidden: classification.hidden,
			locked: classification.locked,
			selected: selected.has(classification.persistentId),
			layerIndex: layers.indexOf(object),
			metadata: normalizeAnnotationMetadata(annotation.editorAnnotationMetadata)
		});
	}
	hasSharedUpdate(object, patch) {
		return patch.name !== void 0 && patch.name !== object.editorAnnotationName || patch.metadata !== void 0 && !equalMetadata(patch.metadata, object.editorAnnotationMetadata) || patch.hidden !== void 0 && patch.hidden !== (object.editorOverlayHidden === true) || patch.locked !== void 0 && patch.locked !== (object.editorOverlayLocked === true);
	}
	applySharedUpdate(object, patch) {
		if (patch.name !== void 0) object.editorAnnotationName = patch.name;
		if (patch.metadata !== void 0) object.editorAnnotationMetadata = normalizeAnnotationMetadata(patch.metadata);
		if (patch.hidden !== void 0) object.editorOverlayHidden = patch.hidden;
		if (patch.locked !== void 0) object.editorOverlayLocked = patch.locked;
		synchronizeAnnotationRuntimeState(object);
	}
	async moveLayer(id, direction) {
		const object = this.requireAnnotation(id);
		const overlays = this.persistentOverlayObjects();
		const index = overlays.indexOf(object);
		if (index < 0 || (direction === "forward" || direction === "front") && index === overlays.length - 1 || (direction === "backward" || direction === "back") && index === 0) return;
		if (direction === "forward") await this.overlay.bringForward(id);
		else if (direction === "backward") await this.overlay.sendBackward(id);
		else if (direction === "front") await this.overlay.bringToFront(id);
		else await this.overlay.sendToBack(id);
		this.emitStatus();
	}
	persistentOverlayObjects() {
		return Object.freeze(this.overlay.list({
			includeHidden: true,
			includeLocked: true
		}).filter((object) => {
			var _a;
			return ((_a = this.overlay.classify(object)) === null || _a === void 0 ? void 0 : _a.kind) !== ANNOTATION_PREVIEW_KIND;
		}));
	}
	isAnnotationObject(object) {
		const classification = this.overlay.classify(object);
		return !!classification && this.features.has(classification.kind);
	}
	describePresentationOwner(object) {
		const id = object.editorOverlayId;
		if (!id) return null;
		return this.get(id);
	}
	synchronizePresentations() {
		if (this.disposed) return;
		const objects = this.overlay.list({
			kinds: [...this.features.keys()],
			includeHidden: true,
			includeLocked: true
		}).filter((object) => this.isAnnotationObject(object));
		this.presentations.synchronizeAll(objects);
	}
	requireAnnotation(id, kind) {
		this.assertIdentifier(id, "Annotation id");
		const object = this.getObject(id, kind);
		if (!object) throw new AnnotationNotFoundError(kind ? `Annotation "${id}" of kind "${kind}" was not found.` : `Annotation "${id}" was not found.`);
		return object;
	}
	requireFeature(kind) {
		if (!FEATURE_KIND_PATTERN.test(kind) || kind === ANNOTATION_PREVIEW_KIND) throw new AnnotationValidationError(`Annotation Feature kind "${kind}" is invalid.`);
		const feature = this.features.get(kind);
		if (!feature) throw new AnnotationNotFoundError(`Annotation Feature "${kind}" is not installed.`);
		return feature;
	}
	validateFeatureDefinition(definition) {
		if (!isPlainRecord(definition)) throw new AnnotationValidationError("Annotation Feature definition must be an object.");
		if (!FEATURE_KIND_PATTERN.test(definition.kind) || definition.kind === ANNOTATION_PREVIEW_KIND) throw new AnnotationValidationError("Annotation Feature kind is invalid.");
		this.assertIdentifier(definition.ownerPluginId, "Annotation Feature owner");
		if (typeof definition.classify !== "function" || !isPlainRecord(definition.codec) || !IDENTIFIER_PATTERN.test(definition.codec.type) || !/^\d+\.\d+\.\d+$/.test(definition.codec.version) || typeof definition.codec.serialize !== "function" || typeof definition.codec.validate !== "function" || typeof definition.codec.deserialize !== "function") throw new AnnotationValidationError("Annotation Feature codec is invalid.");
	}
	assertPreviewRequest(request) {
		this.assertIdentifier(request.id, "Annotation preview id");
		this.requireFeature(request.ownerKind);
		if (!request.object || typeof request.object !== "object") throw new AnnotationValidationError("Annotation preview object is invalid.");
	}
	removeAllPreviews() {
		const canvas = this.host.getCanvas();
		if (!canvas) return;
		for (const object of [...canvas.getObjects()]) {
			if (object.editorOverlayKind !== ANNOTATION_PREVIEW_KIND) continue;
			canvas.remove(object);
			object.dispose();
		}
		this.host.requestRender();
	}
	emitStatus() {
		if (this.disposed || this.listeners.size === 0) return;
		const status = Object.freeze({
			annotations: this.list({
				includeHidden: true,
				includeLocked: true
			}),
			selectionIds: Object.freeze(this.overlay.getSelection().ids.filter((id) => this.get(id) !== null))
		});
		for (const listener of [...this.listeners]) try {
			listener(status);
		} catch (error) {
			this.host.reportWarning(error, "An Annotation status listener failed.");
		}
	}
	createAnnotationId() {
		var _a, _b;
		const randomId = (_b = (_a = globalThis.crypto) === null || _a === void 0 ? void 0 : _a.randomUUID) === null || _b === void 0 ? void 0 : _b.call(_a);
		return randomId ? `annotation:${randomId}` : `annotation:${Date.now().toString(36)}:${++this.generatedIdSequence}`;
	}
	nextMutationId(action) {
		return `annotation:${action}:${++this.mutationSequence}`;
	}
	disposeRegistrations(registrations) {
		const errors = [];
		for (let index = registrations.length - 1; index >= 0; index -= 1) try {
			const result = registrations[index].dispose();
			if (result instanceof Promise) result.catch((error) => this.host.reportWarning(error, "Annotation cleanup failed."));
		} catch (error) {
			errors.push(error);
		}
		if (errors.length > 0) throw new AnnotationError(`Annotation cleanup had ${errors.length} synchronous error(s).`);
	}
	assertIdentifier(value, label) {
		if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) throw new AnnotationValidationError(`${label} is invalid.`);
	}
	assertActive(operation) {
		if (this.disposed) throw new AnnotationError(`Cannot ${operation} after disposal.`);
	}
};

//#endregion
//#region dist/esm/foundations/annotation/index.js
const ANNOTATION_CAPABILITY = require_core_capabilities.createCapabilityToken("foundation:annotation", "1.0.0");
const ANNOTATION_AUTHORING_CAPABILITY = require_core_capabilities.createCapabilityToken("foundation:annotation-authoring", "1.0.0");
const annotationFoundationRef = require_core_capabilities.definePluginRef("foundation:annotation", "1.0.0");
function annotationFoundationPlugin(options = {}) {
	let controller = null;
	return require_sdk.definePlugin({
		ref: annotationFoundationRef,
		manifest: {
			id: annotationFoundationRef.id,
			version: "1.0.0",
			apiVersion: annotationFoundationRef.apiVersion,
			engine: "^3.0.0",
			requiresPlugins: [require_overlay.overlayFoundationRef],
			requires: [
				{
					token: require_overlay.OVERLAY_CAPABILITY,
					range: "^1.0.0"
				},
				{
					token: require_overlay.OVERLAY_REGISTRATION_CAPABILITY,
					range: "^1.0.0"
				},
				{
					token: require_core_capabilities.CORE_DIAGNOSTICS_CAPABILITY,
					range: "^1.0.0"
				},
				{
					token: require_core_capabilities.FABRIC_RUNTIME_CAPABILITY,
					range: "^1.0.0"
				},
				{
					token: require_core_capabilities.CANVAS_READ_CAPABILITY,
					range: "^1.0.0"
				},
				{
					token: require_core_capabilities.RENDER_REQUEST_CAPABILITY,
					range: "^1.0.0"
				},
				{
					token: require_core_capabilities.SNAPSHOT_REGISTRATION_CAPABILITY,
					range: "^1.0.0"
				}
			],
			permissions: [
				"fabric:objects",
				"fabric:canvas-read",
				"fabric:custom-class"
			]
		},
		setupMode: "sync",
		setup(context) {
			const overlay = context.capabilities.require(require_overlay.OVERLAY_CAPABILITY);
			const registration = context.capabilities.require(require_overlay.OVERLAY_REGISTRATION_CAPABILITY);
			const diagnostics = context.capabilities.require(require_core_capabilities.CORE_DIAGNOSTICS_CAPABILITY);
			const fabric = context.capabilities.require(require_core_capabilities.FABRIC_RUNTIME_CAPABILITY);
			const canvas = context.capabilities.require(require_core_capabilities.CANVAS_READ_CAPABILITY);
			const render = context.capabilities.require(require_core_capabilities.RENDER_REQUEST_CAPABILITY);
			const state = context.capabilities.require(require_core_capabilities.SNAPSHOT_REGISTRATION_CAPABILITY);
			for (const operationId of [
				"annotation:update",
				"annotation:remove",
				"annotation:remove-all"
			]) context.disposables.add(context.operations.register({
				id: operationId,
				mode: "mutation",
				conflictDomains: require_internal_operation_conflict_domains.PERSISTENT_OVERLAY_MUTATION_CONFLICT_DOMAINS,
				reentrancy: "reject"
			}));
			context.disposables.add(context.events.on("state:loaded", () => controller === null || controller === void 0 ? void 0 : controller.synchronizeRuntimePresentation()));
			controller = new AnnotationController(Object.freeze({
				...diagnostics,
				...fabric,
				...canvas,
				...render
			}), Object.freeze({
				...overlay,
				...registration
			}), options, state);
			context.capabilities.provide(ANNOTATION_CAPABILITY, controller, { version: ANNOTATION_CAPABILITY.version });
			context.capabilities.provide(ANNOTATION_AUTHORING_CAPABILITY, controller, {
				version: ANNOTATION_AUTHORING_CAPABILITY.version,
				requiredPermission: "fabric:objects"
			});
			return controller;
		},
		onImageLoaded() {
			controller === null || controller === void 0 || controller.synchronizeRuntimePresentation();
		},
		onImageCleared() {
			controller === null || controller === void 0 || controller.resetForImage();
		},
		onDispose() {
			controller === null || controller === void 0 || controller.dispose();
			controller = null;
		}
	});
}

//#endregion
Object.defineProperty(exports, 'ANNOTATION_AUTHORING_CAPABILITY', {
  enumerable: true,
  get: function () {
    return ANNOTATION_AUTHORING_CAPABILITY;
  }
});
Object.defineProperty(exports, 'ANNOTATION_CAPABILITY', {
  enumerable: true,
  get: function () {
    return ANNOTATION_CAPABILITY;
  }
});
Object.defineProperty(exports, 'AnnotationError', {
  enumerable: true,
  get: function () {
    return AnnotationError;
  }
});
Object.defineProperty(exports, 'AnnotationNotFoundError', {
  enumerable: true,
  get: function () {
    return AnnotationNotFoundError;
  }
});
Object.defineProperty(exports, 'AnnotationValidationError', {
  enumerable: true,
  get: function () {
    return AnnotationValidationError;
  }
});
Object.defineProperty(exports, 'annotationFoundationPlugin', {
  enumerable: true,
  get: function () {
    return annotationFoundationPlugin;
  }
});
Object.defineProperty(exports, 'annotationFoundationRef', {
  enumerable: true,
  get: function () {
    return annotationFoundationRef;
  }
});
//# sourceMappingURL=annotation-Drb-vPam.cjs.map