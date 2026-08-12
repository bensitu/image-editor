const require_plugin_identifier = require('./plugin-identifier-DhlVh5SQ.cjs');
const require_core_capabilities = require('./core-capabilities-DPdoMgAf.cjs');
const require_image_budget = require('./image-budget-fYafUuFf.cjs');
const require_sdk = require('./sdk-CkdOSZDn.cjs');
const require_abortable_promise = require('./abortable-promise-Cd-vToiC.cjs');
const require_overlay = require('./overlay-CK9dFJPW.cjs');
const require_internal_layer_placement = require('./internal-layer-placement-CP6C0Dc2.cjs');
const require_error = require('./error-MZMZBLzQ.cjs');

//#region dist/esm/plugins/crop/crop-errors.js
var CropError = class extends Error {
	constructor() {
		super(...arguments);
		Object.defineProperty(this, "name", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: "CropError"
		});
	}
};
var CropSessionError = class extends CropError {
	constructor() {
		super(...arguments);
		Object.defineProperty(this, "name", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: "CropSessionError"
		});
	}
};
var CropValidationError = class extends CropError {
	constructor() {
		super(...arguments);
		Object.defineProperty(this, "name", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: "CropValidationError"
		});
	}
};
var CropIntegrationError = class extends CropError {
	constructor() {
		super(...arguments);
		Object.defineProperty(this, "name", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: "CropIntegrationError"
		});
	}
};

//#endregion
//#region dist/esm/plugins/crop/crop-geometry.js
function normalizeCropRotation(value) {
	if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError("[ImageEditor] Crop rotation must be a finite number.");
	const normalized = (value % 360 + 360) % 360;
	return Math.abs(normalized - 360) < 1e-9 || Math.abs(normalized) < 1e-9 ? 0 : normalized;
}
function constrainCropRectToRotation(value, rotationDegrees, limits) {
	let rect = normalizeCropRect(value, limits);
	const rotation = normalizeCropRotation(rotationDegrees);
	if (rotation === 0) return rect;
	const radians = rotation * Math.PI / 180;
	const cosine = Math.abs(Math.cos(radians));
	const sine = Math.abs(Math.sin(radians));
	const rotatedWidth = rect.widthPx * cosine + rect.heightPx * sine;
	const rotatedHeight = rect.widthPx * sine + rect.heightPx * cosine;
	const scale = Math.min(1, limits.widthPx / Math.max(rotatedWidth, 1), limits.heightPx / Math.max(rotatedHeight, 1));
	if (scale < 1) {
		const widthPx = Math.max(limits.minimumWidthPx, Math.floor(rect.widthPx * scale));
		const heightPx = Math.max(limits.minimumHeightPx, Math.floor(rect.heightPx * scale));
		if (widthPx * cosine + heightPx * sine > limits.widthPx + 1e-6 || widthPx * sine + heightPx * cosine > limits.heightPx + 1e-6) throw new TypeError("[ImageEditor] Rotated Crop rectangle cannot satisfy the configured minimum.");
		const centerX = rect.leftPx + rect.widthPx / 2;
		const centerY = rect.topPx + rect.heightPx / 2;
		rect = normalizeCropRect({
			leftPx: Math.max(0, Math.min(limits.widthPx - widthPx, centerX - widthPx / 2)),
			topPx: Math.max(0, Math.min(limits.heightPx - heightPx, centerY - heightPx / 2)),
			widthPx,
			heightPx
		}, limits);
	}
	const extentX = (rect.widthPx * cosine + rect.heightPx * sine) / 2;
	const extentY = (rect.widthPx * sine + rect.heightPx * cosine) / 2;
	const centerX = Math.max(extentX, Math.min(limits.widthPx - extentX, rect.leftPx + rect.widthPx / 2));
	const centerY = Math.max(extentY, Math.min(limits.heightPx - extentY, rect.topPx + rect.heightPx / 2));
	return normalizeCropRect({
		leftPx: Math.max(0, Math.min(limits.widthPx - rect.widthPx, centerX - rect.widthPx / 2)),
		topPx: Math.max(0, Math.min(limits.heightPx - rect.heightPx, centerY - rect.heightPx / 2)),
		widthPx: rect.widthPx,
		heightPx: rect.heightPx
	}, limits);
}
function isRecord$3(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}
function assertFinitePositive(value, label) {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw new TypeError(`[ImageEditor] ${label} must be a finite positive number.`);
	return value;
}
function normalizeCropAspectRatio(value) {
	if (value === void 0 || value === null || value === "free") return null;
	let ratio;
	if (typeof value === "number") ratio = value;
	else if (typeof value === "string") {
		const match = /^([0-9]+(?:\.[0-9]+)?):([0-9]+(?:\.[0-9]+)?)$/.exec(value);
		if (!match) throw new TypeError("[ImageEditor] Crop aspect ratio string is invalid.");
		ratio = Number(match[1]) / Number(match[2]);
	} else if (isRecord$3(value)) {
		if (Object.keys(value).some((key) => key !== "width" && key !== "height")) throw new TypeError("[ImageEditor] Crop aspect ratio contains unknown keys.");
		ratio = assertFinitePositive(value.width, "Crop aspect ratio width") / assertFinitePositive(value.height, "Crop aspect ratio height");
	} else throw new TypeError("[ImageEditor] Crop aspect ratio is invalid.");
	if (!Number.isFinite(ratio) || ratio <= 0 || ratio < 1e-6 || ratio > 1e6) throw new TypeError("[ImageEditor] Crop aspect ratio must be finite and positive.");
	return ratio;
}
function assertImageBounds(bounds) {
	if (!Number.isSafeInteger(bounds.widthPx) || !Number.isSafeInteger(bounds.heightPx) || bounds.widthPx <= 0 || bounds.heightPx <= 0) throw new TypeError("[ImageEditor] Crop image bounds are invalid.");
}
function normalizeCropRect(value, limits) {
	assertImageBounds(limits);
	if (!Number.isSafeInteger(limits.minimumWidthPx) || !Number.isSafeInteger(limits.minimumHeightPx) || limits.minimumWidthPx <= 0 || limits.minimumHeightPx <= 0) throw new TypeError("[ImageEditor] Crop rect minimum dimensions are invalid.");
	if (!isRecord$3(value)) throw new TypeError("[ImageEditor] Crop rect must be an object.");
	const allowedKeys = /* @__PURE__ */ new Set([
		"leftPx",
		"topPx",
		"widthPx",
		"heightPx"
	]);
	if (Object.keys(value).some((key) => !allowedKeys.has(key))) throw new TypeError("[ImageEditor] Crop rect contains unknown keys.");
	const left = value.leftPx;
	const top = value.topPx;
	const width = value.widthPx;
	const height = value.heightPx;
	if (typeof left !== "number" || typeof top !== "number" || typeof width !== "number" || typeof height !== "number" || !Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(width) || !Number.isFinite(height) || left < 0 || top < 0 || width <= 0 || height <= 0 || left + width > limits.widthPx || top + height > limits.heightPx) throw new TypeError("[ImageEditor] Crop rect must be finite and within image bounds.");
	const leftPx = Math.floor(left);
	const topPx = Math.floor(top);
	const rightPx = Math.min(limits.widthPx, Math.ceil(left + width));
	const bottomPx = Math.min(limits.heightPx, Math.ceil(top + height));
	const widthPx = rightPx - leftPx;
	const heightPx = bottomPx - topPx;
	if (widthPx < limits.minimumWidthPx || heightPx < limits.minimumHeightPx) throw new TypeError("[ImageEditor] Crop rect is smaller than the configured minimum.");
	return Object.freeze({
		leftPx,
		topPx,
		widthPx,
		heightPx
	});
}
function fitCropRectToAspectRatio(rect, ratio, bounds) {
	assertImageBounds(bounds);
	const normalizedRatio = normalizeCropAspectRatio(ratio);
	if (normalizedRatio === null) return Object.freeze({ ...rect });
	let width = rect.widthPx;
	let height = rect.heightPx;
	const currentRatio = width / height;
	const ratioMatches = Number.isFinite(currentRatio) && Math.abs(currentRatio - normalizedRatio) <= Math.max(1, normalizedRatio) * 1e-9;
	if (!ratioMatches && currentRatio > normalizedRatio) width = height * normalizedRatio;
	else if (!ratioMatches) height = width / normalizedRatio;
	const centerX = rect.leftPx + rect.widthPx / 2;
	const centerY = rect.topPx + rect.heightPx / 2;
	return normalizeCropRect({
		leftPx: Math.max(0, Math.min(bounds.widthPx - width, centerX - width / 2)),
		topPx: Math.max(0, Math.min(bounds.heightPx - height, centerY - height / 2)),
		widthPx: width,
		heightPx: height
	}, {
		...bounds,
		minimumWidthPx: 1,
		minimumHeightPx: 1
	});
}

