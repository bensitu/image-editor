(function(global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ?  factory(exports, require('@bensitu/image-editor/plugins/annotation'), require('@bensitu/image-editor/sdk'), require('@bensitu/image-editor/plugins/overlay')) :
  typeof define === 'function' && define.amd ? define(['exports', '@bensitu/image-editor/plugins/annotation', '@bensitu/image-editor/sdk', '@bensitu/image-editor/plugins/overlay'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory((global.ImageEditorPlugins = global.ImageEditorPlugins || {},global.ImageEditorPlugins.AnnotationDraw = global.ImageEditorPlugins.AnnotationDraw || {}), global.ImageEditorPlugins.Annotation,global.ImageEditor,global.ImageEditorPlugins.Overlay));
})(this, function(exports, _bensitu_image_editor_plugins_annotation, _bensitu_image_editor_sdk, _bensitu_image_editor_plugins_overlay) {
if (Object.prototype.hasOwnProperty.call(exports, "drawAnnotationPlugin")) return;
Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

//#region dist/esm/utils/safe-object-key.js
	function isUnsafeObjectKey(key) {
		return key === "__proto__" || key === "constructor" || key === "prototype";
	}

//#endregion
//#region dist/esm/fabric/safe-fabric-serialization.js
	const SAFE_NESTED_FABRIC_TYPES = /* @__PURE__ */ new Set([
		"linear",
		"pattern",
		"radial",
		"shadow"
	]);
	const RESOURCE_KEYS = /* @__PURE__ */ new Set([
		"href",
		"source",
		"src",
		"url"
	]);
	const DATA_IMAGE_PATTERN = /^data:image\/(?:jpeg|png|webp);base64,[a-z\d+/]+={0,2}$/iu;
	const COMMON_ROOT_PROPERTIES = /* @__PURE__ */ new Set([
		"angle",
		"backgroundColor",
		"fill",
		"fillRule",
		"flipX",
		"flipY",
		"globalCompositeOperation",
		"height",
		"left",
		"opacity",
		"originX",
		"originY",
		"paintFirst",
		"scaleX",
		"scaleY",
		"shadow",
		"skewX",
		"skewY",
		"stroke",
		"strokeDashArray",
		"strokeDashOffset",
		"strokeLineCap",
		"strokeLineJoin",
		"strokeMiterLimit",
		"strokeUniform",
		"strokeWidth",
		"top",
		"type",
		"version",
		"visible",
		"width"
	]);
	const MASK_INTERACTION_PROPERTIES = /* @__PURE__ */ new Set([
		"borderColor",
		"cornerColor",
		"cornerSize",
		"evented",
		"hasControls",
		"lockRotation",
		"selectable",
		"transparentCorners"
	]);
	const ROOT_TYPE_PROPERTIES = Object.freeze({
		rect: /* @__PURE__ */ new Set(["rx", "ry"]),
		circle: /* @__PURE__ */ new Set([
			"counterClockwise",
			"endAngle",
			"radius",
			"startAngle"
		]),
		ellipse: /* @__PURE__ */ new Set(["rx", "ry"]),
		line: /* @__PURE__ */ new Set([
			"x1",
			"x2",
			"y1",
			"y2"
		]),
		path: /* @__PURE__ */ new Set(["path"]),
		polygon: /* @__PURE__ */ new Set(["points"]),
		textbox: /* @__PURE__ */ new Set([
			"charSpacing",
			"direction",
			"editable",
			"fontFamily",
			"fontSize",
			"fontStyle",
			"fontWeight",
			"lineHeight",
			"linethrough",
			"minWidth",
			"overline",
			"path",
			"pathAlign",
			"pathSide",
			"pathStartOffset",
			"splitByGrapheme",
			"styles",
			"text",
			"textAlign",
			"textBackgroundColor",
			"textDecorationThickness",
			"underline"
		])
	});
	function isPlainRecord$1(value) {
		if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
		const prototype = Object.getPrototypeOf(value);
		return prototype === Object.prototype || prototype === null;
	}
	function isSafeSerializedFabricObject(value, options) {
		var _a, _b, _c;
		if (!isPlainRecord$1(value)) return false;
		const rootTypeDescriptor = Object.getOwnPropertyDescriptor(value, "type");
		const rootType = rootTypeDescriptor && "value" in rootTypeDescriptor ? rootTypeDescriptor.value : void 0;
		if (typeof rootType !== "string" || !options.rootTypes.some((type) => type.toLowerCase() === rootType.toLowerCase())) return false;
		const maxDepth = (_a = options.maxDepth) !== null && _a !== void 0 ? _a : 24;
		const maxNodes = (_b = options.maxNodes) !== null && _b !== void 0 ? _b : 2e4;
		const maxArrayLength = (_c = options.maxArrayLength) !== null && _c !== void 0 ? _c : 65536;
		const ancestors = /* @__PURE__ */ new WeakSet();
		let nodes = 0;
		const inspect = (entry, depth, root, propertyName) => {
			var _a;
			if (entry === null || entry === void 0 || typeof entry === "string" || typeof entry === "boolean") {
				if (typeof entry === "string" && propertyName && (RESOURCE_KEYS.has(propertyName.toLowerCase()) || propertyName.toLowerCase().endsWith("url"))) return DATA_IMAGE_PATTERN.test(entry);
				return true;
			}
			if (typeof entry === "number") return Number.isFinite(entry);
			if (typeof entry !== "object" || depth > maxDepth || ancestors.has(entry)) return false;
			nodes += 1;
			if (nodes > maxNodes) return false;
			if (Array.isArray(entry)) {
				if (entry.length > maxArrayLength) return false;
				ancestors.add(entry);
				if (Object.getOwnPropertySymbols(entry).some((key) => {
					var _a;
					return ((_a = Object.getOwnPropertyDescriptor(entry, key)) === null || _a === void 0 ? void 0 : _a.enumerable) === true;
				})) return false;
				if (Object.keys(entry).some((key) => !/^(?:0|[1-9]\d*)$/u.test(key) || Number(key) >= entry.length)) return false;
				for (let index = 0; index < entry.length; index += 1) {
					const descriptor = Object.getOwnPropertyDescriptor(entry, String(index));
					if (!descriptor || !("value" in descriptor)) return false;
					if (!inspect(descriptor.value, depth + 1, false)) return false;
				}
				ancestors.delete(entry);
				return true;
			}
			if (!isPlainRecord$1(entry)) return false;
			const typeDescriptor = Object.getOwnPropertyDescriptor(entry, "type");
			const entryType = typeDescriptor && "value" in typeDescriptor ? typeDescriptor.value : void 0;
			if (!root && typeof entryType === "string") {
				const nestedType = entryType.toLowerCase();
				if (!SAFE_NESTED_FABRIC_TYPES.has(nestedType)) return false;
			}
			if (Object.getOwnPropertySymbols(entry).some((key) => {
				var _a;
				return ((_a = Object.getOwnPropertyDescriptor(entry, key)) === null || _a === void 0 ? void 0 : _a.enumerable) === true;
			})) return false;
			ancestors.add(entry);
			for (const key of Object.keys(entry)) {
				if (isUnsafeObjectKey(key)) return false;
				if (root && !COMMON_ROOT_PROPERTIES.has(key) && !MASK_INTERACTION_PROPERTIES.has(key) && !((_a = ROOT_TYPE_PROPERTIES[rootType.toLowerCase()]) === null || _a === void 0 ? void 0 : _a.has(key))) return false;
				const descriptor = Object.getOwnPropertyDescriptor(entry, key);
				if (!descriptor || !("value" in descriptor)) return false;
				if (key === "clipPath" && descriptor.value !== null && descriptor.value !== void 0) return false;
				if (key === "filters" && (!Array.isArray(descriptor.value) || descriptor.value.length > 0)) return false;
				if (!inspect(descriptor.value, depth + 1, false, key)) return false;
			}
			ancestors.delete(entry);
			return true;
		};
		if (!inspect(value, 0, true)) return false;
		if (rootType.toLowerCase() === "path" && !Array.isArray(value.path)) return false;
		if (rootType.toLowerCase() === "textbox" && value.path !== null && value.path !== void 0) return false;
		return true;
	}

//#endregion
//#region dist/esm/plugins/annotation-draw/draw-path.js
	const MAX_DRAW_COORDINATE = 1e7;
	function normalizeDrawPoint(value) {
		if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError("Draw point must be an object.");
		const point = value;
		if (typeof point.x !== "number" || typeof point.y !== "number" || !Number.isFinite(point.x) || !Number.isFinite(point.y) || Math.abs(point.x) > 1e7 || Math.abs(point.y) > 1e7) throw new TypeError("Draw point coordinates must be finite and bounded.");
		return Object.freeze({
			x: point.x,
			y: point.y
		});
	}
	function appendInterpolatedPoints(target, point, spacing, maximumCount) {
		const previous = target[target.length - 1];
		if (!previous) {
			target.push(point);
			return;
		}
		const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
		if (distance === 0) return;
		const steps = Math.max(1, Math.ceil(distance / spacing));
		if (target.length + steps > maximumCount) throw new RangeError(`Draw stroke exceeds the ${maximumCount}-point limit.`);
		for (let index = 1; index <= steps; index += 1) {
			const ratio = index / steps;
			target.push(Object.freeze({
				x: previous.x + (point.x - previous.x) * ratio,
				y: previous.y + (point.y - previous.y) * ratio
			}));
		}
	}
	function buildCurvedDrawPath(points) {
		const first = points[0];
		if (!first) return "";
		if (points.length === 1) return `M ${first.x} ${first.y} L ${first.x} ${first.y}`;
		if (points.length === 2) {
			const second = points[1];
			return `M ${first.x} ${first.y} L ${second.x} ${second.y}`;
		}
		const commands = [`M ${first.x} ${first.y}`];
		for (let index = 1; index < points.length - 1; index += 1) {
			const control = points[index];
			const next = points[index + 1];
			const midpoint = {
				x: (control.x + next.x) / 2,
				y: (control.y + next.y) / 2
			};
			commands.push(`Q ${control.x} ${control.y} ${midpoint.x} ${midpoint.y}`);
		}
		const penultimate = points[points.length - 2];
		const last = points[points.length - 1];
		commands.push(`Q ${penultimate.x} ${penultimate.y} ${last.x} ${last.y}`);
		return commands.join(" ");
	}
	function transformPathPoint(object, point) {
		var _a;
		const offset = (_a = object.pathOffset) !== null && _a !== void 0 ? _a : {
			x: 0,
			y: 0
		};
		const localX = point.x - (Number(offset.x) || 0);
		const localY = point.y - (Number(offset.y) || 0);
		const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = object.calcTransformMatrix();
		return {
			x: a * localX + c * localY + e,
			y: b * localX + d * localY + f
		};
	}
	function distanceToSegment(point, start, end) {
		const dx = end.x - start.x;
		const dy = end.y - start.y;
		const lengthSquared = dx * dx + dy * dy;
		if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
		const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
		return Math.hypot(point.x - (start.x + ratio * dx), point.y - (start.y + ratio * dy));
	}
	function drawPathIntersects(object, eraserPoints, eraserRadius) {
		var _a;
		const points = object.editorDrawPoints;
		if (!points || points.length < 2 || eraserPoints.length === 0) return false;
		const bounds = object.getBoundingRect();
		const scale = (_a = object.getObjectScaling) === null || _a === void 0 ? void 0 : _a.call(object);
		const hitRadius = eraserRadius + (Number(object.strokeWidth) || 0) * Math.max(Math.abs(Number(scale === null || scale === void 0 ? void 0 : scale.x) || Number(object.scaleX) || 1), Math.abs(Number(scale === null || scale === void 0 ? void 0 : scale.y) || Number(object.scaleY) || 1)) / 2;
		if (!eraserPoints.some((point) => point.x >= bounds.left - hitRadius && point.x <= bounds.left + bounds.width + hitRadius && point.y >= bounds.top - hitRadius && point.y <= bounds.top + bounds.height + hitRadius)) return false;
		const transformed = points.map((point) => transformPathPoint(object, point));
		for (const eraserPoint of eraserPoints) for (let index = 1; index < transformed.length; index += 1) if (distanceToSegment(eraserPoint, transformed[index - 1], transformed[index]) <= hitRadius) return true;
		return false;
	}

//#endregion
//#region dist/esm/plugins/annotation-draw/draw-controller.js
	const DRAW_ANNOTATION_KIND = "annotation:draw";
	const DRAW_PLUGIN_ID = "annotation:draw";
	const MAX_DRAW_OBJECT_BYTES = 512 * 1024;
	function isPlainRecord(value) {
		if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
		const prototype = Object.getPrototypeOf(value);
		return prototype === Object.prototype || prototype === null;
	}
	function finiteRange(value, label, minimum, maximum) {
		if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError(`${label} must be from ${minimum} to ${maximum}.`);
		return value;
	}
	function integerRange(value, label, minimum, maximum) {
		if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError(`${label} must be an integer from ${minimum} to ${maximum}.`);
		return Number(value);
	}
	function booleanValue(value, label) {
		if (typeof value !== "boolean") throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError(`${label} must be boolean.`);
		return value;
	}
	function styleString(value, label, allowEmpty = false) {
		if (typeof value !== "string" || !allowEmpty && value.length === 0 || value.length > 128 || [...value].some((character) => character.charCodeAt(0) < 32)) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError(`${label} is invalid.`);
		return value;
	}
	function lineCap(value) {
		if (value === "butt" || value === "round" || value === "square") return value;
		throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Draw line cap is invalid.");
	}
	function lineJoin(value) {
		if (value === "bevel" || value === "round" || value === "miter") return value;
		throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Draw line join is invalid.");
	}
	function subMode(value) {
		if (value === "brush" || value === "erase") return value;
		throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Draw sub-mode is invalid.");
	}
	const defaultBrush = Object.freeze({
		color: "#111111",
		width: 8,
		opacity: 1,
		lineCap: "round",
		lineJoin: "round",
		selectable: true,
		evented: true,
		bindToImageTransform: false,
		interpolationSpacing: 2,
		maxPointCount: 8192,
		namePrefix: "Draw"
	});
	const defaultEraser = Object.freeze({
		radius: 12,
		previewStroke: "#ffffff",
		previewStrokeWidth: 1,
		previewFill: "rgba(0,0,0,0.15)",
		interpolationSpacing: 4,
		maxPointCount: 8192
	});
	function resolveBrushConfiguration(value = {}, base = defaultBrush) {
		if (!isPlainRecord(value)) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Draw brush configuration must be a plain object.");
		const allowed = new Set(Object.keys(defaultBrush));
		if (Object.keys(value).some((key) => !allowed.has(key))) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Draw brush configuration contains unknown keys.");
		const merged = {
			...base,
			...value
		};
		return Object.freeze({
			color: styleString(merged.color, "Draw color"),
			width: finiteRange(merged.width, "Draw width", .1, 1e3),
			opacity: finiteRange(merged.opacity, "Draw opacity", 0, 1),
			lineCap: lineCap(merged.lineCap),
			lineJoin: lineJoin(merged.lineJoin),
			selectable: booleanValue(merged.selectable, "Draw selectable"),
			evented: booleanValue(merged.evented, "Draw evented"),
			bindToImageTransform: booleanValue(merged.bindToImageTransform, "Draw transform binding"),
			interpolationSpacing: finiteRange(merged.interpolationSpacing, "Draw interpolation spacing", .25, 1e3),
			maxPointCount: integerRange(merged.maxPointCount, "Draw point count limit", 2, 65536),
			namePrefix: styleString(merged.namePrefix, "Draw name prefix")
		});
	}
	function resolveEraserConfiguration(value = {}, base = defaultEraser) {
		if (!isPlainRecord(value)) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Eraser configuration must be a plain object.");
		const allowed = new Set(Object.keys(defaultEraser));
		if (Object.keys(value).some((key) => !allowed.has(key))) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Eraser configuration contains unknown keys.");
		const merged = {
			...base,
			...value
		};
		return Object.freeze({
			radius: finiteRange(merged.radius, "Eraser radius", .5, 2e3),
			previewStroke: styleString(merged.previewStroke, "Eraser preview stroke"),
			previewStrokeWidth: finiteRange(merged.previewStrokeWidth, "Eraser preview stroke width", 0, 100),
			previewFill: styleString(merged.previewFill, "Eraser preview fill", true),
			interpolationSpacing: finiteRange(merged.interpolationSpacing, "Eraser interpolation spacing", .25, 2e3),
			maxPointCount: integerRange(merged.maxPointCount, "Eraser point count limit", 2, 65536)
		});
	}
	function normalizePoints(value, maximumCount) {
		if (!Array.isArray(value) || value.length < 2 || value.length > maximumCount) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Draw path point data is invalid.");
		try {
			return Object.freeze(value.map(normalizeDrawPoint));
		} catch {
			throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Draw path contains an invalid point.");
		}
	}
	function isSerializedDraw(value) {
		if (!isPlainRecord(value)) return false;
		try {
			const objectDescriptor = Object.getOwnPropertyDescriptor(value, "object");
			if (!objectDescriptor || !("value" in objectDescriptor)) return false;
			const serializedObject = objectDescriptor.value;
			if (value.version !== 1 || !isPlainRecord(serializedObject) || !isSafeSerializedFabricObject(serializedObject, { rootTypes: ["path"] })) return false;
			const points = normalizePoints(value.points, 65536);
			const bytes = new TextEncoder().encode(JSON.stringify(serializedObject)).byteLength;
			return points.length >= 2 && bytes <= MAX_DRAW_OBJECT_BYTES && typeof serializedObject.type === "string" && serializedObject.type.toLowerCase() === "path";
		} catch {
			return false;
		}
	}
	function isStatePoint(value) {
		return isPlainRecord(value) && typeof value.x === "number" && Number.isFinite(value.x) && typeof value.y === "number" && Number.isFinite(value.y);
	}
	function isDrawStateGeometry(value) {
		return isPlainRecord(value) && value.type === "path" && Array.isArray(value.points) && value.points.length >= 2 && value.points.length <= 65536 && value.points.every(isStatePoint);
	}
	function isDrawStateData(value) {
		if (!isPlainRecord(value) || value.version !== 1) return false;
		try {
			styleString(value.color, "Draw color");
			finiteRange(value.width, "Draw width ratio", 1e-7, 100);
			finiteRange(value.opacity, "Draw opacity", 0, 1);
			lineCap(value.lineCap);
			lineJoin(value.lineJoin);
			return Object.keys(value).every((key) => [
				"version",
				"color",
				"width",
				"opacity",
				"lineCap",
				"lineJoin"
			].includes(key));
		} catch {
			return false;
		}
	}
	var DrawAnnotationController = class {
		constructor(host, authoring, options) {
			Object.defineProperty(this, "host", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: host
			});
			Object.defineProperty(this, "authoring", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: authoring
			});
			Object.defineProperty(this, "brush", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: void 0
			});
			Object.defineProperty(this, "eraser", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: void 0
			});
			Object.defineProperty(this, "session", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: null
			});
			Object.defineProperty(this, "previewSequence", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: 0
			});
			Object.defineProperty(this, "nameSequence", {
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
			if (!isPlainRecord(options)) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Draw options must be a plain object.");
			if (Object.keys(options).some((key) => key !== "brush" && key !== "eraser")) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Draw options contain unknown keys.");
			this.brush = resolveBrushConfiguration(options.brush);
			this.eraser = resolveEraserConfiguration(options.eraser);
		}
		featureDefinition() {
			return Object.freeze({
				kind: DRAW_ANNOTATION_KIND,
				ownerPluginId: DRAW_PLUGIN_ID,
				classify: (object) => object instanceof this.host.fabric.Path && Array.isArray(object.editorDrawPoints),
				codec: {
					type: "annotation:draw-path",
					version: "1.0.0",
					serialize: (object) => {
						return Object.freeze({
							version: 1,
							points: object.editorDrawPoints,
							object: object.toObject()
						});
					},
					validate: isSerializedDraw,
					deserialize: async (value, context) => {
						if (!isSerializedDraw(value)) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Serialized Draw data is malformed.");
						const object = (await context.fabric.util.enlivenObjects([value.object]))[0];
						if (!(object instanceof context.fabric.Path)) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Fabric did not restore a Draw path.");
						object.editorDrawPoints = normalizePoints(value.points, this.brush.maxPointCount);
						return object;
					}
				},
				stateCodec: {
					type: "annotation:draw",
					version: "1.0.0",
					serialize: (object, context) => {
						var _a, _b;
						const points = normalizePoints(object.editorDrawPoints, 65536).map((point) => Object.freeze(context.toImageNormalized((0, _bensitu_image_editor_plugins_overlay.objectPointToCanvas)(object, point))));
						return Object.freeze({
							geometry: Object.freeze({
								type: "path",
								points: Object.freeze(points)
							}),
							data: Object.freeze({
								version: 1,
								color: typeof object.stroke === "string" ? object.stroke : "#111111",
								width: context.toImageNormalizedScalar(Number(object.strokeWidth) || .1),
								opacity: Number.isFinite(object.opacity) ? object.opacity : 1,
								lineCap: (_a = object.strokeLineCap) !== null && _a !== void 0 ? _a : "round",
								lineJoin: (_b = object.strokeLineJoin) !== null && _b !== void 0 ? _b : "round"
							})
						});
					},
					validate: (value) => isDrawStateGeometry(value.geometry) && isDrawStateData(value.data),
					deserialize: (value, context) => {
						if (!isDrawStateGeometry(value.geometry) || !isDrawStateData(value.data)) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Serialized Draw Annotation State data is malformed.");
						const points = Object.freeze(value.geometry.points.map((point) => Object.freeze(context.toCanvasPoint(point))));
						const object = new this.host.fabric.Path(buildCurvedDrawPath(points), {
							fill: "",
							stroke: value.data.color,
							strokeWidth: context.toCanvasScalar(value.data.width),
							opacity: value.data.opacity,
							strokeLineCap: value.data.lineCap,
							strokeLineJoin: value.data.lineJoin,
							objectCaching: false
						});
						object.editorDrawPoints = points;
						return object;
					}
				},
				bindToImageTransform: () => this.brush.bindToImageTransform
			});
		}
		enter(options = {}) {
			var _a;
			this.assertActive("enter Draw");
			this.assertImageLoaded();
			if (this.session) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("A Draw session is already active.");
			if (!isPlainRecord(options)) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Draw enter options must be a plain object.");
			if (Object.keys(options).some((key) => key !== "subMode")) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Draw enter options contain unknown keys.");
			this.session = {
				subMode: subMode((_a = options.subMode) !== null && _a !== void 0 ? _a : "brush"),
				points: [],
				previewId: null
			};
		}
		setSubMode(mode) {
			const session = this.requireSession("set Draw sub-mode");
			const normalized = subMode(mode);
			if (session.subMode === normalized) return;
			this.clearStroke(session);
			session.subMode = normalized;
		}
		beginStroke(value) {
			const session = this.requireSession("begin Draw stroke");
			if (session.points.length > 0) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("A Draw stroke is already active.");
			let point;
			try {
				point = normalizeDrawPoint(value);
			} catch {
				throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Draw point coordinates must be finite and bounded.");
			}
			session.points = [point];
			this.refreshPreview(session);
		}
		appendStroke(value) {
			const session = this.requireActiveStroke("append Draw stroke");
			let point;
			try {
				point = normalizeDrawPoint(value);
			} catch {
				throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Draw point coordinates must be finite and bounded.");
			}
			const configuration = session.subMode === "brush" ? this.brush : this.eraser;
			try {
				appendInterpolatedPoints(session.points, point, configuration.interpolationSpacing, configuration.maxPointCount);
			} catch (error) {
				throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError(error instanceof Error ? error.message : "Draw point limit was exceeded.");
			}
			this.refreshPreview(session);
		}
		async endStroke() {
			const session = this.requireActiveStroke("end Draw stroke");
			const points = Object.freeze([...session.points]);
			const mode = session.subMode;
			this.clearStroke(session);
			if (!this.isMeaningfulStroke(points)) return null;
			if (mode === "erase") {
				const ids = this.intersectedDrawIds(points);
				if (ids.length === 0) return null;
				await this.authoring.removeFeatures({
					ids,
					kind: DRAW_ANNOTATION_KIND,
					operationId: "annotation-draw:commit-erase"
				});
				return null;
			}
			const object = this.createPath(points);
			return this.authoring.create({
				kind: DRAW_ANNOTATION_KIND,
				object,
				name: `${this.brush.namePrefix} ${++this.nameSequence}`,
				operationId: "annotation-draw:commit-stroke"
			});
		}
		cancelStroke() {
			const session = this.requireSession("cancel Draw stroke");
			this.clearStroke(session);
		}
		exit() {
			this.assertActive("exit Draw");
			if (!this.session) return;
			this.clearStroke(this.session);
			this.session = null;
		}
		configureBrush(patch) {
			var _a;
			this.assertActive("configure Draw brush");
			if ((_a = this.session) === null || _a === void 0 ? void 0 : _a.points.length) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Cancel the active Draw stroke before configuring it.");
			this.brush = resolveBrushConfiguration(patch, this.brush);
		}
		configureEraser(patch) {
			var _a;
			this.assertActive("configure Eraser");
			if ((_a = this.session) === null || _a === void 0 ? void 0 : _a.points.length) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Cancel the active Eraser stroke before configuring it.");
			this.eraser = resolveEraserConfiguration(patch, this.eraser);
		}
		getConfiguration() {
			this.assertActive("read Draw configuration");
			return Object.freeze({
				brush: this.brush,
				eraser: this.eraser
			});
		}
		getSession() {
			this.assertActive("read Draw session");
			return this.session ? Object.freeze({
				subMode: this.session.subMode,
				isStrokeActive: this.session.points.length > 0,
				pointCount: this.session.points.length
			}) : null;
		}
		closeForImage() {
			if (this.session) this.exit();
		}
		dispose() {
			if (this.disposed) return;
			if (this.session) this.exit();
			this.disposed = true;
		}
		createPath(points) {
			const object = new this.host.fabric.Path(buildCurvedDrawPath(points), {
				fill: "",
				stroke: this.brush.color,
				strokeWidth: this.brush.width,
				opacity: this.brush.opacity,
				strokeLineCap: this.brush.lineCap,
				strokeLineJoin: this.brush.lineJoin,
				selectable: this.brush.selectable,
				evented: this.brush.evented,
				objectCaching: false
			});
			object.editorDrawPoints = Object.freeze([...points]);
			return object;
		}
		refreshPreview(session) {
			let preview;
			if (session.subMode === "brush") preview = this.createPath(session.points);
			else {
				const point = session.points[session.points.length - 1];
				preview = new this.host.fabric.Circle({
					left: point.x,
					top: point.y,
					radius: this.eraser.radius,
					originX: "center",
					originY: "center",
					fill: this.eraser.previewFill,
					stroke: this.eraser.previewStroke,
					strokeWidth: this.eraser.previewStrokeWidth,
					objectCaching: false
				});
			}
			const previewId = `annotation-draw:preview:${++this.previewSequence}`;
			this.authoring.replacePreview(session.previewId ? [session.previewId] : [], {
				id: previewId,
				ownerKind: DRAW_ANNOTATION_KIND,
				object: preview
			});
			session.previewId = previewId;
		}
		intersectedDrawIds(points) {
			const ids = [];
			for (const object of this.authoring.listObjects(DRAW_ANNOTATION_KIND)) {
				const draw = object;
				if (draw.editorOverlayHidden || draw.editorOverlayLocked) continue;
				if (drawPathIntersects(draw, points, this.eraser.radius)) {
					const id = Reflect.get(draw, "editorOverlayId");
					if (typeof id === "string") ids.push(id);
				}
			}
			return Object.freeze(ids);
		}
		isMeaningfulStroke(points) {
			if (points.length < 2) return false;
			const first = points[0];
			return points.some((point) => Math.hypot(point.x - first.x, point.y - first.y) >= .5);
		}
		clearStroke(session) {
			if (session.previewId) this.authoring.removePreview([session.previewId]);
			session.previewId = null;
			session.points = [];
		}
		requireSession(operation) {
			this.assertActive(operation);
			if (!this.session) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError(`Cannot ${operation} without a Draw session.`);
			return this.session;
		}
		requireActiveStroke(operation) {
			const session = this.requireSession(operation);
			if (session.points.length === 0) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError(`Cannot ${operation} without an active stroke.`);
			return session;
		}
		assertImageLoaded() {
			if (!this.host.isImageLoaded()) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Draw Annotation requires a loaded image.");
		}
		assertActive(operation) {
			if (this.disposed) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError(`Cannot ${operation} after disposal.`);
		}
	};

