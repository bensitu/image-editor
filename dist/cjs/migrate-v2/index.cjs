Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
const require_plugin_identifier = require('../chunks/plugin-identifier-DhlVh5SQ.cjs');

//#region dist/esm/migrate-v2/overlay-state-v1.js
const SCHEMA = "image-editor.overlay-state";
const COORDINATE_SPACE = "image-normalized";
const MAX_OVERLAYS = 1e5;
const MAX_POINTS = 65536;
const MAX_TEXT_LENGTH = 2e4;
var OverlayStateV1MigrationError = class extends TypeError {
	constructor(code, message, path = "$") {
		super(`${message} (${path})`);
		Object.defineProperty(this, "code", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: code
		});
		Object.defineProperty(this, "path", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: path
		});
		Object.defineProperty(this, "name", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: "OverlayStateV1MigrationError"
		});
	}
};
function fail(code, message, path) {
	throw new OverlayStateV1MigrationError(code, message, path);
}
function isRecord$1(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}
function record(value, path) {
	return isRecord$1(value) ? value : fail("value.object", "Expected an object.", path);
}
function stringValue(value, path, fallback, allowEmpty = false) {
	if (value === void 0 && fallback !== void 0) return fallback;
	if (typeof value !== "string" || !allowEmpty && value.length === 0 || value.length > MAX_TEXT_LENGTH) return fail("value.string", allowEmpty ? "Expected a bounded string." : "Expected a non-empty bounded string.", path);
	return value;
}
function numberValue(value, path, fallback) {
	if (value === void 0 && fallback !== void 0) return fallback;
	if (typeof value !== "number" || !Number.isFinite(value)) return fail("value.number", "Expected a finite number.", path);
	return value;
}
function positive(value, path, fallback) {
	const result = numberValue(value, path, fallback);
	return result > 0 ? result : fail("value.positive", "Expected a positive number.", path);
}
function booleanValue(value, fallback) {
	return typeof value === "boolean" ? value : fallback;
}
function point(value, path) {
	const candidate = record(value, path);
	return Object.freeze({
		x: numberValue(candidate.x, `${path}.x`),
		y: numberValue(candidate.y, `${path}.y`)
	});
}
function cloneJson(value, path, depth = 0) {
	if (depth > 32) return fail("value.depth", "Metadata nesting is too deep.", path);
	if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) return value;
	if (Array.isArray(value)) {
		if (value.length > MAX_POINTS) return fail("value.array", "Array exceeds the migration limit.", path);
		return Object.freeze(value.map((entry, index) => cloneJson(entry, `${path}[${index}]`, depth + 1)));
	}
	const candidate = record(value, path);
	const output = Object.create(null);
	for (const key of Object.keys(candidate)) {
		if (require_plugin_identifier.isDangerousStateKey(key)) return fail("value.key", `Dangerous key "${key}" is not allowed.`, `${path}.${key}`);
		const descriptor = Object.getOwnPropertyDescriptor(candidate, key);
		if (!descriptor || !("value" in descriptor)) return fail("value.accessor", "Accessor properties are not allowed.", `${path}.${key}`);
		output[key] = cloneJson(descriptor.value, `${path}.${key}`, depth + 1);
	}
	return Object.freeze(output);
}
function metadata(value, path) {
	if (value === void 0) return Object.freeze({});
	return cloneJson(record(value, path), path);
}
function radians(degrees) {
	return degrees * Math.PI / 180;
}
function rotate(pointValue, origin, degrees) {
	if (degrees === 0) return pointValue;
	const angle = radians(degrees);
	const cosine = Math.cos(angle);
	const sine = Math.sin(angle);
	const x = pointValue.x - origin.x;
	const y = pointValue.y - origin.y;
	return Object.freeze({
		x: origin.x + x * cosine - y * sine,
		y: origin.y + x * sine + y * cosine
	});
}
function boundsCorners(left, top, width, height, angle) {
	const origin = Object.freeze({
		x: left,
		y: top
	});
	return Object.freeze({
		type: "bounds",
		corners: Object.freeze([
			origin,
			rotate({
				x: left + width,
				y: top
			}, origin, angle),
			rotate({
				x: left + width,
				y: top + height
			}, origin, angle),
			rotate({
				x: left,
				y: top + height
			}, origin, angle)
		])
	});
}
function scalarFromPixels(value, image) {
	return value / Math.min(image.naturalWidth, image.naturalHeight);
}
function scalarFromXRatio(value, image) {
	return value * image.naturalWidth / Math.min(image.naturalWidth, image.naturalHeight);
}
function dashArray(value, image, path) {
	if (value === void 0 || value === null) return null;
	if (!Array.isArray(value) || value.length > 16) return fail("style.dash", "Stroke dash data is invalid.", path);
	return Object.freeze(value.map((entry, index) => scalarFromPixels(numberValue(entry, `${path}[${index}]`), image)));
}
function interaction(source, editable) {
	return Object.freeze({
		selectable: booleanValue(source.selectable, true),
		evented: booleanValue(source.evented, true),
		hasControls: booleanValue(source.hasControls, true),
		...editable === void 0 ? {} : { editable }
	});
}
function item(id, kind, layer, hidden, locked, geometry, data, itemMetadata) {
	return Object.freeze({
		id,
		kind,
		codec: Object.freeze({
			type: kind,
			version: "1.0.0"
		}),
		geometry,
		layer,
		hidden,
		locked,
		...itemMetadata ? { metadata: itemMetadata } : {},
		data
	});
}
function uniqueId(id, reserved) {
	if (!reserved.has(id)) {
		reserved.add(id);
		return id;
	}
	for (let sequence = 2; sequence <= Number.MAX_SAFE_INTEGER; sequence += 1) {
		const suffix = `:part-${sequence}`;
		const candidate = `${id.slice(0, Math.max(1, 128 - suffix.length))}${suffix}`;
		if (!reserved.has(candidate)) {
			reserved.add(candidate);
			return candidate;
		}
	}
	return fail("overlay.id", "Could not allocate a unique Overlay id.", "$.overlays");
}
function convertMask(source, path, image, layer, id) {
	var _a;
	const geometry = record(source.geometry, `${path}.geometry`);
	const style = record(source.style, `${path}.style`);
	const shape = stringValue(source.maskShape, `${path}.maskShape`);
	const angle = numberValue(geometry.angle, `${path}.geometry.angle`, 0);
	let left;
	let top;
	let width;
	let height;
	let points = null;
	if (shape === "rect" && geometry.type === "rect") {
		left = numberValue(geometry.x, `${path}.geometry.x`);
		top = numberValue(geometry.y, `${path}.geometry.y`);
		width = positive(geometry.width, `${path}.geometry.width`);
		height = positive(geometry.height, `${path}.geometry.height`);
	} else if (shape === "circle" && geometry.type === "circle") {
		const radius = positive(geometry.radius, `${path}.geometry.radius`);
		left = numberValue(geometry.cx, `${path}.geometry.cx`) - radius;
		top = numberValue(geometry.cy, `${path}.geometry.cy`) - radius;
		width = radius * 2;
		height = radius * 2;
	} else if (shape === "ellipse" && geometry.type === "ellipse") {
		const rx = positive(geometry.rx, `${path}.geometry.rx`);
		const ry = positive(geometry.ry, `${path}.geometry.ry`);
		left = numberValue(geometry.cx, `${path}.geometry.cx`) - rx;
		top = numberValue(geometry.cy, `${path}.geometry.cy`) - ry;
		width = rx * 2;
		height = ry * 2;
	} else if (shape === "polygon" && geometry.type === "polygon") {
		if (!Array.isArray(geometry.points) || geometry.points.length < 3 || geometry.points.length > 4096) return fail("mask.points", "Polygon points are invalid.", `${path}.geometry.points`);
		const absolute = geometry.points.map((entry, index) => point(entry, `${path}.geometry.points[${index}]`));
		left = Math.min(...absolute.map((entry) => entry.x));
		top = Math.min(...absolute.map((entry) => entry.y));
		const right = Math.max(...absolute.map((entry) => entry.x));
		const bottom = Math.max(...absolute.map((entry) => entry.y));
		width = right - left;
		height = bottom - top;
		if (!(width > 0) || !(height > 0)) return fail("mask.points", "Polygon points must span a positive area.", `${path}.geometry.points`);
		points = Object.freeze(absolute.map((entry) => Object.freeze({
			x: (entry.x - left) / width,
			y: (entry.y - top) / height
		})));
	} else return fail("mask.shape", "Mask shape and geometry do not match.", path);
	const stroke = style.stroke;
	if (stroke !== void 0 && stroke !== null && typeof stroke !== "string") return fail("style.stroke", "Mask stroke must be a string or null.", `${path}.style.stroke`);
	const numericId = (_a = /(?:^|[-:])(\d+)$/u.exec(id)) === null || _a === void 0 ? void 0 : _a[1];
	const maskId = numericId ? Number(numericId) : layer + 1;
	return item(id, "mask:object", layer, source.hidden === true, false, boundsCorners(left, top, width, height, angle), Object.freeze({
		version: 1,
		kind: shape,
		maskId: Number.isSafeInteger(maskId) && maskId > 0 ? maskId : layer + 1,
		name: id,
		fill: stringValue(style.fill, `${path}.style.fill`, "#000000"),
		opacity: numberValue(style.alpha, `${path}.style.alpha`, 1),
		stroke: stroke !== null && stroke !== void 0 ? stroke : null,
		strokeWidth: scalarFromPixels(numberValue(style.strokeWidth, `${path}.style.strokeWidth`, 1), image),
		strokeDashArray: dashArray(style.strokeDashArray, image, `${path}.style.strokeDashArray`),
		cornerRadiusX: geometry.rx === void 0 ? 0 : numberValue(geometry.rx, `${path}.geometry.rx`),
		cornerRadiusY: geometry.ry === void 0 ? 0 : numberValue(geometry.ry, `${path}.geometry.ry`),
		points,
		hasControls: booleanValue(style.hasControls, true),
		selectable: booleanValue(style.selectable, true),
		evented: booleanValue(style.evented, true)
	}), metadata(source.metadata, `${path}.metadata`));
}
function annotationEnvelope(id, source, feature, editable) {
	const style = isRecord$1(source.style) ? source.style : {};
	return Object.freeze({
		version: 1,
		name: id,
		interaction: interaction(style, editable),
		feature
	});
}
function convertText(source, path, image, layer, id, warn) {
	const geometry = record(source.geometry, `${path}.geometry`);
	const text = record(source.text, `${path}.text`);
	const style = record(source.style, `${path}.style`);
	const value = stringValue(text.value, `${path}.text.value`, "Text", true);
	const x = numberValue(geometry.x, `${path}.geometry.x`);
	const y = numberValue(geometry.y, `${path}.geometry.y`);
	const angle = numberValue(geometry.angle, `${path}.geometry.angle`, 0);
	const width = positive(geometry.width, `${path}.geometry.width`, .25);
	const fontSizePx = positive(style.fontSize, `${path}.style.fontSize`, 24);
	const lineHeight = positive(style.lineHeight, `${path}.style.lineHeight`, 1.16);
	const lineCount = Math.max(1, value.split(/\r?\n/u).length);
	const height = fontSizePx * lineHeight * lineCount / image.naturalHeight;
	warn("text.bounds.approximated", `${path}.geometry`, "Wire format 1 did not store rendered text height; wire format 2 bounds were estimated from font size and line height.");
	return item(id, "annotation:text", layer, source.hidden === true, source.locked === true, boundsCorners(x, y, width, height, angle), annotationEnvelope(id, source, Object.freeze({
		version: 1,
		text: value,
		fontSize: scalarFromPixels(fontSizePx, image),
		width: scalarFromXRatio(width, image),
		fontFamily: stringValue(style.fontFamily, `${path}.style.fontFamily`, "Arial"),
		fontWeight: typeof style.fontWeight === "number" || typeof style.fontWeight === "string" ? style.fontWeight : "normal",
		fill: stringValue(style.fill, `${path}.style.fill`, "#111111"),
		backgroundColor: typeof style.backgroundColor === "string" ? style.backgroundColor : "",
		textAlign: style.textAlign === "center" || style.textAlign === "right" || style.textAlign === "justify" ? style.textAlign : "left",
		lineHeight,
		opacity: numberValue(style.opacity, `${path}.style.opacity`, 1)
	}), true), metadata(source.metadata, `${path}.metadata`));
}
function convertShape(source, path, image, layer, id) {
	const shape = stringValue(source.shape, `${path}.shape`);
	const geometry = record(source.geometry, `${path}.geometry`);
	const style = record(source.style, `${path}.style`);
	const angle = numberValue(geometry.angle, `${path}.geometry.angle`, 0);
	let stateGeometry;
	if (shape === "rect" && geometry.type === "rect") stateGeometry = Object.freeze({
		kind: "rect",
		bounds: boundsCorners(numberValue(geometry.x, `${path}.geometry.x`), numberValue(geometry.y, `${path}.geometry.y`), positive(geometry.width, `${path}.geometry.width`), positive(geometry.height, `${path}.geometry.height`), angle)
	});
	else if ((shape === "line" || shape === "arrow") && geometry.type === shape) {
		const start = point({
			x: geometry.x1,
			y: geometry.y1
		}, `${path}.geometry.start`);
		const end = point({
			x: geometry.x2,
			y: geometry.y2
		}, `${path}.geometry.end`);
		const origin = Object.freeze({
			x: Math.min(start.x, end.x),
			y: Math.min(start.y, end.y)
		});
		stateGeometry = Object.freeze({
			kind: shape,
			start: rotate(start, origin, angle),
			end: rotate(end, origin, angle)
		});
	} else return fail("annotation.shape", "Shape kind and geometry do not match.", path);
	return item(id, "annotation:shape", layer, source.hidden === true, source.locked === true, stateGeometry, annotationEnvelope(id, source, Object.freeze({
		version: 1,
		stroke: stringValue(style.stroke, `${path}.style.stroke`, "#111111"),
		strokeWidth: scalarFromPixels(numberValue(style.strokeWidth, `${path}.style.strokeWidth`, 3), image),
		fill: typeof style.fill === "string" ? style.fill : "",
		opacity: numberValue(style.opacity, `${path}.style.opacity`, 1),
		strokeDashArray: dashArray(style.strokeDashArray, image, `${path}.style.strokeDashArray`),
		arrowHeadLength: scalarFromPixels(numberValue(geometry.arrowHeadLength, `${path}.geometry.arrowHeadLength`, 16), image)
	})), metadata(source.metadata, `${path}.metadata`));
}
function convertDraw(source, path, image, layerStart, id, reserved, remainingItemBudget) {
	if (!Array.isArray(source.strokes) || source.strokes.length === 0 || source.strokes.length > remainingItemBudget) return fail("annotation.strokes", "Draw strokes are invalid or exceed the remaining Overlay limit.", `${path}.strokes`);
	return Object.freeze(source.strokes.map((entry, strokeIndex) => {
		const strokePath = `${path}.strokes[${strokeIndex}]`;
		const stroke = record(entry, strokePath);
		const brush = record(stroke.brush, `${strokePath}.brush`);
		if (!Array.isArray(stroke.points) || stroke.points.length < 2 || stroke.points.length > MAX_POINTS) return fail("annotation.points", "Draw points are invalid.", `${strokePath}.points`);
		const points = Object.freeze(stroke.points.map((entryPoint, pointIndex) => point(entryPoint, `${strokePath}.points[${pointIndex}]`)));
		const partId = strokeIndex === 0 ? id : uniqueId(`${id}:stroke-${strokeIndex + 1}`, reserved);
		return item(partId, "annotation:draw", layerStart + strokeIndex, source.hidden === true, source.locked === true, Object.freeze({
			type: "path",
			points
		}), annotationEnvelope(partId, source, Object.freeze({
			version: 1,
			color: stringValue(brush.color, `${strokePath}.brush.color`, "#111111"),
			width: scalarFromPixels(positive(brush.width, `${strokePath}.brush.width`, 1), image),
			opacity: numberValue(brush.opacity, `${strokePath}.brush.opacity`, 1),
			lineCap: brush.lineCap === "butt" || brush.lineCap === "square" ? brush.lineCap : "round",
			lineJoin: brush.lineJoin === "bevel" || brush.lineJoin === "miter" ? brush.lineJoin : "round"
		})), metadata(source.metadata, `${path}.metadata`));
	}));
}
function resolveMigrationOptions(value) {
	var _a, _b;
	if (!isRecord$1(value)) return fail("options.object", "Migration options must be an object.", "$options");
	const allowed = /* @__PURE__ */ new Set([
		"unsupportedOverlayPolicy",
		"baseImageTransformPolicy",
		"onWarning"
	]);
	if (Object.keys(value).some((key) => !allowed.has(key))) return fail("options.key", "Migration options contain unknown keys.", "$options");
	const unsupportedOverlayPolicy = (_a = value.unsupportedOverlayPolicy) !== null && _a !== void 0 ? _a : "error";
	if (unsupportedOverlayPolicy !== "error" && unsupportedOverlayPolicy !== "skip") return fail("options.policy", "unsupportedOverlayPolicy must be \"error\" or \"skip\".", "$options.unsupportedOverlayPolicy");
	const baseImageTransformPolicy = (_b = value.baseImageTransformPolicy) !== null && _b !== void 0 ? _b : "error";
	if (baseImageTransformPolicy !== "error" && baseImageTransformPolicy !== "drop") return fail("options.policy", "baseImageTransformPolicy must be \"error\" or \"drop\".", "$options.baseImageTransformPolicy");
	if (value.onWarning !== void 0 && typeof value.onWarning !== "function") return fail("options.callback", "onWarning must be a function.", "$options.onWarning");
	return Object.freeze({
		unsupportedOverlayPolicy,
		baseImageTransformPolicy,
		...value.onWarning ? { onWarning: value.onWarning } : {}
	});
}
function imageReference(value) {
	const source = record(value, "$.image");
	const naturalWidth = positive(source.naturalWidth, "$.image.naturalWidth");
	const naturalHeight = positive(source.naturalHeight, "$.image.naturalHeight");
	if (!Number.isSafeInteger(naturalWidth) || !Number.isSafeInteger(naturalHeight)) return fail("image.dimensions", "Image dimensions must be positive safe integers.", "$.image");
	const mimeType = source.mimeType;
	if (mimeType !== void 0 && mimeType !== "image/jpeg" && mimeType !== "image/png" && mimeType !== "image/webp") return fail("image.mime", "Image MIME type is unsupported.", "$.image.mimeType");
	return Object.freeze({
		naturalWidth,
		naturalHeight,
		...mimeType ? { mimeType } : {},
		...typeof source.sourceId === "string" ? { sourceId: source.sourceId } : {},
		...typeof source.checksum === "string" ? { checksum: source.checksum } : {}
	});
}
function migrateV1OverlayState(input, options = {}) {
	const resolvedOptions = resolveMigrationOptions(options);
	const source = record(input, "$");
	if (source.schema !== SCHEMA || source.version !== 1 || source.coordinateSpace !== COORDINATE_SPACE) return fail("document.unsupported", "Input is not a supported Overlay State wire format 1 document.", "$");
	const warn = (code, path, message) => {
		var _a;
		(_a = resolvedOptions.onWarning) === null || _a === void 0 || _a.call(resolvedOptions, Object.freeze({
			code,
			path,
			message
		}));
	};
	if (source.baseImageTransform !== void 0) {
		const transform = record(source.baseImageTransform, "$.baseImageTransform");
		if (numberValue(transform.rotation, "$.baseImageTransform.rotation", 0) !== 0 || transform.flipX === true || transform.flipY === true) {
			if (resolvedOptions.baseImageTransformPolicy === "error") return fail("transform.unsupported", "Overlay State wire format 2 does not mutate the Base Image transform; pass baseImageTransformPolicy: \"drop\" only when the host restores that transform separately.", "$.baseImageTransform");
			warn("transform.dropped", "$.baseImageTransform", "The wire format 1 Base Image transform was dropped; the host must restore it separately.");
		}
	}
	const image = imageReference(source.image);
	if (record(source.image, "$.image").orientation !== void 0 && record(source.image, "$.image").orientation !== 1) return fail("image.orientation", "Non-normalized wire format 1 image orientation cannot be represented in Overlay State wire format 2.", "$.image.orientation");
	if (!Array.isArray(source.overlays) || source.overlays.length > MAX_OVERLAYS) return fail("document.overlays", "Overlay collection is invalid.", "$.overlays");
	const overlays = [];
	const reserved = /* @__PURE__ */ new Set();
	for (let index = 0; index < source.overlays.length; index += 1) {
		const path = `$.overlays[${index}]`;
		const sourceOverlay = record(source.overlays[index], path);
		const requestedId = stringValue(sourceOverlay.id, `${path}.id`);
		if (sourceOverlay.kind === "mask") {
			if (overlays.length >= MAX_OVERLAYS) return fail("document.overlays", "Overlay collection exceeds its limit.", path);
			const id = uniqueId(requestedId, reserved);
			overlays.push(convertMask(sourceOverlay, path, image, overlays.length, id));
			continue;
		}
		if (sourceOverlay.kind === "annotation") {
			const id = uniqueId(requestedId, reserved);
			if (sourceOverlay.annotationType === "text") {
				if (overlays.length >= MAX_OVERLAYS) return fail("document.overlays", "Overlay collection exceeds its limit.", path);
				overlays.push(convertText(sourceOverlay, path, image, overlays.length, id, warn));
			} else if (sourceOverlay.annotationType === "shape") {
				if (overlays.length >= MAX_OVERLAYS) return fail("document.overlays", "Overlay collection exceeds its limit.", path);
				overlays.push(convertShape(sourceOverlay, path, image, overlays.length, id));
			} else if (sourceOverlay.annotationType === "draw") overlays.push(...convertDraw(sourceOverlay, path, image, overlays.length, id, reserved, MAX_OVERLAYS - overlays.length));
			else return fail("annotation.type", "Annotation type is unsupported.", `${path}.annotationType`);
			continue;
		}
		if (resolvedOptions.unsupportedOverlayPolicy === "error") return fail("overlay.unsupported", `Overlay kind "${String(sourceOverlay.kind)}" has no built-in wire format 2 State Codec mapping.`, `${path}.kind`);
		warn("overlay.skipped", path, `Overlay kind "${String(sourceOverlay.kind)}" was skipped because no wire format 2 State Codec mapping exists.`);
	}
	return Object.freeze({
		schema: SCHEMA,
		version: 2,
		coordinateSpace: COORDINATE_SPACE,
		image,
		overlays: Object.freeze(overlays),
		...source.metadata === void 0 ? {} : { metadata: metadata(source.metadata, "$.metadata") }
	});
}