//#endregion
//#region dist/esm/plugins/crop/crop-overlay-policy.js
const DEFAULT_OVERLAY_POLICY = Object.freeze({
	preview: "keep",
	apply: "keep"
});
function intersectConvexPolygons(left, right) {
	if (left.length < 3 || right.length < 3) return false;
	for (const polygon of [left, right]) for (let index = 0; index < polygon.length; index += 1) {
		const start = polygon[index];
		const end = polygon[(index + 1) % polygon.length];
		if (!start || !end) return false;
		const axisX = -(end.y - start.y);
		const axisY = end.x - start.x;
		if (!Number.isFinite(axisX) || !Number.isFinite(axisY)) return false;
		let leftMinimum = Number.POSITIVE_INFINITY;
		let leftMaximum = Number.NEGATIVE_INFINITY;
		let rightMinimum = Number.POSITIVE_INFINITY;
		let rightMaximum = Number.NEGATIVE_INFINITY;
		for (const point of left) {
			const projection = point.x * axisX + point.y * axisY;
			leftMinimum = Math.min(leftMinimum, projection);
			leftMaximum = Math.max(leftMaximum, projection);
		}
		for (const point of right) {
			const projection = point.x * axisX + point.y * axisY;
			rightMinimum = Math.min(rightMinimum, projection);
			rightMaximum = Math.max(rightMaximum, projection);
		}
		if (leftMaximum <= rightMinimum || rightMaximum <= leftMinimum) return false;
	}
	return true;
}
function isRecord$2(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}
function normalizeCropOverlayPolicy(value) {
	if (value === void 0) return DEFAULT_OVERLAY_POLICY;
	if (!isRecord$2(value)) throw new CropValidationError("Crop overlay policy must be an object.");
	const allowedKeys = /* @__PURE__ */ new Set([
		"preview",
		"apply",
		"kinds"
	]);
	if (Object.keys(value).some((key) => !allowedKeys.has(key))) throw new CropValidationError("Crop overlay policy contains unknown keys.");
	const preview = value.preview;
	const apply = value.apply;
	if (preview !== "keep" && preview !== "hide-participating") throw new CropValidationError("Crop overlay preview policy is invalid.");
	if (apply !== "keep" && apply !== "discard" && apply !== "transform-intersecting") throw new CropValidationError("Crop overlay apply policy is invalid.");
	let kinds;
	if (value.kinds !== void 0) {
		if (!Array.isArray(value.kinds) || value.kinds.length > 64 || value.kinds.some((kind) => typeof kind !== "string" || kind.length === 0 || kind.trim() !== kind || kind.length > 128)) throw new CropValidationError("Crop overlay kinds are invalid.");
		kinds = Object.freeze([...new Set(value.kinds)]);
	}
	return Object.freeze({
		preview,
		apply,
		...kinds ? { kinds } : {}
	});
}
function findCropOverlayCandidates(overlay, cropPreview, policy) {
	if (!overlay) return Object.freeze({
		allIds: Object.freeze([]),
		intersectingIds: Object.freeze([])
	});
	const objects = overlay.list({
		...policy.kinds ? { kinds: policy.kinds } : {},
		includeHidden: true,
		includeLocked: true
	});
	const allIds = [];
	const intersectingIds = [];
	for (const object of objects) {
		const classification = overlay.classify(object);
		if (!classification) continue;
		allIds.push(classification.persistentId);
		if (intersectConvexPolygons(cropPreview.getCoords(), object.getCoords())) intersectingIds.push(classification.persistentId);
	}
	return Object.freeze({
		allIds: Object.freeze(allIds),
		intersectingIds: Object.freeze(intersectingIds)
	});
}
async function applyCropOverlayPolicy(overlay, canvas, parent, policy, candidates, mutationId) {
	if (!overlay || policy.apply === "keep") return;
	const retained = new Set(candidates.intersectingIds);
	const removeIds = policy.apply === "discard" ? candidates.allIds : candidates.allIds.filter((id) => !retained.has(id));
	if (removeIds.length === 0) return;
	await overlay.mutate({
		id: `${mutationId}:overlay`,
		operationId: "crop:apply",
		action: "delete",
		objectIds: removeIds,
		parent,
		metadata: Object.freeze({ cropPolicy: policy.apply }),
		mutate: () => {
			for (const id of removeIds) {
				const object = overlay.getByPersistentId(id);
				if (object) canvas.remove(object);
			}
		}
	});
}

