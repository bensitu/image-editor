(function(global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ?  factory(exports, require('@bensitu/image-editor/plugins/annotation'), require('@bensitu/image-editor/sdk'), require('@bensitu/image-editor/plugins/overlay')) :
  typeof define === 'function' && define.amd ? define(['exports', '@bensitu/image-editor/plugins/annotation', '@bensitu/image-editor/sdk', '@bensitu/image-editor/plugins/overlay'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory((global.ImageEditorPlugins = global.ImageEditorPlugins || {},global.ImageEditorPlugins.AnnotationShape = global.ImageEditorPlugins.AnnotationShape || {}), global.ImageEditorPlugins.Annotation,global.ImageEditor,global.ImageEditorPlugins.Overlay));
})(this, function(exports, _bensitu_image_editor_plugins_annotation, _bensitu_image_editor_sdk, _bensitu_image_editor_plugins_overlay) {
if (Object.prototype.hasOwnProperty.call(exports, "shapeAnnotationPlugin")) return;
Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
//#region dist/esm/utils/internal-operation-conflict-domains.js
	const DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS = Object.freeze([
		"document",
		"base-image",
		"geometry",
		"raster",
		"overlay",
		"state"
	]);
	const GEOMETRY_MUTATION_CONFLICT_DOMAINS = Object.freeze([
		"document",
		"base-image",
		"geometry",
		"overlay",
		"state"
	]);
	const PERSISTENT_OVERLAY_MUTATION_CONFLICT_DOMAINS = Object.freeze([
		"document",
		"overlay",
		"selection",
		"state"
	]);
	const OVERLAY_AUTHORING_SESSION_CONFLICT_DOMAINS = Object.freeze([
		"overlay",
		"selection",
		"state"
	]);

//#endregion
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
		polyline: /* @__PURE__ */ new Set(["points"]),
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
//#region dist/esm/plugins/annotation-shape/shape-controller.js
	const SHAPE_ANNOTATION_KIND = "annotation:shape";
	const SHAPE_PLUGIN_ID = "annotation:shape";
	const MAX_COORDINATE = 1e7;
	const MAX_SHAPE_OBJECT_BYTES = 262144;
	const MIN_GEOMETRY_SIZE = .5;
	function isPlainRecord(value) {
		if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
		const prototype = Object.getPrototypeOf(value);
		return prototype === Object.prototype || prototype === null;
	}
	function finiteRange(value, label, minimum, maximum) {
		if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError(`${label} must be from ${minimum} to ${maximum}.`);
		return value;
	}
	function booleanValue(value, label) {
		if (typeof value !== "boolean") throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError(`${label} must be boolean.`);
		return value;
	}
	function styleString(value, label, allowEmpty = false) {
		if (typeof value !== "string" || !allowEmpty && value.length === 0 || value.length > 128 || [...value].some((character) => character.charCodeAt(0) < 32)) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError(`${label} is invalid.`);
		return value;
	}
	function dashArray(value) {
		if (value === null) return null;
		const entries = Array.isArray(value) ? Array.from(value) : null;
		if (!entries || entries.length > 16 || entries.some((entry) => typeof entry !== "number" || !Number.isFinite(entry) || entry < 0 || entry > 1e3)) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Shape stroke dash array is invalid.");
		return Object.freeze(entries.map((entry) => finiteRange(entry, "Shape stroke dash entry", 0, 1e3)));
	}
	function shapeKind(value) {
		if (value === "rect" || value === "line" || value === "arrow") return value;
		throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Shape kind is invalid.");
	}
	function point(value, label) {
		if (!isPlainRecord(value)) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError(`${label} is invalid.`);
		return Object.freeze({
			x: finiteRange(value.x, `${label} x`, -1e7, MAX_COORDINATE),
			y: finiteRange(value.y, `${label} y`, -1e7, MAX_COORDINATE)
		});
	}
	function normalizeShapeGeometry(value) {
		if (!isPlainRecord(value)) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Shape geometry must be a plain object.");
		const kind = shapeKind(value.kind);
		if (kind === "rect") return Object.freeze({
			kind,
			left: finiteRange(value.left, "Shape left", -1e7, MAX_COORDINATE),
			top: finiteRange(value.top, "Shape top", -1e7, MAX_COORDINATE),
			width: finiteRange(value.width, "Shape width", MIN_GEOMETRY_SIZE, MAX_COORDINATE),
			height: finiteRange(value.height, "Shape height", MIN_GEOMETRY_SIZE, MAX_COORDINATE)
		});
		const start = point(value.start, "Shape start point");
		const end = point(value.end, "Shape end point");
		if (Math.hypot(end.x - start.x, end.y - start.y) < MIN_GEOMETRY_SIZE) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Shape line and arrow endpoints must be distinct.");
		return Object.freeze({
			kind,
			start,
			end
		});
	}
	const defaultConfiguration = Object.freeze({
		stroke: "#111111",
		strokeWidth: 3,
		fill: "rgba(0,0,0,0)",
		opacity: 1,
		strokeDashArray: null,
		arrowHeadLength: 16,
		selectable: true,
		evented: true,
		bindToImageTransform: false,
		namePrefix: "Shape"
	});
	function resolveShapeConfiguration(value = {}, base = defaultConfiguration) {
		if (!isPlainRecord(value)) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Shape configuration must be a plain object.");
		const allowed = new Set(Object.keys(defaultConfiguration));
		if (Object.keys(value).some((key) => !allowed.has(key))) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Shape configuration contains unknown keys.");
		const merged = {
			...base,
			...value
		};
		return Object.freeze({
			stroke: styleString(merged.stroke, "Shape stroke"),
			strokeWidth: finiteRange(merged.strokeWidth, "Shape stroke width", .1, 1e3),
			fill: styleString(merged.fill, "Shape fill", true),
			opacity: finiteRange(merged.opacity, "Shape opacity", 0, 1),
			strokeDashArray: dashArray(merged.strokeDashArray),
			arrowHeadLength: finiteRange(merged.arrowHeadLength, "Arrow head length", 1, 1e3),
			selectable: booleanValue(merged.selectable, "Shape selectable"),
			evented: booleanValue(merged.evented, "Shape evented"),
			bindToImageTransform: booleanValue(merged.bindToImageTransform, "Shape transform binding"),
			namePrefix: styleString(merged.namePrefix, "Shape name prefix")
		});
	}
	function normalizeFeatureUpdate(value) {
		if (!isPlainRecord(value)) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Shape update must be a plain object.");
		const allowed = /* @__PURE__ */ new Set([
			"stroke",
			"strokeWidth",
			"fill",
			"opacity",
			"strokeDashArray"
		]);
		if (Object.keys(value).some((key) => !allowed.has(key))) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Shape update contains unknown keys.");
		return Object.freeze({
			...value.stroke !== void 0 ? { stroke: styleString(value.stroke, "Shape stroke") } : {},
			...value.strokeWidth !== void 0 ? { strokeWidth: finiteRange(value.strokeWidth, "Shape stroke width", .1, 1e3) } : {},
			...value.fill !== void 0 ? { fill: styleString(value.fill, "Shape fill", true) } : {},
			...value.opacity !== void 0 ? { opacity: finiteRange(value.opacity, "Shape opacity", 0, 1) } : {},
			...value.strokeDashArray !== void 0 ? { strokeDashArray: dashArray(value.strokeDashArray) } : {}
		});
	}
	function sharedUpdate(value) {
		return Object.freeze({
			...value.name !== void 0 ? { name: value.name } : {},
			...value.metadata !== void 0 ? { metadata: value.metadata } : {},
			...value.hidden !== void 0 ? { hidden: value.hidden } : {},
			...value.locked !== void 0 ? { locked: value.locked } : {}
		});
	}
	function buildArrowPath(geometry, headLength) {
		const angle = Math.atan2(geometry.end.y - geometry.start.y, geometry.end.x - geometry.start.x);
		const wing = Math.PI / 7;
		const first = {
			x: geometry.end.x - headLength * Math.cos(angle - wing),
			y: geometry.end.y - headLength * Math.sin(angle - wing)
		};
		const second = {
			x: geometry.end.x - headLength * Math.cos(angle + wing),
			y: geometry.end.y - headLength * Math.sin(angle + wing)
		};
		return `M ${geometry.start.x} ${geometry.start.y} L ${geometry.end.x} ${geometry.end.y} M ${geometry.end.x} ${geometry.end.y} L ${first.x} ${first.y} M ${geometry.end.x} ${geometry.end.y} L ${second.x} ${second.y}`;
	}
	function isStatePoint(value) {
		return isPlainRecord(value) && typeof value.x === "number" && Number.isFinite(value.x) && typeof value.y === "number" && Number.isFinite(value.y);
	}
	function isShapeStateGeometry(value) {
		if (!isPlainRecord(value)) return false;
		if (value.kind === "rect") return (0, _bensitu_image_editor_plugins_overlay.isOverlayStateBoundsGeometry)(value.bounds);
		return (value.kind === "line" || value.kind === "arrow") && isStatePoint(value.start) && isStatePoint(value.end);
	}
	function isShapeStateData(value) {
		if (!isPlainRecord(value) || value.version !== 1) return false;
		try {
			styleString(value.stroke, "Shape stroke");
			finiteRange(value.strokeWidth, "Shape stroke width ratio", 1e-7, 100);
			styleString(value.fill, "Shape fill", true);
			finiteRange(value.opacity, "Shape opacity", 0, 1);
			dashArray(value.strokeDashArray);
			finiteRange(value.arrowHeadLength, "Arrow head ratio", 1e-7, 100);
			return Object.keys(value).every((key) => [
				"version",
				"stroke",
				"strokeWidth",
				"fill",
				"opacity",
				"strokeDashArray",
				"arrowHeadLength"
			].includes(key));
		} catch {
			return false;
		}
	}
	function isSerializedShape(value) {
		if (!isPlainRecord(value)) return false;
		try {
			const objectDescriptor = Object.getOwnPropertyDescriptor(value, "object");
			if (!objectDescriptor || !("value" in objectDescriptor)) return false;
			const serializedObject = objectDescriptor.value;
			if (value.version !== 1 || !isPlainRecord(serializedObject) || !isSafeSerializedFabricObject(serializedObject, { rootTypes: [
				"rect",
				"line",
				"polyline",
				"path"
			] })) return false;
			const geometry = normalizeShapeGeometry(value.geometry);
			const bytes = new TextEncoder().encode(JSON.stringify(serializedObject)).byteLength;
			const type = typeof serializedObject.type === "string" ? serializedObject.type.toLowerCase() : "";
			return bytes <= MAX_SHAPE_OBJECT_BYTES && geometry.kind === value.shapeKind && (geometry.kind === "rect" && type === "rect" || geometry.kind === "line" && (type === "line" || type === "polyline") || geometry.kind === "arrow" && type === "path");
		} catch {
			return false;
		}
	}
	var ShapeAnnotationController = class {
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
			Object.defineProperty(this, "configuration", {
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
			Object.defineProperty(this, "nameSequence", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: 0
			});
			Object.defineProperty(this, "previewSequence", {
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
			this.configuration = resolveShapeConfiguration(options);
		}
		featureDefinition() {
			return Object.freeze({
				kind: SHAPE_ANNOTATION_KIND,
				ownerPluginId: SHAPE_PLUGIN_ID,
				classify: (object) => {
					const shape = object;
					return shape.editorShapeKind === "rect" && object instanceof this.host.fabric.Rect || shape.editorShapeKind === "line" && object.isType("Line", "line", "Polyline", "polyline") || shape.editorShapeKind === "arrow" && object instanceof this.host.fabric.Path;
				},
				codec: {
					type: "annotation:shape-object",
					version: "1.0.0",
					serialize: (object) => {
						const shape = object;
						return Object.freeze({
							version: 1,
							shapeKind: shape.editorShapeKind,
							geometry: shape.editorShapeGeometry,
							object: object.toObject()
						});
					},
					validate: isSerializedShape,
					deserialize: async (value, context) => {
						if (!isSerializedShape(value)) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Serialized Shape data is malformed.");
						const object = (await context.fabric.util.enlivenObjects([value.object]))[0];
						if (!object) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Fabric did not restore a Shape.");
						object.editorShapeKind = value.shapeKind;
						object.editorShapeGeometry = normalizeShapeGeometry(value.geometry);
						return object;
					}
				},
				stateCodec: {
					type: "annotation:shape",
					version: "1.0.0",
					serialize: (object, context) => {
						const geometry = normalizeShapeGeometry(object.editorShapeGeometry);
						const stateGeometry = geometry.kind === "rect" ? Object.freeze({
							kind: "rect",
							bounds: (0, _bensitu_image_editor_plugins_overlay.captureOverlayStateBounds)(object, context)
						}) : Object.freeze({
							kind: geometry.kind,
							start: Object.freeze(context.toImageNormalized((0, _bensitu_image_editor_plugins_overlay.objectPointToCanvas)(object, geometry.start))),
							end: Object.freeze(context.toImageNormalized((0, _bensitu_image_editor_plugins_overlay.objectPointToCanvas)(object, geometry.end)))
						});
						const strokeDashArray = Array.isArray(object.strokeDashArray) ? Object.freeze(object.strokeDashArray.map((entry) => context.toImageNormalizedScalar(entry))) : null;
						return Object.freeze({
							geometry: stateGeometry,
							data: Object.freeze({
								version: 1,
								stroke: typeof object.stroke === "string" ? object.stroke : "#111111",
								strokeWidth: context.toImageNormalizedScalar(Number(object.strokeWidth) || .1),
								fill: typeof object.fill === "string" ? object.fill : "",
								opacity: Number.isFinite(object.opacity) ? object.opacity : 1,
								strokeDashArray,
								arrowHeadLength: context.toImageNormalizedScalar(this.configuration.arrowHeadLength)
							})
						});
					},
					validate: (value) => isShapeStateGeometry(value.geometry) && isShapeStateData(value.data),
					deserialize: (value, context) => {
						if (!isShapeStateGeometry(value.geometry) || !isShapeStateData(value.data)) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Serialized Shape Annotation State data is malformed.");
						const data = value.data;
						const common = {
							stroke: data.stroke,
							strokeWidth: context.toCanvasScalar(data.strokeWidth),
							fill: data.fill,
							opacity: data.opacity,
							strokeDashArray: data.strokeDashArray ? data.strokeDashArray.map((entry) => context.toCanvasScalar(entry)) : null,
							arrowHeadLength: context.toCanvasScalar(data.arrowHeadLength)
						};
						if (value.geometry.kind === "rect") {
							const geometry = {
								kind: "rect",
								left: 0,
								top: 0,
								width: 1,
								height: 1
							};
							const object = this.createObject(geometry, {
								geometry,
								...common
							});
							(0, _bensitu_image_editor_plugins_overlay.restoreOverlayStateBounds)(object, value.geometry.bounds, context, this.host.fabric);
							return object;
						}
						const geometry = {
							kind: value.geometry.kind,
							start: context.toCanvasPoint(value.geometry.start),
							end: context.toCanvasPoint(value.geometry.end)
						};
						return this.createObject(geometry, {
							geometry,
							...common
						});
					}
				},
				normalizeUpdate: normalizeFeatureUpdate,
				hasUpdate: (object, patch) => Object.entries(patch).some(([key, value]) => {
					const current = Reflect.get(object, key);
					return Array.isArray(value) ? JSON.stringify(current) !== JSON.stringify(value) : !Object.is(current, value);
				}),
				applyUpdate: (object, patch) => {
					object.set({
						...patch,
						...patch.strokeDashArray ? { strokeDashArray: [...patch.strokeDashArray] } : {}
					});
					object.setCoords();
				},
				bindToImageTransform: () => this.configuration.bindToImageTransform
			});
		}
		enter(options) {
			this.assertActive("enter Shape");
			this.assertImageLoaded();
			if (this.session) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("A Shape session is already active.");
			if (!isPlainRecord(options)) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Shape session options must be a plain object.");
			shapeKind(options.kind);
			this.resolveStyle(options);
			this.session = {
				options: Object.freeze({ ...options }),
				geometry: null,
				previewId: null
			};
		}
		updatePreview(geometryInput) {
			const session = this.requireSession("update Shape preview");
			const geometry = normalizeShapeGeometry(geometryInput);
			if (geometry.kind !== session.options.kind) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Shape preview kind does not match the session.");
			this.replaceSessionPreview(session, geometry);
		}
		replaceSessionPreview(session, geometry) {
			const preview = this.createObject(geometry, session.options);
			const previewId = `annotation-shape:preview:${++this.previewSequence}`;
			this.authoring.replacePreview(session.previewId ? [session.previewId] : [], {
				id: previewId,
				ownerKind: SHAPE_ANNOTATION_KIND,
				object: preview
			});
			session.geometry = geometry;
			session.previewId = previewId;
		}
		async commit() {
			const session = this.requireSession("commit Shape");
			if (!session.geometry) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Shape commit requires preview geometry.");
			const definition = {
				...session.options,
				geometry: session.geometry
			};
			this.closeSession();
			return this.createDefinition(definition, "annotation-shape:commit");
		}
		cancel() {
			this.assertActive("cancel Shape");
			if (this.session) this.closeSession();
		}
		create(definition) {
			return this.createDefinition(definition, "annotation-shape:create");
		}
		createDefinition(definition, operationId) {
			var _a;
			this.assertActive("create Shape");
			this.assertImageLoaded();
			if (!isPlainRecord(definition)) return Promise.reject(new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Shape definition must be a plain object."));
			const geometry = normalizeShapeGeometry(definition.geometry);
			const object = this.createObject(geometry, definition);
			return this.authoring.create({
				kind: SHAPE_ANNOTATION_KIND,
				object,
				name: (_a = definition.name) !== null && _a !== void 0 ? _a : `${this.configuration.namePrefix} ${++this.nameSequence}`,
				...definition.metadata === void 0 ? {} : { metadata: definition.metadata },
				...definition.hidden === void 0 ? {} : { hidden: definition.hidden },
				...definition.locked === void 0 ? {} : { locked: definition.locked },
				...definition.select === void 0 ? {} : { select: definition.select },
				operationId
			});
		}
		update(id, patch) {
			this.assertActive("update Shape");
			if (!isPlainRecord(patch)) return Promise.reject(new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Shape update must be an object."));
			const featurePatch = normalizeFeatureUpdate({
				...patch.stroke !== void 0 ? { stroke: patch.stroke } : {},
				...patch.strokeWidth !== void 0 ? { strokeWidth: patch.strokeWidth } : {},
				...patch.fill !== void 0 ? { fill: patch.fill } : {},
				...patch.opacity !== void 0 ? { opacity: patch.opacity } : {},
				...patch.strokeDashArray !== void 0 ? { strokeDashArray: patch.strokeDashArray } : {}
			});
			return this.authoring.updateFeature({
				id,
				kind: SHAPE_ANNOTATION_KIND,
				patch: featurePatch,
				shared: sharedUpdate(patch),
				operationId: "annotation-shape:update"
			});
		}
		configure(patch) {
			this.assertActive("configure Shape");
			this.configuration = resolveShapeConfiguration(patch, this.configuration);
			const session = this.session;
			if (!session) return;
			const sessionPatch = {
				...patch.stroke !== void 0 ? { stroke: this.configuration.stroke } : {},
				...patch.strokeWidth !== void 0 ? { strokeWidth: this.configuration.strokeWidth } : {},
				...patch.fill !== void 0 ? { fill: this.configuration.fill } : {},
				...patch.opacity !== void 0 ? { opacity: this.configuration.opacity } : {},
				...patch.strokeDashArray !== void 0 ? { strokeDashArray: this.configuration.strokeDashArray } : {},
				...patch.arrowHeadLength !== void 0 ? { arrowHeadLength: this.configuration.arrowHeadLength } : {},
				...patch.selectable !== void 0 ? { selectable: this.configuration.selectable } : {},
				...patch.evented !== void 0 ? { evented: this.configuration.evented } : {}
			};
			if (Object.keys(sessionPatch).length === 0) return;
			session.options = Object.freeze({
				...session.options,
				...sessionPatch
			});
			if (session.geometry) this.replaceSessionPreview(session, session.geometry);
		}
		getConfiguration() {
			this.assertActive("read Shape configuration");
			return Object.freeze({
				...this.configuration,
				strokeDashArray: this.configuration.strokeDashArray ? Object.freeze([...this.configuration.strokeDashArray]) : null
			});
		}
		getSession() {
			this.assertActive("read Shape session");
			return this.session ? Object.freeze({
				kind: this.session.options.kind,
				geometry: this.session.geometry,
				options: Object.freeze({
					...this.session.options,
					...this.session.options.strokeDashArray ? { strokeDashArray: Object.freeze([...this.session.options.strokeDashArray]) } : {}
				})
			}) : null;
		}
		closeForImage() {
			if (this.session) this.closeSession();
		}
		dispose() {
			if (this.disposed) return;
			if (this.session) this.closeSession();
			this.disposed = true;
		}
		createObject(geometry, style) {
			const resolved = this.resolveStyle(style);
			const common = {
				stroke: resolved.stroke,
				strokeWidth: resolved.strokeWidth,
				fill: resolved.fill,
				opacity: resolved.opacity,
				strokeDashArray: resolved.strokeDashArray ? [...resolved.strokeDashArray] : null,
				selectable: resolved.selectable,
				evented: resolved.evented,
				strokeLineCap: "round",
				strokeLineJoin: "round",
				objectCaching: false
			};
			let object;
			if (geometry.kind === "rect") object = new this.host.fabric.Rect({
				...common,
				left: geometry.left,
				top: geometry.top,
				width: geometry.width,
				height: geometry.height,
				originX: "left",
				originY: "top"
			});
			else if (geometry.kind === "line") object = new this.host.fabric.Polyline([{
				x: geometry.start.x,
				y: geometry.start.y
			}, {
				x: geometry.end.x,
				y: geometry.end.y
			}], common);
			else object = new this.host.fabric.Path(buildArrowPath(geometry, resolved.arrowHeadLength), common);
			object.editorShapeKind = geometry.kind;
			object.editorShapeGeometry = geometry;
			return object;
		}
		resolveStyle(value) {
			var _a, _b, _c, _d, _e, _f, _g;
			return resolveShapeConfiguration({
				stroke: (_a = value.stroke) !== null && _a !== void 0 ? _a : this.configuration.stroke,
				strokeWidth: (_b = value.strokeWidth) !== null && _b !== void 0 ? _b : this.configuration.strokeWidth,
				fill: (_c = value.fill) !== null && _c !== void 0 ? _c : this.configuration.fill,
				opacity: (_d = value.opacity) !== null && _d !== void 0 ? _d : this.configuration.opacity,
				strokeDashArray: value.strokeDashArray === void 0 ? this.configuration.strokeDashArray : value.strokeDashArray,
				arrowHeadLength: (_e = value.arrowHeadLength) !== null && _e !== void 0 ? _e : this.configuration.arrowHeadLength,
				selectable: (_f = value.selectable) !== null && _f !== void 0 ? _f : this.configuration.selectable,
				evented: (_g = value.evented) !== null && _g !== void 0 ? _g : this.configuration.evented,
				bindToImageTransform: this.configuration.bindToImageTransform,
				namePrefix: this.configuration.namePrefix
			});
		}
		closeSession() {
			const session = this.session;
			if (!session) return;
			this.session = null;
			if (session.previewId) this.authoring.removePreview([session.previewId]);
		}
		requireSession(operation) {
			this.assertActive(operation);
			if (!this.session) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError(`Cannot ${operation} without a Shape session.`);
			return this.session;
		}
		assertImageLoaded() {
			if (!this.host.isImageLoaded()) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError("Shape Annotation requires a loaded image.");
		}
		assertActive(operation) {
			if (this.disposed) throw new _bensitu_image_editor_plugins_annotation.AnnotationValidationError(`Cannot ${operation} after disposal.`);
		}
	};

//#endregion
//#region dist/esm/plugins/annotation-shape/index.js
	const SHAPE_TOOL_ID = "annotation:shape";
	const shapeAnnotationPluginRef = (0, _bensitu_image_editor_sdk.definePluginRef)("annotation:shape", "1.0.0");
	function shapeAnnotationPlugin(options = {}) {
		const initialConfiguration = resolveShapeConfiguration(options);
		let controller = null;
		return (0, _bensitu_image_editor_sdk.definePlugin)({
			ref: shapeAnnotationPluginRef,
			manifest: {
				id: shapeAnnotationPluginRef.id,
				version: "1.0.0",
				apiVersion: shapeAnnotationPluginRef.apiVersion,
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
				controller = new ShapeAnnotationController(Object.freeze({
					...diagnostics,
					...fabric,
					...image
				}), authoring, initialConfiguration);
				context.disposables.add(authoring.registerFeature(controller.featureDefinition()));
				for (const operationId of [
					"annotation-shape:create",
					"annotation-shape:update",
					"annotation-shape:commit"
				]) context.disposables.add(context.operations.register({
					id: operationId,
					mode: "mutation",
					conflictDomains: PERSISTENT_OVERLAY_MUTATION_CONFLICT_DOMAINS,
					reentrancy: "reject"
				}));
				for (const operationId of [
					"annotation-shape:enter",
					"annotation-shape:update-preview",
					"annotation-shape:cancel",
					"annotation-shape:configure"
				]) context.disposables.add(context.operations.register({
					id: operationId,
					mode: "busy",
					conflictDomains: OVERLAY_AUTHORING_SESSION_CONFLICT_DOMAINS,
					reentrancy: "queue"
				}));
				context.disposables.add(context.tools.register({
					id: SHAPE_TOOL_ID,
					enter: () => void 0,
					exit: () => controller === null || controller === void 0 ? void 0 : controller.cancel(),
					canRunOperation: (operationId) => operationId.startsWith("annotation-shape:") || operationId.startsWith("annotation:") || operationId.endsWith(":enter") || operationId === "crop:enter" || operationId === "mosaic:enter" || operationId === "core:load-image" || operationId === "core:commit-load-image" || operationId === "core:load-state" || operationId === "core:export"
				}));
				const requireController = () => {
					if (!controller) throw new Error("Shape Annotation Plugin is not installed.");
					return controller;
				};
				return Object.freeze({
					enter: (enterOptions) => context.operations.run("annotation-shape:enter", enterOptions, async (value) => {
						await context.tools.enter(SHAPE_TOOL_ID);
						try {
							requireController().enter(value);
						} catch (error) {
							await context.tools.exit("operation");
							throw error;
						}
					}),
					updatePreview: (geometry) => context.operations.run("annotation-shape:update-preview", geometry, (value) => requireController().updatePreview(value)),
					commit: async () => {
						try {
							return await requireController().commit();
						} finally {
							if (context.tools.getActiveToolId() === SHAPE_TOOL_ID) await context.tools.exit("operation");
						}
					},
					cancel: () => context.operations.run("annotation-shape:cancel", void 0, async () => {
						requireController().cancel();
						if (context.tools.getActiveToolId() === SHAPE_TOOL_ID) await context.tools.exit("requested");
					}),
					create: async (definition) => requireController().create(definition),
					update: async (id, patch) => requireController().update(id, patch),
					configure: (patch) => context.operations.run("annotation-shape:configure", patch, (value) => requireController().configure(value)),
					getConfiguration: () => requireController().getConfiguration(),
					getSession: () => requireController().getSession()
				});
			},
			onImageCleared(context) {
				if (context.tools.getActiveToolId() === SHAPE_TOOL_ID) return context.tools.exit("operation");
				controller === null || controller === void 0 || controller.closeForImage();
			},
			onDispose() {
				controller === null || controller === void 0 || controller.dispose();
				controller = null;
			}
		});
	}

//#endregion
exports.shapeAnnotationPlugin = shapeAnnotationPlugin;
exports.shapeAnnotationPluginRef = shapeAnnotationPluginRef;
});
//# sourceMappingURL=image-editor.plugin.annotation-shape.umd.js.map