//#endregion
//#region dist/esm/migrate-v2/index.js
const SOURCE_SCHEMA = "image-editor.canvas@2";
const TARGET_SCHEMA = "image-editor.state@3";
const MAX_INPUT_BYTES = 16777216;
const MAX_OBJECT_COUNT = 1e5;
const MAX_DEPTH = 64;
const MAX_CANVAS_DIMENSION = 32768;
const MAX_CANVAS_PIXELS = 5e7;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const TOP_LEVEL_KEYS = /* @__PURE__ */ new Set([
	"version",
	"width",
	"height",
	"background",
	"objects",
	"_editorState"
]);
const EDITOR_STATE_KEYS = /* @__PURE__ */ new Set([
	"currentScale",
	"currentRotation",
	"baseImageScale",
	"currentImageMimeType",
	"imageFilterConfig",
	"activeObjectKind",
	"activeMaskId",
	"activeAnnotationId"
]);
const EDITOR_OBJECT_KEYS = /* @__PURE__ */ new Set([
	"editorObjectKind",
	"sessionObjectType",
	"maskId",
	"maskUid",
	"maskName",
	"isCropRect",
	"maskLabel",
	"originalAlpha",
	"originalStroke",
	"originalStrokeWidth",
	"isMosaicPreview",
	"annotationId",
	"annotationType",
	"shapeAnnotationKind",
	"annotationName",
	"annotationHidden",
	"annotationLocked",
	"annotationSelectable",
	"annotationEvented",
	"annotationHasControls",
	"annotationEditable",
	"overlayPersistentId",
	"overlayMetadata"
]);
const FILTER_KEYS = [
	"brightness",
	"contrast",
	"saturation",
	"blur",
	"sharpen",
	"grayscale",
	"sepia",
	"vintage"
];
var SnapshotMigrationError = class extends Error {
	constructor(code, message, path = "$", options) {
		super(`${message} (${path})`);
		Object.defineProperty(this, "code", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: code
		});
		Object.defineProperty(this, "path", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: path
		});
		Object.defineProperty(this, "name", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: "SnapshotMigrationError"
		});
		if (options && "cause" in options) this.cause = options.cause;
	}
};
function isRecord(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}
function isFiniteNumber(value) {
	return typeof value === "number" && Number.isFinite(value);
}
function byteLength(value) {
	return new TextEncoder().encode(value).byteLength;
}
function limit(value, fallback, label) {
	if (value === void 0) return fallback;
	if (!Number.isSafeInteger(value) || value < 1) throw new SnapshotMigrationError("limit.invalid", `${label} must be a positive integer.`);
	return value;
}
function inspectJsonValue(value, limits, path = "$", depth = 0, ancestors = /* @__PURE__ */ new WeakSet(), counter = {
	objects: 0,
	bytes: 0
}) {
	const addBytes = (amount) => {
		counter.bytes += amount;
		if (!Number.isSafeInteger(counter.bytes) || counter.bytes > limits.maxInputBytes) throw new SnapshotMigrationError("input.bytes", "Snapshot input is too large.", path);
	};
	if (depth > limits.maxDepth) throw new SnapshotMigrationError("input.depth", "Snapshot nesting is too deep.", path);
	if (value === null || typeof value !== "object") {
		if (value === void 0 || typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") throw new SnapshotMigrationError("input.value", `Snapshot contains unsupported ${typeof value} data.`, path);
		if (typeof value === "number" && !Number.isFinite(value)) throw new SnapshotMigrationError("input.number", "Snapshot numbers must be finite.", path);
		const serialized = JSON.stringify(value);
		if (serialized === void 0) throw new SnapshotMigrationError("input.value", "Snapshot contains unsupported data.", path);
		addBytes(byteLength(serialized));
		return;
	}
	if (!Array.isArray(value) && !isRecord(value)) throw new SnapshotMigrationError("input.prototype", "Snapshot data must contain only plain objects and arrays.", path);
	if (Object.prototype.hasOwnProperty.call(value, "toJSON") || Object.getOwnPropertySymbols(value).length > 0) throw new SnapshotMigrationError("input.property", "Snapshot data must not contain toJSON hooks or symbol properties.", path);
	if (ancestors.has(value)) throw new SnapshotMigrationError("input.cycle", "Snapshot data must not be cyclic.", path);
	counter.objects += 1;
	if (counter.objects > limits.maxObjectCount) throw new SnapshotMigrationError("input.objects", "Snapshot object count exceeds the configured limit.", path);
	ancestors.add(value);
	const keys = Object.keys(value);
	if (Array.isArray(value)) {
		const extraKey = keys.find((key) => !/^(?:0|[1-9]\d*)$/u.test(key) || Number(key) >= value.length);
		if (extraKey !== void 0) throw new SnapshotMigrationError("input.array-property", "Snapshot arrays must not contain named enumerable properties.", `${path}.${extraKey}`);
		addBytes(2 + Math.max(0, value.length - 1));
		for (let index = 0; index < value.length; index += 1) {
			const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
			if (!descriptor) {
				addBytes(4);
				continue;
			}
			if (!("value" in descriptor)) throw new SnapshotMigrationError("input.accessor", "Snapshot data must not contain accessor properties.", `${path}[${index}]`);
			inspectJsonValue(descriptor.value, limits, `${path}[${index}]`, depth + 1, ancestors, counter);
		}
		ancestors.delete(value);
		return;
	}
	addBytes(2 + Math.max(0, keys.length - 1));
	for (const key of keys) {
		if (require_plugin_identifier.isDangerousStateKey(key)) throw new SnapshotMigrationError("input.key", `Snapshot contains dangerous key "${key}".`, `${path}.${key}`);
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (!descriptor || !("value" in descriptor)) throw new SnapshotMigrationError("input.accessor", "Snapshot data must not contain accessor properties.", `${path}.${key}`);
		addBytes(byteLength(JSON.stringify(key)) + 1);
		inspectJsonValue(descriptor.value, limits, `${path}.${key}`, depth + 1, ancestors, counter);
	}
	ancestors.delete(value);
}
function cloneInput(input, options) {
	const maxInputBytes = limit(options.maxInputBytes, MAX_INPUT_BYTES, "maxInputBytes");
	const limits = {
		maxObjectCount: limit(options.maxObjectCount, MAX_OBJECT_COUNT, "maxObjectCount"),
		maxDepth: limit(options.maxDepth, MAX_DEPTH, "maxDepth"),
		maxInputBytes
	};
	let value;
	if (typeof input === "string") {
		if (byteLength(input) > maxInputBytes) throw new SnapshotMigrationError("input.bytes", "Snapshot input is too large.");
		try {
			value = JSON.parse(input);
		} catch (error) {
			throw new SnapshotMigrationError("input.json", "Snapshot input is not valid JSON.", "$", { cause: error });
		}
	} else value = input;
	inspectJsonValue(value, limits);
	const serialized = JSON.stringify(value);
	if (byteLength(serialized) > maxInputBytes) throw new SnapshotMigrationError("input.bytes", "Snapshot input is too large.");
	return JSON.parse(serialized);
}
function detectionValue(input) {
	try {
		return cloneInput(input, {});
	} catch {
		return null;
	}
}
function hasSourceDiscriminator(value) {
	if (!isRecord(value) || "schema" in value || !Array.isArray(value.objects)) return false;
	const state = value._editorState;
	return isRecord(state) && isFiniteNumber(state.currentScale) && isFiniteNumber(state.currentRotation) && isFiniteNumber(state.baseImageScale);
}
function detectSnapshotVersion(input) {
	const value = detectionValue(input);
	if (isRecord(value) && value.schema === "image-editor.state") return value.version === 3 ? Object.freeze({
		kind: "current",
		schema: "image-editor.state",
		version: 3
	}) : Object.freeze({
		kind: "unsupported",
		schema: "image-editor.state",
		version: value.version
	});
	if (hasSourceDiscriminator(value)) return Object.freeze({
		kind: "source",
		schema: SOURCE_SCHEMA,
		version: 2
	});
	return Object.freeze({ kind: "unknown" });
}
function issue(context, code, path, message) {
	var _a;
	if (context.policy === "error") throw new SnapshotMigrationError(code, message, path);
	(_a = context.onWarning) === null || _a === void 0 || _a.call(context, Object.freeze({
		code,
		path,
		message
	}));
}
function rejectObject(context, code, path, message) {
	issue(context, code, path, message);
	return null;
}
function reportUnknownKeys(value, allowed, path, context) {
	for (const key of Object.keys(value)) if (!allowed.has(key)) issue(context, "field.unsupported", `${path}.${key}`, `Unsupported persisted field "${key}" cannot be converted.`);
}
function sanitizedFabricObject(value) {
	return Object.fromEntries(Object.entries(value).filter(([key]) => !EDITOR_OBJECT_KEYS.has(key)));
}
function objectType(value) {
	return typeof value.type === "string" ? value.type.toLowerCase() : "";
}
function requireSource(input, options) {
	const value = cloneInput(input, options);
	if (!hasSourceDiscriminator(value)) {
		const detection = detectSnapshotVersion(value);
		throw new SnapshotMigrationError("schema.unsupported", detection.kind === "current" ? "Current Snapshots do not require conversion." : "Input is not a supported frozen maintenance Snapshot.");
	}
	return value;
}
function sourceObjects(value) {
	return value.objects.map((object, index) => {
		if (!isRecord(object)) throw new SnapshotMigrationError("object.invalid", "Canvas objects must be plain records.", `$.objects[${index}]`);
		return object;
	});
}
function findBaseImage(objects) {
	var _a;
	const explicit = objects.filter((object) => object.editorObjectKind === "baseImage");
	if (explicit.length > 1) throw new SnapshotMigrationError("base.multiple", "Snapshot contains more than one Base Image.", "$.objects");
	if (explicit.length === 1) {
		const image = explicit[0];
		if (objectType(image) !== "image") throw new SnapshotMigrationError("base.type", "The Base Image must be a Fabric Image.", "$.objects");
		return image;
	}
	const images = objects.filter((object) => objectType(object) === "image");
	if (images.length > 1) throw new SnapshotMigrationError("base.ambiguous", "Snapshot has multiple unmarked Images and no unambiguous Base Image.", "$.objects");
	return (_a = images[0]) !== null && _a !== void 0 ? _a : null;
}
function dimensions(source, options) {
	const sourceWidth = source.width;
	const sourceHeight = source.height;
	const fallback = options.canvasSize;
	const width = isFiniteNumber(sourceWidth) && sourceWidth > 0 ? sourceWidth : fallback === null || fallback === void 0 ? void 0 : fallback.width;
	const height = isFiniteNumber(sourceHeight) && sourceHeight > 0 ? sourceHeight : fallback === null || fallback === void 0 ? void 0 : fallback.height;
	if (!isFiniteNumber(width) || width <= 0 || !isFiniteNumber(height) || height <= 0) throw new SnapshotMigrationError("canvas.size", "Snapshot Canvas dimensions are missing; provide canvasSize explicitly.", "$");
	if (width > MAX_CANVAS_DIMENSION || height > MAX_CANVAS_DIMENSION || width * height > MAX_CANVAS_PIXELS) throw new SnapshotMigrationError("canvas.size", "Snapshot Canvas dimensions exceed the public Snapshot limits.", "$");
	return Object.freeze({
		width,
		height
	});
}
function transformState(state, base) {
	if (!isFiniteNumber(state.currentScale) || state.currentScale <= 0) throw new SnapshotMigrationError("transform.scale", "Snapshot scale must be positive and finite.", "$._editorState.currentScale");
	if (!isFiniteNumber(state.currentRotation)) throw new SnapshotMigrationError("transform.rotation", "Snapshot rotation must be finite.", "$._editorState.currentRotation");
	return Object.freeze({
		scale: state.currentScale,
		rotationDegrees: state.currentRotation,
		flipX: (base === null || base === void 0 ? void 0 : base.flipX) === true,
		flipY: (base === null || base === void 0 ? void 0 : base.flipY) === true
	});
}
function imageMimeType(state, context) {
	const value = state.currentImageMimeType;
	if (value === void 0 || value === null) return null;
	if (value === "image/jpeg" || value === "image/png" || value === "image/webp") return value;
	issue(context, "image.mime", "$._editorState.currentImageMimeType", "Unsupported image MIME metadata was skipped.");
	return null;
}
function filterDefinitions(state, base, context) {
	const raw = state.imageFilterConfig;
	if (raw === void 0) {
		if (Array.isArray(base === null || base === void 0 ? void 0 : base.filters) && base.filters.length > 0) issue(context, "filter.fabric", "$.objects.filters", "Fabric filter payload has no authoritative editor filter configuration.");
		return Object.freeze([]);
	}
	if (!isRecord(raw)) {
		issue(context, "filter.config", "$._editorState.imageFilterConfig", "Image filter configuration is malformed.");
		return Object.freeze([]);
	}
	reportUnknownKeys(raw, new Set(FILTER_KEYS), "$._editorState.imageFilterConfig", context);
	const definitions = [];
	for (const key of FILTER_KEYS) {
		const value = raw[key];
		if (key === "grayscale" || key === "sepia" || key === "vintage") {
			if (value === void 0 || value === false) continue;
			if (value === true) definitions.push(Object.freeze({ type: key }));
			else issue(context, "filter.value", `$._editorState.imageFilterConfig.${key}`, `Filter "${key}" must be boolean.`);
			continue;
		}
		if (value === void 0 || value === 0) continue;
		const minimum = key === "blur" || key === "sharpen" ? 0 : -1;
		if (!isFiniteNumber(value) || value < minimum || value > 1) {
			issue(context, "filter.value", `$._editorState.imageFilterConfig.${key}`, `Filter "${key}" is outside its supported range.`);
			continue;
		}
		definitions.push(Object.freeze({
			type: key,
			value
		}));
	}
	return Object.freeze(definitions);
}
function overlayId(value) {
	return typeof value === "string" && ID_PATTERN.test(value);
}
function maskRecord(object, index, context) {
	const path = `$.objects[${index}]`;
	if (!Number.isSafeInteger(object.maskId) || Number(object.maskId) <= 0) return rejectObject(context, "mask.id", path, "Mask identifier is invalid.");
	if (!overlayId(object.maskUid)) return rejectObject(context, "mask.uid", path, "Mask persistent identifier is invalid.");
	if (typeof object.maskName !== "string") return rejectObject(context, "mask.name", path, "Mask name is invalid.");
	const originalAlpha = isFiniteNumber(object.originalAlpha) ? object.originalAlpha : isFiniteNumber(object.opacity) ? object.opacity : .5;
	const serialized = sanitizedFabricObject(object);
	let overlayMetadata;
	if (object.overlayMetadata !== void 0) {
		if (isRecord(object.overlayMetadata)) overlayMetadata = Object.freeze({ ...object.overlayMetadata });
		else issue(context, "mask.metadata", `${path}.overlayMetadata`, "Mask metadata was skipped because it is not an object.");
	}
	const data = Object.freeze({
		object: serialized,
		maskId: Number(object.maskId),
		maskUid: object.maskUid,
		maskName: object.maskName,
		originalAlpha,
		...Object.prototype.hasOwnProperty.call(object, "originalStroke") ? { originalStroke: object.originalStroke } : {},
		...isFiniteNumber(object.originalStrokeWidth) ? { originalStrokeWidth: object.originalStrokeWidth } : {},
		...typeof object.overlayPersistentId === "string" ? { overlayPersistentId: object.overlayPersistentId } : {},
		...overlayMetadata ? { overlayMetadata } : {}
	});
	return Object.freeze({
		kind: "mask:object",
		persistentId: object.maskUid,
		hidden: object.visible === false,
		locked: false,
		codec: Object.freeze({
			type: "mask:object",
			version: "1.0.0"
		}),
		data
	});
}
function pathPoints(value) {
	if (!Array.isArray(value)) return Object.freeze([]);
	const points = [];
	for (const segment of value) {
		if (!Array.isArray(segment) || typeof segment[0] !== "string") continue;
		const command = segment[0].toUpperCase();
		if (![
			"M",
			"L",
			"T",
			"Q",
			"S",
			"C"
		].includes(command)) continue;
		const x = segment[segment.length - 2];
		const y = segment[segment.length - 1];
		if (!isFiniteNumber(x) || !isFiniteNumber(y)) continue;
		const previous = points[points.length - 1];
		if (!previous || previous.x !== x || previous.y !== y) points.push(Object.freeze({
			x,
			y
		}));
	}
	return Object.freeze(points);
}
function shapeGeometry(object, kind, path) {
	if (kind === "rect") {
		if (!isFiniteNumber(object.left) || !isFiniteNumber(object.top) || !isFiniteNumber(object.width) || object.width <= 0 || !isFiniteNumber(object.height) || object.height <= 0) throw new SnapshotMigrationError("annotation.geometry", "Rectangle geometry is invalid.", path);
		return Object.freeze({
			kind,
			left: object.left,
			top: object.top,
			width: object.width,
			height: object.height
		});
	}
	let start;
	let end;
	if (kind === "line") {
		if (isFiniteNumber(object.x1) && isFiniteNumber(object.y1) && isFiniteNumber(object.x2) && isFiniteNumber(object.y2)) {
			start = Object.freeze({
				x: object.x1,
				y: object.y1
			});
			end = Object.freeze({
				x: object.x2,
				y: object.y2
			});
		}
	} else {
		const points = pathPoints(object.path);
		start = points[0];
		end = points[points.length - 1];
	}
	if (!start || !end || Math.hypot(end.x - start.x, end.y - start.y) < .5) throw new SnapshotMigrationError("annotation.geometry", "Linear geometry is invalid.", path);
	return Object.freeze({
		kind,
		start,
		end
	});
}
function interactionValue(object, key, fallback, path, context) {
	const value = object[key];
	if (value === void 0) return fallback;
	if (typeof value === "boolean") return value;
	issue(context, "annotation.interaction", `${path}.${key}`, `Interaction field "${key}" was skipped.`);
	return fallback;
}
function annotationRecord(object, index, context) {
	var _a;
	const path = `$.objects[${index}]`;
	if (!Number.isSafeInteger(object.annotationId) || Number(object.annotationId) <= 0) return rejectObject(context, "annotation.id", path, "Annotation identifier is invalid.");
	if (object.annotationType !== "text" && object.annotationType !== "shape" && object.annotationType !== "draw") return rejectObject(context, "annotation.type", path, "Annotation type is unsupported.");
	if (typeof object.annotationName !== "string") return rejectObject(context, "annotation.name", path, "Annotation name is invalid.");
	const kind = `annotation:${object.annotationType}`;
	const generatedId = `${kind}:${Number(object.annotationId)}`;
	const persistentId = overlayId(object.overlayPersistentId) ? object.overlayPersistentId : generatedId;
	if (!overlayId(persistentId)) return rejectObject(context, "annotation.persistentId", path, "Annotation persistent identifier is invalid.");
	let metadata = Object.freeze({});
	if (object.overlayMetadata !== void 0) {
		if (isRecord(object.overlayMetadata)) metadata = Object.freeze({ ...object.overlayMetadata });
		else issue(context, "annotation.metadata", `${path}.overlayMetadata`, "Annotation metadata was skipped because it is not an object.");
	}
	const interaction = Object.freeze({
		selectable: interactionValue(object, "annotationSelectable", object.selectable !== false, path, context),
		evented: interactionValue(object, "annotationEvented", object.evented !== false, path, context),
		hasControls: interactionValue(object, "annotationHasControls", object.hasControls !== false, path, context),
		...object.annotationType === "text" ? { editable: interactionValue(object, "annotationEditable", object.editable !== false, path, context) } : {}
	});
	const serialized = sanitizedFabricObject(object);
	let codecType;
	let feature;
	if (object.annotationType === "text") {
		if (objectType(serialized) !== "textbox" || typeof serialized.text !== "string" || !isFiniteNumber(serialized.left) || !isFiniteNumber(serialized.top) || !isFiniteNumber(serialized.width) || !isFiniteNumber(serialized.fontSize)) return rejectObject(context, "annotation.text", path, "Text Annotation payload is invalid.");
		codecType = "annotation:textbox";
		feature = serialized;
	} else if (object.annotationType === "shape") {
		const shapeKind = object.shapeAnnotationKind === "line" || object.shapeAnnotationKind === "arrow" ? object.shapeAnnotationKind : "rect";
		const expectedType = shapeKind === "arrow" ? "path" : shapeKind;
		if (objectType(serialized) !== expectedType) return rejectObject(context, "annotation.shape", path, "Shape Annotation payload is invalid.");
		codecType = "annotation:shape-object";
		try {
			feature = Object.freeze({
				version: 1,
				shapeKind,
				geometry: shapeGeometry(serialized, shapeKind, path),
				object: serialized
			});
		} catch (error) {
			if (error instanceof SnapshotMigrationError && context.policy === "warn-and-skip") {
				(_a = context.onWarning) === null || _a === void 0 || _a.call(context, Object.freeze({
					code: error.code,
					path: error.path,
					message: error.message
				}));
				return null;
			}
			throw error;
		}
	} else {
		const points = pathPoints(serialized.path);
		if (objectType(serialized) !== "path" || points.length < 2) return rejectObject(context, "annotation.draw", path, "Draw Annotation payload is invalid.");
		codecType = "annotation:draw-path";
		feature = Object.freeze({
			version: 1,
			points,
			object: serialized
		});
	}
	return Object.freeze({
		kind,
		persistentId,
		hidden: object.annotationHidden === true || object.visible === false,
		locked: object.annotationLocked === true,
		codec: Object.freeze({
			type: codecType,
			version: "1.0.0"
		}),
		data: Object.freeze({
			version: 1,
			name: object.annotationName,
			metadata,
			interaction,
			feature
		})
	});
}
function selectionIds(state, maskIds, annotationIds, context) {
	const ids = [];
	if (state.activeObjectKind === "mask" && Number.isSafeInteger(state.activeMaskId)) {
		const id = maskIds.get(Number(state.activeMaskId));
		if (id) ids.push(id);
		else issue(context, "selection.missing", "$._editorState.activeMaskId", "Selected Mask was not present in the converted overlays.");
	} else if (state.activeObjectKind === "annotation" && Number.isSafeInteger(state.activeAnnotationId)) {
		const id = annotationIds.get(Number(state.activeAnnotationId));
		if (id) ids.push(id);
		else issue(context, "selection.missing", "$._editorState.activeAnnotationId", "Selected Annotation was not present in the converted overlays.");
	} else if (state.activeObjectKind !== void 0 && state.activeObjectKind !== null && state.activeObjectKind !== "mask" && state.activeObjectKind !== "annotation") issue(context, "selection.kind", "$._editorState.activeObjectKind", "Unsupported active object state was skipped.");
	return Object.freeze(ids);
}
function migrateV2Snapshot(input, options = {}) {
	var _a;
	const source = requireSource(input, options);
	const context = {
		policy: (_a = options.unsupportedFieldPolicy) !== null && _a !== void 0 ? _a : "error",
		...options.onWarning ? { onWarning: options.onWarning } : {}
	};
	reportUnknownKeys(source, TOP_LEVEL_KEYS, "$", context);
	const state = source._editorState;
	reportUnknownKeys(state, EDITOR_STATE_KEYS, "$._editorState", context);
	const size = dimensions(source, options);
	const objects = sourceObjects(source);
	const base = findBaseImage(objects);
	if (!isFiniteNumber(state.baseImageScale) || state.baseImageScale <= 0) throw new SnapshotMigrationError("base.scale", "Base Image scale must be positive and finite.", "$._editorState.baseImageScale");
	const overlays = [];
	const maskIds = /* @__PURE__ */ new Map();
	const annotationIds = /* @__PURE__ */ new Map();
	let maxMaskId = 0;
	for (let index = 0; index < objects.length; index += 1) {
		const object = objects[index];
		if (object === base) continue;
		let record = null;
		if (object.editorObjectKind === "mask" || Number.isSafeInteger(object.maskId)) {
			record = maskRecord(object, index, context);
			if (record) {
				const id = Number(object.maskId);
				maskIds.set(id, record.persistentId);
				maxMaskId = Math.max(maxMaskId, id);
			}
		} else if (object.editorObjectKind === "annotation" || Number.isSafeInteger(object.annotationId)) {
			record = annotationRecord(object, index, context);
			if (record) annotationIds.set(Number(object.annotationId), record.persistentId);
		} else rejectObject(context, object.editorObjectKind === "session" || object.isCropRect === true || object.maskLabel === true || object.isMosaicPreview === true ? "object.transient" : "object.unsupported", `$.objects[${index}]`, "Unsupported Canvas object was skipped.");
		if (record) overlays.push(record);
	}
	const persistentIds = overlays.map((record) => record.persistentId);
	if (new Set(persistentIds).size !== persistentIds.length) throw new SnapshotMigrationError("overlay.duplicate", "Converted overlays contain duplicate persistent identifiers.", "$.objects");
	if (!base && overlays.length > 0) throw new SnapshotMigrationError("base.missing", "Overlay state cannot be converted without a Base Image.", "$.objects");
	const filters = filterDefinitions(state, base, context);
	const canvasObject = base ? Object.freeze({
		...sanitizedFabricObject(base),
		editorObjectKind: "baseImage",
		filters: Object.freeze([])
	}) : null;
	const canvas = Object.freeze({
		...typeof source.version === "string" ? { version: source.version } : {},
		width: size.width,
		height: size.height,
		...Object.prototype.hasOwnProperty.call(source, "background") ? { background: source.background } : {},
		objects: Object.freeze(canvasObject ? [canvasObject] : [])
	});
	const plugins = { "plugin:transform": Object.freeze({
		version: 1,
		data: transformState(state, base)
	}) };
	if (overlays.length > 0) plugins["foundation:overlay"] = Object.freeze({
		version: 1,
		data: Object.freeze({
			version: 1,
			overlays: Object.freeze(overlays),
			selectionIds: selectionIds(state, maskIds, annotationIds, context)
		})
	});
	if (maxMaskId > 0) plugins["plugin:mask"] = Object.freeze({
		version: 1,
		data: Object.freeze({ counter: maxMaskId })
	});
	if (filters.length > 0) plugins["plugin:filters"] = Object.freeze({
		version: 1,
		data: Object.freeze({
			schema: "image-editor.filters",
			version: 1,
			filters
		})
	});
	return Object.freeze({
		schema: "image-editor.state",
		version: 3,
		core: Object.freeze({
			initialized: true,
			canvasWidth: size.width,
			canvasHeight: size.height,
			canvas,
			imageMimeType: imageMimeType(state, context),
			baseImageScale: state.baseImageScale,
			geometryRevision: 0
		}),
		plugins: Object.freeze(plugins)
	});
}
function v2SnapshotMigration(options = {}) {
	const conversionOptions = Object.freeze({
		...options,
		...options.canvasSize ? { canvasSize: Object.freeze({ ...options.canvasSize }) } : {}
	});
	return Object.freeze({
		sourceSchema: SOURCE_SCHEMA,
		targetSchema: TARGET_SCHEMA,
		canMigrate: (input) => detectSnapshotVersion(input).kind === "source",
		migrate: (input, context) => {
			var _a, _b;
			(_a = context.signal) === null || _a === void 0 || _a.throwIfAborted();
			const snapshot = migrateV2Snapshot(input, conversionOptions);
			(_b = context.signal) === null || _b === void 0 || _b.throwIfAborted();
			return snapshot;
		}
	});
}
async function loadV2Snapshot(editor, input, options = {}) {
	const { missingPluginPolicy = "error", signal, ...conversionOptions } = options;
	await editor.loadFromState(input, {
		missingPluginPolicy,
		migrations: [v2SnapshotMigration(conversionOptions)],
		...signal ? { signal } : {}
	});
}

//#endregion
exports.OverlayStateV1MigrationError = OverlayStateV1MigrationError;
exports.SnapshotMigrationError = SnapshotMigrationError;
exports.detectSnapshotVersion = detectSnapshotVersion;
exports.loadV2Snapshot = loadV2Snapshot;
exports.migrateV1OverlayState = migrateV1OverlayState;
exports.migrateV2Snapshot = migrateV2Snapshot;
exports.v2SnapshotMigration = v2SnapshotMigration;
//# sourceMappingURL=index.cjs.map