//#endregion
//#region dist/esm/plugins/crop/crop-renderer.js
function isRecord$1(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}
function normalizeCropApplyOptions(value, sourceMimeType) {
	var _a;
	if (value !== void 0 && !isRecord$1(value)) throw new CropValidationError("Crop apply options must be an object.");
	const record = value !== null && value !== void 0 ? value : {};
	const allowedKeys = /* @__PURE__ */ new Set([
		"format",
		"quality",
		"bakeVisibleFilters"
	]);
	if (Object.keys(record).some((key) => !allowedKeys.has(key))) throw new CropValidationError("Crop apply options contain unknown keys.");
	const sourceFormat = sourceMimeType === "image/jpeg" ? "jpeg" : sourceMimeType === "image/webp" ? "webp" : "png";
	const format = (_a = record.format) !== null && _a !== void 0 ? _a : sourceFormat;
	if (format !== "png" && format !== "jpeg" && format !== "webp") throw new CropValidationError("Crop output format must be png, jpeg, or webp.");
	const quality = record.quality;
	if (quality !== void 0 && (typeof quality !== "number" || !Number.isFinite(quality) || quality < 0 || quality > 1)) throw new CropValidationError("Crop output quality must be within [0, 1].");
	if (record.bakeVisibleFilters !== void 0 && typeof record.bakeVisibleFilters !== "boolean") throw new CropValidationError("bakeVisibleFilters must be a boolean.");
	return Object.freeze({
		format,
		...format !== "png" && quality !== void 0 ? { quality } : {},
		mimeType: format === "jpeg" ? "image/jpeg" : `image/${format}`,
		bakeVisibleFilters: record.bakeVisibleFilters !== false
	});
}
function encodedBytes(dataUrl, expectedMimeType) {
	const commaIndex = dataUrl.indexOf(",");
	if (commaIndex < 0 || !/;base64$/i.test(dataUrl.slice(0, commaIndex))) throw new CropValidationError("Crop output is not a base64 Data URL.");
	const mimeType = dataUrl.slice(5, dataUrl.indexOf(";"));
	if (mimeType !== expectedMimeType) throw new CropValidationError(`Crop encoder returned ${mimeType || "an unknown MIME"} instead of ${expectedMimeType}.`);
	const payload = dataUrl.slice(commaIndex + 1);
	try {
		return require_error.base64PayloadByteLength(payload);
	} catch {
		throw new CropValidationError("Crop output contains a malformed base64 payload.");
	}
}
async function decodeCropImage(fabric, dataUrl, timeoutMs, signal) {
	var _a;
	const controller = new AbortController();
	const abort = () => controller.abort(signal.reason);
	signal.addEventListener("abort", abort, { once: true });
	if (signal.aborted) abort();
	const timeout = setTimeout(() => controller.abort(new CropValidationError("Crop decode timed out.")), timeoutMs);
	try {
		return await require_abortable_promise.settleAbortable(fabric.FabricImage.fromURL(dataUrl, {
			crossOrigin: "anonymous",
			signal: controller.signal
		}), controller.signal, (lateImage) => lateImage.dispose());
	} catch (error) {
		if (controller.signal.aborted) throw (_a = controller.signal.reason) !== null && _a !== void 0 ? _a : error;
		throw new CropValidationError("Crop decode failed.");
	} finally {
		clearTimeout(timeout);
		signal.removeEventListener("abort", abort);
	}
}
function applyCropPresentation(source, target, rect, rotationDegrees) {
	const matrix = source.calcTransformMatrix();
	const offsetX = rect.leftPx + rect.widthPx / 2 - Number(source.width) / 2;
	const offsetY = rect.topPx + rect.heightPx / 2 - Number(source.height) / 2;
	const centerX = matrix[0] * offsetX + matrix[2] * offsetY + matrix[4];
	const centerY = matrix[1] * offsetX + matrix[3] * offsetY + matrix[5];
	target.set({
		left: centerX,
		top: centerY,
		originX: "center",
		originY: "center",
		scaleX: source.scaleX,
		scaleY: source.scaleY,
		angle: (Number(source.angle) || 0) + rotationDegrees,
		skewX: source.skewX,
		skewY: source.skewY,
		flipX: source.flipX,
		flipY: source.flipY,
		opacity: source.opacity,
		visible: source.visible,
		selectable: false,
		evented: false,
		hasControls: false,
		hoverCursor: source.hoverCursor,
		excludeFromExport: source.excludeFromExport,
		backgroundColor: source.backgroundColor
	});
	target.setCoords();
}
async function renderCropImage(host, source, rect, rotationDegrees, options, signal) {
	var _a, _b;
	if (signal.aborted) throw signal.reason;
	const policy = host.getImageResourcePolicy();
	const pixelBudget = Math.min(policy.maxInputPixels, policy.maxExportPixels);
	if (rect.widthPx > policy.maxExportDimension || rect.heightPx > policy.maxExportDimension || !require_image_budget.isPixelAreaWithinBudget(rect.widthPx, rect.heightPx, pixelBudget)) throw new CropValidationError("Crop dimensions exceed the Core resource policy.");
	const ownerDocument = (_a = source.getElement().ownerDocument) !== null && _a !== void 0 ? _a : globalThis.document;
	if (!ownerDocument) throw new CropValidationError("Crop rendering document is unavailable.");
	const surface = ownerDocument.createElement("canvas");
	surface.width = rect.widthPx;
	surface.height = rect.heightPx;
	const context = surface.getContext("2d");
	if (!context) throw new CropValidationError("Crop rendering context is unavailable.");
	let dataUrl;
	try {
		const rotation = normalizeCropRotation(rotationDegrees);
		context.translate(rect.widthPx / 2, rect.heightPx / 2);
		context.rotate(-rotation * Math.PI / 180);
		context.translate(-(rect.leftPx + rect.widthPx / 2), -(rect.topPx + rect.heightPx / 2));
		context.drawImage(source.getElement(), 0, 0, Number(source.width), Number(source.height));
		if (signal.aborted) throw signal.reason;
		dataUrl = surface.toDataURL(options.mimeType, options.format === "png" ? void 0 : options.quality);
	} catch (error) {
		if (signal.aborted) throw (_b = signal.reason) !== null && _b !== void 0 ? _b : error;
		if (require_error.hasErrorName(error, "SecurityError")) throw new CropValidationError("Crop pixels cannot be exported because canvas access is blocked.");
		throw error;
	}
	if (encodedBytes(dataUrl, options.mimeType) > policy.maxInputBytes) throw new CropValidationError("Crop output exceeds the Core input budget.");
	const image = await decodeCropImage(host.fabric, dataUrl, policy.imageLoadTimeoutMs, signal);
	try {
		if (image.width !== rect.widthPx || image.height !== rect.heightPx) throw new CropValidationError("Crop dimensions changed during decode.");
		applyCropPresentation(source, image, rect, normalizeCropRotation(rotationDegrees));
		return Object.freeze({
			image,
			mimeType: options.mimeType
		});
	} catch (error) {
		image.dispose();
		throw error;
	}
}