//#endregion
//#region dist/esm/plugins/annotation-draw/index.js
	const DRAW_TOOL_ID = "annotation:draw";
	const drawAnnotationPluginRef = (0, _bensitu_image_editor_sdk.definePluginRef)("annotation:draw", "1.0.0");
	function drawAnnotationPlugin(options = {}) {
		const initialOptions = Object.freeze({
			brush: resolveBrushConfiguration(options.brush),
			eraser: resolveEraserConfiguration(options.eraser)
		});
		let controller = null;
		return (0, _bensitu_image_editor_sdk.definePlugin)({
			ref: drawAnnotationPluginRef,
			manifest: {
				id: drawAnnotationPluginRef.id,
				version: "1.0.0",
				apiVersion: drawAnnotationPluginRef.apiVersion,
				engine: "^3.0.0",
				requiresPlugins: [_bensitu_image_editor_plugins_annotation.annotationFoundationRef],
				requires: [
					{
						token: _bensitu_image_editor_plugins_annotation.ANNOTATION_AUTHORING_CAPABILITY,
						range: "^1.0.0"
					},
					{
						token: _bensitu_image_editor_sdk.CORE_DIAGNOSTICS_CAPABILITY,
						range: "^1.0.0"
					},
					{
						token: _bensitu_image_editor_sdk.FABRIC_RUNTIME_CAPABILITY,
						range: "^1.0.0"
					},
					{
						token: _bensitu_image_editor_sdk.BASE_IMAGE_INFO_CAPABILITY,
						range: "^1.0.0"
					}
				],
				permissions: ["fabric:objects"]
			},
			setupMode: "sync",
			setup(context) {
				const authoring = context.capabilities.require(_bensitu_image_editor_plugins_annotation.ANNOTATION_AUTHORING_CAPABILITY);
				const diagnostics = context.capabilities.require(_bensitu_image_editor_sdk.CORE_DIAGNOSTICS_CAPABILITY);
				const fabric = context.capabilities.require(_bensitu_image_editor_sdk.FABRIC_RUNTIME_CAPABILITY);
				const image = context.capabilities.require(_bensitu_image_editor_sdk.BASE_IMAGE_INFO_CAPABILITY);
				controller = new DrawAnnotationController(Object.freeze({
					...diagnostics,
					...fabric,
					...image
				}), authoring, initialOptions);
				context.disposables.add(authoring.registerFeature(controller.featureDefinition()));
				for (const operationId of ["annotation-draw:commit-stroke", "annotation-draw:commit-erase"]) context.disposables.add(context.operations.register({
					id: operationId,
					mode: "mutation",
					conflictDomains: [
						"document",
						"overlay",
						"selection",
						"state"
					],
					reentrancy: "reject"
				}));
				for (const operationId of [
					"annotation-draw:enter",
					"annotation-draw:set-sub-mode",
					"annotation-draw:begin-stroke",
					"annotation-draw:append-stroke",
					"annotation-draw:cancel-stroke",
					"annotation-draw:exit",
					"annotation-draw:configure-brush",
					"annotation-draw:configure-eraser"
				]) context.disposables.add(context.operations.register({
					id: operationId,
					mode: "busy",
					conflictDomains: [
						"overlay",
						"selection",
						"state"
					],
					reentrancy: "queue"
				}));
				context.disposables.add(context.tools.register({
					id: DRAW_TOOL_ID,
					enter: () => void 0,
					exit: () => controller === null || controller === void 0 ? void 0 : controller.exit(),
					canRunOperation: (operationId) => operationId.startsWith("annotation-draw:") || operationId.startsWith("annotation:") || operationId.endsWith(":enter") || operationId === "crop:enter" || operationId === "mosaic:enter" || operationId === "core:load-image" || operationId === "core:commit-load-image" || operationId === "core:load-state" || operationId === "core:export" || operationId === "history:undo" || operationId === "history:redo"
				}));
				const requireController = () => {
					if (!controller) throw new Error("Draw Annotation Plugin is not installed.");
					return controller;
				};
				return Object.freeze({
					enter: (enterOptions = {}) => context.operations.run("annotation-draw:enter", enterOptions, async (value) => {
						await context.tools.enter(DRAW_TOOL_ID);
						try {
							requireController().enter(value);
						} catch (error) {
							await context.tools.exit("operation");
							throw error;
						}
					}),
					setSubMode: (mode) => context.operations.run("annotation-draw:set-sub-mode", mode, (value) => requireController().setSubMode(value)),
					beginStroke: (point) => context.operations.run("annotation-draw:begin-stroke", point, (value) => requireController().beginStroke(value)),
					appendStroke: (point) => context.operations.run("annotation-draw:append-stroke", point, (value) => requireController().appendStroke(value)),
					endStroke: () => requireController().endStroke(),
					cancelStroke: () => context.operations.run("annotation-draw:cancel-stroke", void 0, () => requireController().cancelStroke()),
					exit: () => context.operations.run("annotation-draw:exit", void 0, async () => {
						requireController().exit();
						if (context.tools.getActiveToolId() === DRAW_TOOL_ID) await context.tools.exit("requested");
					}),
					configureBrush: (patch) => context.operations.run("annotation-draw:configure-brush", patch, (value) => requireController().configureBrush(value)),
					configureEraser: (patch) => context.operations.run("annotation-draw:configure-eraser", patch, (value) => requireController().configureEraser(value)),
					getConfiguration: () => requireController().getConfiguration(),
					getSession: () => requireController().getSession()
				});
			},
			onImageCleared(context) {
				if (context.tools.getActiveToolId() === DRAW_TOOL_ID) return context.tools.exit("operation");
				controller === null || controller === void 0 || controller.closeForImage();
			},
			onDispose() {
				controller === null || controller === void 0 || controller.dispose();
				controller = null;
			}
		});
	}

//#endregion
exports.drawAnnotationPlugin = drawAnnotationPlugin;
exports.drawAnnotationPluginRef = drawAnnotationPluginRef;
});
//# sourceMappingURL=image-editor.plugin.annotation-draw.umd.js.map