//#endregion
//#region dist/esm/plugins/crop/crop-controller.js
const EMPTY_CANDIDATES = Object.freeze({
	allIds: Object.freeze([]),
	intersectingIds: Object.freeze([])
});
function positiveSafeInteger(value, fallback, label) {
	if (value === void 0) return fallback;
	if (!Number.isSafeInteger(value) || Number(value) <= 0) throw new CropValidationError(`${label} must be a positive safe integer.`);
	return Number(value);
}
function nonNegativeSafeInteger(value, fallback, label) {
	if (value === void 0) return fallback;
	if (!Number.isSafeInteger(value) || Number(value) < 0) throw new CropValidationError(`${label} must be a non-negative safe integer.`);
	return Number(value);
}
function resolveCropConfiguration(options) {
	if (typeof options !== "object" || options === null || Array.isArray(options)) throw new CropValidationError("Crop Plugin options must be an object.");
	const allowedKeys = /* @__PURE__ */ new Set([
		"paddingPx",
		"minimumWidthPx",
		"minimumHeightPx",
		"rotatable"
	]);
	if (Object.keys(options).some((key) => !allowedKeys.has(key))) throw new CropValidationError("Crop Plugin options contain unknown keys.");
	if (options.rotatable !== void 0 && typeof options.rotatable !== "boolean") throw new CropValidationError("Crop rotatable must be a boolean.");
	return Object.freeze({
		paddingPx: nonNegativeSafeInteger(options.paddingPx, 10, "Crop paddingPx"),
		minimumWidthPx: positiveSafeInteger(options.minimumWidthPx, 1, "Crop minimumWidthPx"),
		minimumHeightPx: positiveSafeInteger(options.minimumHeightPx, 1, "Crop minimumHeightPx"),
		rotatable: options.rotatable === true
	});
}
function cloneSessionState(state) {
	return Object.freeze({
		...state,
		rect: Object.freeze({ ...state.rect }),
		overlayPolicy: Object.freeze({
			...state.overlayPolicy,
			...state.overlayPolicy.kinds ? { kinds: Object.freeze([...state.overlayPolicy.kinds]) } : {}
		})
	});
}
function isRecord(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}
function clamp(value, minimum, maximum) {
	return Math.max(minimum, Math.min(maximum, value));
}
function cropRectsMatch(left, right) {
	return left.leftPx === right.leftPx && left.topPx === right.topPx && left.widthPx === right.widthPx && left.heightPx === right.heightPx;
}
function cropRotationsMatch(left, right) {
	const difference = Math.abs(normalizeCropRotation(left) - normalizeCropRotation(right));
	return Math.min(difference, 360 - difference) < 1e-6;
}
var CropController = class {
	constructor(host, geometry, raster, overlay, visibleRasterBake, visibleRasterBakeStatus, configuration) {
		Object.defineProperty(this, "host", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: host
		});
		Object.defineProperty(this, "geometry", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: geometry
		});
		Object.defineProperty(this, "raster", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: raster
		});
		Object.defineProperty(this, "overlay", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: overlay
		});
		Object.defineProperty(this, "visibleRasterBake", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: visibleRasterBake
		});
		Object.defineProperty(this, "visibleRasterBakeStatus", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: visibleRasterBakeStatus
		});
		Object.defineProperty(this, "configuration", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: configuration
		});
		Object.defineProperty(this, "session", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: null
		});
		Object.defineProperty(this, "listeners", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Set()
		});
		Object.defineProperty(this, "mutationSequence", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: 0
		});
		Object.defineProperty(this, "disposed", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: false
		});
	}
	get isActive() {
		return this.session !== null;
	}
	getSession() {
		this.assertActive("read the Crop session");
		return this.session ? cloneSessionState(this.session.state) : null;
	}
	subscribe(listener) {
		this.assertActive("subscribe to Crop status");
		if (typeof listener !== "function") throw new TypeError("[ImageEditor] Crop status listener must be a function.");
		this.listeners.add(listener);
		return require_core_capabilities.createDisposable(() => {
			this.listeners.delete(listener);
		});
	}
	enter(options = {}) {
		var _a, _b, _c, _d;
		this.assertActive("enter Crop");
		if (this.session) throw new CropSessionError("Crop is already active.");
		if (!this.host.isImageLoaded()) throw new CropSessionError("Crop requires a loaded image.");
		if (!isRecord(options)) throw new CropValidationError("Crop enter options must be an object.");
		const allowedKeys = /* @__PURE__ */ new Set([
			"rect",
			"aspectRatio",
			"rotationDegrees",
			"overlayPolicy"
		]);
		if (Object.keys(options).some((key) => !allowedKeys.has(key))) throw new CropValidationError("Crop enter options contain unknown keys.");
		const baseImage = this.requireBaseImage();
		const widthPx = Number(baseImage.width);
		const heightPx = Number(baseImage.height);
		if (!Number.isSafeInteger(widthPx) || !Number.isSafeInteger(heightPx) || widthPx <= 0 || heightPx <= 0) throw new CropValidationError("Base Image dimensions are invalid for Crop.");
		if (this.configuration.minimumWidthPx > widthPx || this.configuration.minimumHeightPx > heightPx) throw new CropValidationError("Crop minimum dimensions exceed the Base Image.");
		const limits = {
			widthPx,
			heightPx,
			minimumWidthPx: this.configuration.minimumWidthPx,
			minimumHeightPx: this.configuration.minimumHeightPx
		};
		const padding = Math.min(this.configuration.paddingPx, Math.floor((widthPx - this.configuration.minimumWidthPx) / 2), Math.floor((heightPx - this.configuration.minimumHeightPx) / 2));
		const aspectRatio = normalizeCropAspectRatio(options.aspectRatio);
		const rotationDegrees = normalizeCropRotation((_a = options.rotationDegrees) !== null && _a !== void 0 ? _a : 0);
		if (!this.configuration.rotatable && rotationDegrees !== 0) throw new CropValidationError("Crop rectangle rotation is disabled.");
		let rect = normalizeCropRect((_b = options.rect) !== null && _b !== void 0 ? _b : {
			leftPx: padding,
			topPx: padding,
			widthPx: widthPx - padding * 2,
			heightPx: heightPx - padding * 2
		}, limits);
		if (aspectRatio !== null) rect = normalizeCropRect(fitCropRectToAspectRatio(rect, aspectRatio, {
			widthPx,
			heightPx
		}), limits);
		rect = constrainCropRectToRotation(rect, rotationDegrees, limits);
		const overlayPolicy = normalizeCropOverlayPolicy(options.overlayPolicy);
		const preview = this.createPreview(baseImage, rect, rotationDegrees);
		const canvas = this.host.requireCanvas("enter Crop");
		require_internal_layer_placement.markSessionObject(preview, "cropRect");
		require_internal_layer_placement.placeSessionObject(canvas, preview);
		const state = Object.freeze({
			rect,
			aspectRatio,
			rotationDegrees,
			sourceRevision: this.host.getGeometryRevision(),
			sourceWidthPx: widthPx,
			sourceHeightPx: heightPx,
			overlayPolicy
		});
		this.session = {
			state,
			preview,
			previewInteraction: null,
			previewVisibility: null,
			candidates: EMPTY_CANDIDATES,
			selectionIds: (_d = (_c = this.overlay) === null || _c === void 0 ? void 0 : _c.getSelection().ids) !== null && _d !== void 0 ? _d : Object.freeze([]),
			synchronizingPreview: false
		};
		this.session.previewInteraction = this.bindPreviewInteraction(this.session);
		this.refreshPreview(this.session);
		canvas.setActiveObject(preview);
		this.host.requestRender();
		this.emitStatus();
	}
	updateRect(value) {
		const session = this.requireSession("update the Crop rect");
		this.assertSourceCurrent(session);
		const limits = this.limits(session);
		let rect = normalizeCropRect(value, limits);
		if (session.state.aspectRatio !== null) rect = normalizeCropRect(fitCropRectToAspectRatio(rect, session.state.aspectRatio, {
			widthPx: session.state.sourceWidthPx,
			heightPx: session.state.sourceHeightPx
		}), limits);
		rect = constrainCropRectToRotation(rect, session.state.rotationDegrees, limits);
		session.state = Object.freeze({
			...session.state,
			rect
		});
		this.refreshPreview(session);
		this.emitStatus();
	}
	setAspectRatio(value) {
		const session = this.requireSession("set the Crop aspect ratio");
		this.assertSourceCurrent(session);
		const aspectRatio = normalizeCropAspectRatio(value);
		let rect = session.state.rect;
		if (aspectRatio !== null) rect = normalizeCropRect(fitCropRectToAspectRatio(rect, aspectRatio, {
			widthPx: session.state.sourceWidthPx,
			heightPx: session.state.sourceHeightPx
		}), this.limits(session));
		rect = constrainCropRectToRotation(rect, session.state.rotationDegrees, this.limits(session));
		session.state = Object.freeze({
			...session.state,
			rect,
			aspectRatio
		});
		this.refreshPreview(session);
		this.emitStatus();
	}
	setRotation(value) {
		const session = this.requireSession("set the Crop rotation");
		this.assertSourceCurrent(session);
		const rotationDegrees = normalizeCropRotation(value);
		if (!this.configuration.rotatable && rotationDegrees !== 0) throw new CropValidationError("Crop rectangle rotation is disabled.");
		const rect = constrainCropRectToRotation(session.state.rect, rotationDegrees, this.limits(session));
		session.state = Object.freeze({
			...session.state,
			rect,
			rotationDegrees
		});
		this.refreshPreview(session);
		this.emitStatus();
	}
	cancel() {
		this.assertActive("cancel Crop");
		if (!this.session) return;
		this.closeSession(true);
	}
	async apply(options) {
		var _a, _b;
		const session = this.requireSession("apply Crop");
		this.assertSourceCurrent(session);
		const normalizedOptions = normalizeCropApplyOptions(options, (_b = (_a = this.host.getImageInfo()) === null || _a === void 0 ? void 0 : _a.mimeType) !== null && _b !== void 0 ? _b : null);
		const rect = session.state.rect;
		const candidates = findCropOverlayCandidates(this.overlay, session.preview, session.state.overlayPolicy);
		const state = session.state;
		const selectionIds = session.selectionIds;
		this.closeSession(true);
		const mutationId = `crop:apply:${++this.mutationSequence}`;
		const resources = {
			replacement: null,
			replacedSource: null
		};
		let committed = false;
		try {
			await this.geometry.run({
				id: mutationId,
				kind: "crop",
				operationId: "crop:apply",
				sourceRect: {
					left: rect.leftPx,
					top: rect.topPx,
					width: rect.widthPx,
					height: rect.heightPx
				},
				targetSize: {
					width: rect.widthPx,
					height: rect.heightPx
				},
				metadata: Object.freeze({
					sourceRevision: state.sourceRevision,
					rotationDegrees: state.rotationDegrees,
					overlayPolicy: state.overlayPolicy.apply,
					bakeVisibleFilters: normalizedOptions.bakeVisibleFilters
				}),
				mutateBase: async ({ transaction, signal }) => {
					var _a;
					if (normalizedOptions.bakeVisibleFilters && this.visibleRasterBakeStatus === "incompatible") throw new CropIntegrationError("The installed visible-raster bake provider is incompatible.");
					if (normalizedOptions.bakeVisibleFilters && ((_a = this.visibleRasterBake) === null || _a === void 0 ? void 0 : _a.hasVisibleState())) await this.visibleRasterBake.bakeIntoBase(transaction);
					this.assertSourceDimensions(state);
					const source = this.requireBaseImage();
					const rendered = await renderCropImage(this.host, source, rect, state.rotationDegrees, normalizedOptions, signal);
					resources.replacement = rendered.image;
					resources.replacedSource = source;
					this.raster.replaceBaseImage(transaction, rendered.image, {
						baseScale: this.host.getBaseImageScale(),
						mimeType: rendered.mimeType
					});
					await applyCropOverlayPolicy(this.overlay, this.host.requireCanvas("apply Crop overlay policy"), transaction, state.overlayPolicy, candidates, mutationId);
					if (this.overlay) this.overlay.select(selectionIds.filter((id) => {
						var _a;
						return ((_a = this.overlay) === null || _a === void 0 ? void 0 : _a.getByPersistentId(id)) !== null;
					}));
					this.validateBaseImage(rendered.image, rect);
				}
			});
			committed = true;
			if (resources.replacedSource && resources.replacedSource !== this.host.getBaseImage()) resources.replacedSource.dispose();
		} finally {
			if (!committed && resources.replacement && this.host.getBaseImage() !== resources.replacement) resources.replacement.dispose();
		}
	}
	ownsPreview(object) {
		var _a;
		return ((_a = this.session) === null || _a === void 0 ? void 0 : _a.preview) === object;
	}
	closeForImage() {
		if (this.session) this.closeSession(false);
	}
	dispose() {
		if (this.disposed) return;
		if (this.session) this.closeSession(false);
		this.listeners.clear();
		this.disposed = true;
	}
	createPreview(baseImage, rect, rotationDegrees) {
		const preview = new this.host.fabric.Rect({
			width: rect.widthPx,
			height: rect.heightPx,
			originX: "center",
			originY: "center",
			fill: "rgba(0, 170, 255, 0.08)",
			stroke: "#00aaff",
			strokeWidth: 1,
			strokeDashArray: [6, 4],
			strokeUniform: true,
			selectable: true,
			evented: true,
			hasControls: true,
			lockRotation: !this.configuration.rotatable,
			lockScalingFlip: true,
			lockSkewingX: true,
			lockSkewingY: true,
			transparentCorners: false,
			cornerColor: "#ffffff",
			cornerStrokeColor: "#00aaff",
			borderColor: "#00aaff",
			cornerSize: 12,
			touchCornerSize: 24,
			hoverCursor: "move",
			excludeFromExport: true
		});
		preview.setControlVisible("mtr", this.configuration.rotatable);
		this.applyPreviewPresentation(baseImage, preview, rect, rotationDegrees);
		return preview;
	}
	applyPreviewPresentation(baseImage, preview, rect, rotationDegrees) {
		var _a;
		const matrix = baseImage.calcTransformMatrix();
		const offsetX = rect.leftPx + rect.widthPx / 2 - Number(baseImage.width) / 2;
		const offsetY = rect.topPx + rect.heightPx / 2 - Number(baseImage.height) / 2;
		preview.set({
			left: matrix[0] * offsetX + matrix[2] * offsetY + matrix[4],
			top: matrix[1] * offsetX + matrix[3] * offsetY + matrix[5],
			width: rect.widthPx,
			height: rect.heightPx,
			scaleX: baseImage.scaleX,
			scaleY: baseImage.scaleY,
			angle: (Number(baseImage.angle) || 0) + rotationDegrees,
			skewX: baseImage.skewX,
			skewY: baseImage.skewY,
			flipX: baseImage.flipX,
			flipY: baseImage.flipY
		});
		const freeAspectRatio = ((_a = this.session) === null || _a === void 0 ? void 0 : _a.state.aspectRatio) === null;
		preview.setControlsVisibility({
			ml: freeAspectRatio,
			mt: freeAspectRatio,
			mr: freeAspectRatio,
			mb: freeAspectRatio,
			mtr: this.configuration.rotatable
		});
		preview.setCoords();
	}
	bindPreviewInteraction(session) {
		const synchronizeLive = () => this.synchronizePreview(session, false);
		const synchronizeFinal = () => this.synchronizePreview(session, true);
		const stopMoving = session.preview.on("moving", synchronizeLive);
		const stopScaling = session.preview.on("scaling", synchronizeLive);
		const stopRotating = session.preview.on("rotating", synchronizeLive);
		const stopModified = session.preview.on("modified", synchronizeFinal);
		return require_core_capabilities.createDisposable(() => {
			stopModified();
			stopRotating();
			stopScaling();
			stopMoving();
		});
	}
	synchronizePreview(session, finalize) {
		if (this.session !== session || session.synchronizingPreview) return;
		session.synchronizingPreview = true;
		try {
			const value = this.readPreviewState(session);
			const changed = !cropRectsMatch(value.rect, session.state.rect) || !cropRotationsMatch(value.rotationDegrees, session.state.rotationDegrees);
			if (changed) session.state = Object.freeze({
				...session.state,
				...value
			});
			if (finalize) this.refreshPreview(session);
			else this.host.requestRender();
			if (changed) this.emitStatus();
		} catch (error) {
			this.host.reportWarning(error, "Crop could not synchronize its interactive preview.");
			this.refreshPreview(session);
		} finally {
			session.synchronizingPreview = false;
		}
	}
	readPreviewState(session) {
		const baseImage = this.requireBaseImage();
		const relativeMatrix = this.host.fabric.util.multiplyTransformMatrices(this.host.fabric.util.invertTransform(baseImage.calcTransformMatrix()), session.preview.calcTransformMatrix());
		const scaleX = Math.hypot(relativeMatrix[0], relativeMatrix[1]);
		const determinant = relativeMatrix[0] * relativeMatrix[3] - relativeMatrix[1] * relativeMatrix[2];
		const scaleY = scaleX > 0 ? Math.abs(determinant / scaleX) : 0;
		const width = Number(session.preview.width) * scaleX;
		const height = Number(session.preview.height) * scaleY;
		const centerX = relativeMatrix[4] + session.state.sourceWidthPx / 2;
		const centerY = relativeMatrix[5] + session.state.sourceHeightPx / 2;
		const rotationDegrees = normalizeCropRotation(Math.atan2(relativeMatrix[1], relativeMatrix[0]) * 180 / Math.PI);
		if (![
			centerX,
			centerY,
			width,
			height,
			rotationDegrees
		].every(Number.isFinite)) throw new CropValidationError("Interactive Crop geometry is invalid.");
		const rect = this.constrainPreviewRect(session, {
			leftPx: centerX - width / 2,
			topPx: centerY - height / 2,
			widthPx: width,
			heightPx: height
		}, rotationDegrees);
		return Object.freeze({
			rect,
			rotationDegrees
		});
	}
	constrainPreviewRect(session, value, rotationDegrees) {
		const limits = this.limits(session);
		const width = clamp(Math.abs(value.widthPx), limits.minimumWidthPx, limits.widthPx);
		const height = clamp(Math.abs(value.heightPx), limits.minimumHeightPx, limits.heightPx);
		const centerX = value.leftPx + value.widthPx / 2;
		const centerY = value.topPx + value.heightPx / 2;
		let rect = normalizeCropRect({
			leftPx: clamp(centerX - width / 2, 0, limits.widthPx - width),
			topPx: clamp(centerY - height / 2, 0, limits.heightPx - height),
			widthPx: width,
			heightPx: height
		}, limits);
		if (session.state.aspectRatio !== null) rect = normalizeCropRect(fitCropRectToAspectRatio(rect, session.state.aspectRatio, {
			widthPx: session.state.sourceWidthPx,
			heightPx: session.state.sourceHeightPx
		}), limits);
		return constrainCropRectToRotation(rect, rotationDegrees, limits);
	}
	refreshPreview(session) {
		const baseImage = this.requireBaseImage();
		this.applyPreviewPresentation(baseImage, session.preview, session.state.rect, session.state.rotationDegrees);
		const canvas = this.host.requireCanvas("refresh Crop preview");
		require_internal_layer_placement.placeSessionObject(canvas, session.preview);
		if (session.previewVisibility) require_core_capabilities.observePromise(Promise.resolve(session.previewVisibility.dispose()), (error) => {
			this.host.reportWarning(error, "Crop preview visibility cleanup failed.");
		});
		session.previewVisibility = null;
		session.candidates = findCropOverlayCandidates(this.overlay, session.preview, session.state.overlayPolicy);
		if (this.overlay && session.state.overlayPolicy.preview === "hide-participating" && session.candidates.intersectingIds.length > 0) session.previewVisibility = this.overlay.hideForPreview(session.candidates.intersectingIds);
		this.host.requestRender();
	}
	closeSession(restoreSelection) {
		const session = this.session;
		if (!session) return;
		this.session = null;
		if (session.previewInteraction) {
			try {
				require_core_capabilities.observePromise(Promise.resolve(session.previewInteraction.dispose()), (error) => {
					this.host.reportWarning(error, "Crop preview interaction cleanup failed.");
				});
			} catch (error) {
				this.host.reportWarning(error, "Crop preview interaction cleanup failed.");
			}
			session.previewInteraction = null;
		}
		if (session.previewVisibility) require_core_capabilities.observePromise(Promise.resolve(session.previewVisibility.dispose()), (error) => {
			this.host.reportWarning(error, "Crop preview visibility cleanup failed.");
		});
		const canvas = this.host.getCanvas();
		if (canvas === null || canvas === void 0 ? void 0 : canvas.getActiveObjects().includes(session.preview)) canvas.discardActiveObject();
		if (canvas === null || canvas === void 0 ? void 0 : canvas.getObjects().includes(session.preview)) canvas.remove(session.preview);
		session.preview.dispose();
		if (restoreSelection && this.overlay) try {
			const liveIds = session.selectionIds.filter((id) => {
				var _a;
				return ((_a = this.overlay) === null || _a === void 0 ? void 0 : _a.getByPersistentId(id)) !== null;
			});
			this.overlay.select(liveIds);
		} catch (error) {
			this.host.reportWarning(error, "Crop could not restore the Overlay selection.");
		}
		this.host.requestRender();
		this.emitStatus();
	}
	requireSession(operation) {
		this.assertActive(operation);
		if (!this.session) throw new CropSessionError(`Cannot ${operation} without an active Crop.`);
		return this.session;
	}
	requireBaseImage() {
		const baseImage = this.host.getBaseImage();
		if (!baseImage) throw new CropSessionError("Crop requires a loaded image.");
		return baseImage;
	}
	assertSourceCurrent(session) {
		if (!this.host.isImageLoaded() || this.host.getGeometryRevision() !== session.state.sourceRevision) throw new CropSessionError("Crop source revision is stale.");
		this.assertSourceDimensions(session.state);
	}
	assertSourceDimensions(state) {
		const baseImage = this.requireBaseImage();
		if (Number(baseImage.width) !== state.sourceWidthPx || Number(baseImage.height) !== state.sourceHeightPx) throw new CropSessionError("Crop source dimensions changed during the session.");
	}
	limits(session) {
		return {
			widthPx: session.state.sourceWidthPx,
			heightPx: session.state.sourceHeightPx,
			minimumWidthPx: this.configuration.minimumWidthPx,
			minimumHeightPx: this.configuration.minimumHeightPx
		};
	}
	validateBaseImage(image, rect) {
		const canvas = this.host.requireCanvas("validate Crop");
		const baseImages = canvas.getObjects().filter((object) => object.editorObjectKind === "baseImage");
		if (this.host.getBaseImage() !== image || baseImages.length !== 1 || baseImages[0] !== image || canvas.getObjects()[0] !== image || image.width !== rect.widthPx || image.height !== rect.heightPx || image.selectable !== false || image.evented !== false) throw new CropValidationError("Crop violated the Base Image invariant.");
	}
	status() {
		return Object.freeze({
			isActive: this.isActive,
			session: this.session ? cloneSessionState(this.session.state) : null
		});
	}
	emitStatus() {
		if (this.disposed || this.listeners.size === 0) return;
		const status = this.status();
		for (const listener of [...this.listeners]) try {
			listener(status);
		} catch (error) {
			this.host.reportWarning(error, "A Crop status listener failed.");
		}
	}
	assertActive(operation) {
		if (this.disposed || this.host.isDisposed()) throw new CropSessionError(`Cannot ${operation} after Crop disposal.`);
	}
};

//#endregion
//#region dist/esm/plugins/crop/index.js
const CROP_TOOL_ID = "plugin:crop";
const cropPreviewDomains = [
	"base-image",
	"overlay",
	"selection",
	"state"
];
const cropMutationDomains = [
	"document",
	"base-image",
	"geometry",
	"raster",
	"overlay",
	"selection",
	"state"
];
const cropPluginRef = require_core_capabilities.definePluginRef("plugin:crop", "1.0.0");
function cropPlugin(options = {}) {
	const configuration = resolveCropConfiguration(options);
	let controller = null;
	return require_sdk.definePlugin({
		ref: cropPluginRef,
		manifest: {
			id: cropPluginRef.id,
			version: "1.0.0",
			apiVersion: cropPluginRef.apiVersion,
			engine: "^3.0.0",
			requires: [
				{
					token: require_core_capabilities.CORE_STATUS_CAPABILITY,
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
					token: require_core_capabilities.BASE_IMAGE_READ_CAPABILITY,
					range: "^1.0.0"
				},
				{
					token: require_core_capabilities.IMAGE_RESOURCE_POLICY_CAPABILITY,
					range: "^1.0.0"
				},
				{
					token: require_core_capabilities.RENDER_REQUEST_CAPABILITY,
					range: "^1.0.0"
				},
				{
					token: require_core_capabilities.RASTER_MUTATION_CAPABILITY,
					range: "^1.0.0"
				},
				{
					token: require_core_capabilities.SNAPSHOT_REGISTRATION_CAPABILITY,
					range: "^1.0.0"
				},
				{
					token: require_core_capabilities.GEOMETRY_MUTATION_CAPABILITY,
					range: "^1.0.0"
				}
			],
			optional: [{
				token: require_overlay.OVERLAY_CAPABILITY,
				range: "^1.0.0"
			}, {
				token: require_sdk.VISIBLE_RASTER_BAKE_CAPABILITY,
				range: "^1.0.0"
			}],
			permissions: [
				"fabric:objects",
				"fabric:canvas-read",
				"core:raster-mutation",
				"core:geometry-participant"
			]
		},
		setupMode: "sync",
		setup(context) {
			const status = context.capabilities.require(require_core_capabilities.CORE_STATUS_CAPABILITY);
			const diagnostics = context.capabilities.require(require_core_capabilities.CORE_DIAGNOSTICS_CAPABILITY);
			const fabricRuntime = context.capabilities.require(require_core_capabilities.FABRIC_RUNTIME_CAPABILITY);
			const canvas = context.capabilities.require(require_core_capabilities.CANVAS_READ_CAPABILITY);
			const baseImage = context.capabilities.require(require_core_capabilities.BASE_IMAGE_READ_CAPABILITY);
			const resourcePolicy = context.capabilities.require(require_core_capabilities.IMAGE_RESOURCE_POLICY_CAPABILITY);
			const render = context.capabilities.require(require_core_capabilities.RENDER_REQUEST_CAPABILITY);
			const raster = context.capabilities.require(require_core_capabilities.RASTER_MUTATION_CAPABILITY);
			const snapshots = context.capabilities.require(require_core_capabilities.SNAPSHOT_REGISTRATION_CAPABILITY);
			const geometry = context.capabilities.require(require_core_capabilities.GEOMETRY_MUTATION_CAPABILITY);
			const overlay = context.capabilities.optional(require_overlay.OVERLAY_CAPABILITY);
			const visibleRasterBake = context.capabilities.optional(require_sdk.VISIBLE_RASTER_BAKE_CAPABILITY);
			controller = new CropController(Object.freeze({
				...status,
				...diagnostics,
				...fabricRuntime,
				...canvas,
				...baseImage,
				...resourcePolicy,
				...render
			}), geometry, raster, overlay, visibleRasterBake, context.capabilities.getOptionalStatus(require_sdk.VISIBLE_RASTER_BAKE_CAPABILITY), configuration);
			const requireController = () => {
				if (!controller) throw new require_plugin_identifier.PluginNotInstalledError(cropPluginRef.id);
				return controller;
			};
			for (const operationId of [
				"crop:enter",
				"crop:update-rect",
				"crop:set-aspect-ratio",
				"crop:set-rotation",
				"crop:cancel"
			]) context.disposables.add(context.operations.register({
				id: operationId,
				mode: "busy",
				conflictDomains: cropPreviewDomains,
				reentrancy: "queue"
			}));
			context.disposables.add(context.operations.register({
				id: "crop:apply",
				mode: "mutation",
				conflictDomains: cropMutationDomains,
				reentrancy: "queue"
			}));
			context.disposables.add(context.tools.register({
				id: CROP_TOOL_ID,
				enter: () => void 0,
				exit: () => {
					if (controller === null || controller === void 0 ? void 0 : controller.isActive) controller.cancel();
				},
				canRunOperation: (operationId) => operationId.startsWith("crop:") || operationId === "mosaic:enter" || operationId === "core:load-image" || operationId === "core:commit-load-image" || operationId === "core:load-state" || operationId === "core:export"
			}));
			context.disposables.add(snapshots.registerTransientObject(cropPluginRef.id, (object) => {
				var _a;
				return (_a = controller === null || controller === void 0 ? void 0 : controller.ownsPreview(object)) !== null && _a !== void 0 ? _a : false;
			}));
			const runPreviewOperation = (operationId, value, task) => context.operations.run(operationId, value, (args) => task(requireController(), args));
			return Object.freeze({
				get isActive() {
					return requireController().isActive;
				},
				enter: (enterOptions) => runPreviewOperation("crop:enter", enterOptions !== null && enterOptions !== void 0 ? enterOptions : {}, async (crop, value) => {
					if (crop.isActive) {
						crop.enter(value);
						return;
					}
					await context.tools.enter(CROP_TOOL_ID);
					try {
						crop.enter(value);
					} catch (error) {
						await context.tools.exit("operation");
						throw error;
					}
				}),
				updateRect: (rect) => runPreviewOperation("crop:update-rect", rect, (crop, value) => crop.updateRect(value)),
				setAspectRatio: (ratio) => runPreviewOperation("crop:set-aspect-ratio", ratio, (crop, value) => crop.setAspectRatio(value)),
				setRotation: (degrees) => runPreviewOperation("crop:set-rotation", degrees, (crop, value) => crop.setRotation(value)),
				apply: async (applyOptions) => {
					try {
						await requireController().apply(applyOptions);
					} finally {
						if (context.tools.getActiveToolId() === CROP_TOOL_ID) await context.tools.exit("operation");
					}
				},
				cancel: () => runPreviewOperation("crop:cancel", void 0, async (crop) => {
					crop.cancel();
					if (context.tools.getActiveToolId() === CROP_TOOL_ID) await context.tools.exit("requested");
				}),
				getSession: () => requireController().getSession(),
				subscribe: (listener) => requireController().subscribe(listener)
			});
		},
		onImageCleared(context) {
			if (context.tools.getActiveToolId() === CROP_TOOL_ID) return context.tools.exit("operation");
			controller === null || controller === void 0 || controller.closeForImage();
		},
		onDispose() {
			controller === null || controller === void 0 || controller.dispose();
			controller = null;
		}
	});
}

//#endregion
Object.defineProperty(exports, 'CropError', {
  enumerable: true,
  get: function () {
    return CropError;
  }
});
Object.defineProperty(exports, 'CropIntegrationError', {
  enumerable: true,
  get: function () {
    return CropIntegrationError;
  }
});
Object.defineProperty(exports, 'CropSessionError', {
  enumerable: true,
  get: function () {
    return CropSessionError;
  }
});
Object.defineProperty(exports, 'CropValidationError', {
  enumerable: true,
  get: function () {
    return CropValidationError;
  }
});
Object.defineProperty(exports, 'cropPlugin', {
  enumerable: true,
  get: function () {
    return cropPlugin;
  }
});
Object.defineProperty(exports, 'cropPluginRef', {
  enumerable: true,
  get: function () {
    return cropPluginRef;
  }
});
//# sourceMappingURL=crop-DCN-RYwh.cjs.map