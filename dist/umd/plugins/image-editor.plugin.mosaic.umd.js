(function(global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ?  factory(exports, require('@bensitu/image-editor/sdk')) :
  typeof define === 'function' && define.amd ? define(['exports', '@bensitu/image-editor/sdk'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory((global.ImageEditorPlugins = global.ImageEditorPlugins || {},global.ImageEditorPlugins.Mosaic = global.ImageEditorPlugins.Mosaic || {}), global.ImageEditor));
})(this, function(exports, _bensitu_image_editor_sdk) {
if (Object.prototype.hasOwnProperty.call(exports, "mosaicPlugin")) return;
Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
//#region dist/esm/utils/internal-layer-placement.js
	function moveObjectTo(canvas, object, index) {
		const canvasWithLayerApi = canvas;
		if (typeof canvasWithLayerApi.moveObjectTo === "function") {
			canvasWithLayerApi.moveObjectTo(object, index);
			return;
		}
		try {
			canvas.remove(object);
			canvas.insertAt(index, object);
		} catch {
			canvas.add(object);
		}
	}
	function ensureOnCanvas(canvas, object) {
		if (!canvas.getObjects().includes(object)) canvas.add(object);
	}
	function withoutObject(canvas, object) {
		return canvas.getObjects().filter((candidate) => candidate !== object);
	}
	function markSessionObject(object, sessionObjectType) {
		const sessionObject = object;
		sessionObject.editorObjectKind = "session";
		sessionObject.sessionObjectType = sessionObjectType;
		return sessionObject;
	}
	function placeSessionObject(canvas, sessionObject) {
		sessionObject.editorLayerRole = "session";
		ensureOnCanvas(canvas, sessionObject);
		moveObjectTo(canvas, sessionObject, withoutObject(canvas, sessionObject).length);
	}

//#endregion
//#region dist/esm/plugins/mosaic/mosaic-brush.js
	function isInsideCircle(x, y, centerX, centerY, radiusSquared) {
		const deltaX = x - centerX;
		const deltaY = y - centerY;
		return deltaX * deltaX + deltaY * deltaY <= radiusSquared;
	}
	function pixelOffset(width, x, y) {
		return (y * width + x) * 4;
	}
	function getCircularDirtyRectangle(options) {
		const { widthPx, heightPx, centerXPx, centerYPx, radiusPx } = options;
		if (!Number.isSafeInteger(widthPx) || !Number.isSafeInteger(heightPx) || widthPx <= 0 || heightPx <= 0 || !Number.isFinite(centerXPx) || !Number.isFinite(centerYPx) || !Number.isFinite(radiusPx) || radiusPx <= 0) return null;
		const leftPx = Math.max(0, Math.floor(centerXPx - radiusPx));
		const rightPx = Math.min(widthPx - 1, Math.ceil(centerXPx + radiusPx));
		const topPx = Math.max(0, Math.floor(centerYPx - radiusPx));
		const bottomPx = Math.min(heightPx - 1, Math.ceil(centerYPx + radiusPx));
		if (leftPx > rightPx || topPx > bottomPx) return null;
		return Object.freeze({
			leftPx,
			topPx,
			widthPx: rightPx - leftPx + 1,
			heightPx: bottomPx - topPx + 1
		});
	}
	function mergeDirtyRectangles(current, next) {
		if (!next) return current ? Object.freeze({ ...current }) : null;
		if (!current) return Object.freeze({ ...next });
		const leftPx = Math.min(current.leftPx, next.leftPx);
		const topPx = Math.min(current.topPx, next.topPx);
		const rightPx = Math.max(current.leftPx + current.widthPx, next.leftPx + next.widthPx);
		const bottomPx = Math.max(current.topPx + current.heightPx, next.topPx + next.heightPx);
		return Object.freeze({
			leftPx,
			topPx,
			widthPx: rightPx - leftPx,
			heightPx: bottomPx - topPx
		});
	}
	function interpolateMosaicPoints(start, end, radiusPx) {
		const deltaX = end.xPx - start.xPx;
		const deltaY = end.yPx - start.yPx;
		const distance = Math.hypot(deltaX, deltaY);
		const spacing = Math.max(1, radiusPx / 2);
		const steps = Math.max(1, Math.ceil(distance / spacing));
		return Object.freeze(Array.from(Array.from({ length: steps }).keys(), (index) => {
			const progress = (index + 1) / steps;
			return Object.freeze({
				xPx: start.xPx + deltaX * progress,
				yPx: start.yPx + deltaY * progress
			});
		}));
	}
	function applyCircularMosaic(imageData, point) {
		var _a, _b, _c, _d;
		const dirty = getCircularDirtyRectangle({
			widthPx: imageData.width,
			heightPx: imageData.height,
			centerXPx: point.xPx,
			centerYPx: point.yPx,
			radiusPx: point.radiusPx
		});
		if (!dirty) return null;
		const blockSize = Math.max(1, Math.floor(point.blockSizePx));
		const rightPx = dirty.leftPx + dirty.widthPx - 1;
		const bottomPx = dirty.topPx + dirty.heightPx - 1;
		const radiusSquared = point.radiusPx * point.radiusPx;
		let changed = false;
		for (let blockTop = dirty.topPx; blockTop <= bottomPx; blockTop += blockSize) for (let blockLeft = dirty.leftPx; blockLeft <= rightPx; blockLeft += blockSize) {
			const blockRight = Math.min(rightPx, blockLeft + blockSize - 1);
			const blockBottom = Math.min(bottomPx, blockTop + blockSize - 1);
			let sampleOffset = -1;
			for (let y = blockTop; y <= blockBottom && sampleOffset < 0; y += 1) for (let x = blockLeft; x <= blockRight; x += 1) {
				if (!isInsideCircle(x, y, point.xPx, point.yPx, radiusSquared)) continue;
				sampleOffset = pixelOffset(imageData.width, x, y);
				break;
			}
			if (sampleOffset < 0) continue;
			const red = (_a = imageData.data[sampleOffset]) !== null && _a !== void 0 ? _a : 0;
			const green = (_b = imageData.data[sampleOffset + 1]) !== null && _b !== void 0 ? _b : 0;
			const blue = (_c = imageData.data[sampleOffset + 2]) !== null && _c !== void 0 ? _c : 0;
			const alpha = (_d = imageData.data[sampleOffset + 3]) !== null && _d !== void 0 ? _d : 0;
			for (let y = blockTop; y <= blockBottom; y += 1) for (let x = blockLeft; x <= blockRight; x += 1) {
				if (!isInsideCircle(x, y, point.xPx, point.yPx, radiusSquared)) continue;
				const offset = pixelOffset(imageData.width, x, y);
				imageData.data[offset] = red;
				imageData.data[offset + 1] = green;
				imageData.data[offset + 2] = blue;
				imageData.data[offset + 3] = alpha;
				changed = true;
			}
		}
		return changed ? dirty : null;
	}

//#endregion
//#region dist/esm/plugins/mosaic/mosaic-errors.js
	var MosaicError = class extends Error {
		constructor() {
			super(...arguments);
			Object.defineProperty(this, "name", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: "MosaicError"
			});
		}
	};
	var MosaicSessionError = class extends MosaicError {
		constructor() {
			super(...arguments);
			Object.defineProperty(this, "name", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: "MosaicSessionError"
			});
		}
	};
	var MosaicValidationError = class extends MosaicError {
		constructor() {
			super(...arguments);
			Object.defineProperty(this, "name", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: "MosaicValidationError"
			});
		}
	};
	var MosaicIntegrationError = class extends MosaicError {
		constructor() {
			super(...arguments);
			Object.defineProperty(this, "name", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: "MosaicIntegrationError"
			});
		}
	};

//#endregion
//#region dist/esm/plugins/mosaic/mosaic-raster-cache.js
	function writeMosaicDirtyRegion(context, imageData, dirty) {
		context.putImageData(imageData, 0, 0, dirty.leftPx, dirty.topPx, dirty.widthPx, dirty.heightPx);
	}
	function copyMosaicImagePresentation(source, target, transient) {
		target.set({
			left: source.left,
			top: source.top,
			originX: "left",
			originY: "top",
			scaleX: source.scaleX,
			scaleY: source.scaleY,
			angle: source.angle,
			skewX: source.skewX,
			skewY: source.skewY,
			flipX: source.flipX,
			flipY: source.flipY,
			opacity: source.opacity,
			visible: source.visible,
			selectable: transient ? false : source.selectable,
			evented: transient ? false : source.evented,
			hasControls: transient ? false : source.hasControls,
			hoverCursor: source.hoverCursor,
			excludeFromExport: transient ? true : source.excludeFromExport,
			backgroundColor: source.backgroundColor,
			objectCaching: transient ? false : source.objectCaching
		});
		target.setCoords();
	}
	function createMosaicRasterCache(source) {
		var _a;
		const widthPx = Number(source.width);
		const heightPx = Number(source.height);
		if (!Number.isSafeInteger(widthPx) || !Number.isSafeInteger(heightPx) || widthPx <= 0 || heightPx <= 0) throw new MosaicValidationError("Mosaic source dimensions are invalid.");
		const element = source.getElement();
		const ownerDocument = (_a = element.ownerDocument) !== null && _a !== void 0 ? _a : globalThis.document;
		if (!ownerDocument) throw new MosaicValidationError("Mosaic rendering document is unavailable.");
		const surface = ownerDocument.createElement("canvas");
		surface.width = widthPx;
		surface.height = heightPx;
		const context = surface.getContext("2d");
		if (!context) throw new MosaicValidationError("Mosaic rendering context is unavailable.");
		context.drawImage(element, 0, 0, widthPx, heightPx);
		let imageData;
		try {
			imageData = context.getImageData(0, 0, widthPx, heightPx);
		} catch {
			throw new MosaicValidationError("Mosaic source pixels could not be read.");
		}
		return Object.freeze({
			surface,
			context,
			imageData,
			widthPx,
			heightPx
		});
	}
	function createMosaicPreviewImage(fabric, source, cache) {
		const preview = new fabric.FabricImage(cache.surface, {
			selectable: false,
			evented: false,
			hasControls: false,
			excludeFromExport: true,
			objectCaching: false
		});
		copyMosaicImagePresentation(source, preview, true);
		return preview;
	}
	function disposeMosaicRasterCache(cache) {
		if (!cache) return;
		cache.surface.width = 0;
		cache.surface.height = 0;
	}

//#endregion
//#region dist/esm/utils/image-budget.js
	function isPixelAreaWithinBudget(width, height, maxPixels) {
		return Number.isSafeInteger(width) && Number.isSafeInteger(height) && Number.isSafeInteger(maxPixels) && width > 0 && height > 0 && maxPixels > 0 && width <= Math.floor(maxPixels / height);
	}

//#endregion
//#region dist/esm/utils/abortable-promise.js
	function settleAbortable(task, signal, disposeLateResult) {
		return new Promise((resolve, reject) => {
			let settled = false;
			const finish = (body) => {
				if (settled) return;
				settled = true;
				signal.removeEventListener("abort", abort);
				body();
			};
			const abort = () => finish(() => {
				var _a;
				return reject((_a = signal.reason) !== null && _a !== void 0 ? _a : new DOMException("The asynchronous task was aborted.", "AbortError"));
			});
			signal.addEventListener("abort", abort, { once: true });
			if (signal.aborted) abort();
			task.then((value) => {
				if (settled) {
					try {
						disposeLateResult === null || disposeLateResult === void 0 || disposeLateResult(value);
					} catch {}
					return;
				}
				finish(() => resolve(value));
			}, (error) => finish(() => reject(error)));
		});
	}

//#endregion
//#region dist/esm/utils/base64-payload.js
	const STANDARD_BASE64_BODY_PATTERN = /^[A-Za-z0-9+/]*$/u;
	function base64PayloadByteLength(payload) {
		const firstPaddingIndex = payload.indexOf("=");
		const body = firstPaddingIndex === -1 ? payload : payload.slice(0, firstPaddingIndex);
		const padding = firstPaddingIndex === -1 ? "" : payload.slice(firstPaddingIndex);
		if (!STANDARD_BASE64_BODY_PATTERN.test(body) || padding !== "" && !/^={1,2}$/u.test(padding)) throw new TypeError("Base64 payload contains non-standard characters or padding.");
		const remainder = payload.length % 4;
		if (remainder === 1 || padding.length > 0 && remainder !== 0) throw new RangeError("Base64 payload length is malformed.");
		return Math.floor(payload.length * 3 / 4) - padding.length;
	}

//#endregion
//#region dist/esm/utils/error.js
	function hasErrorName(error, expectedName) {
		if (typeof error !== "object" && typeof error !== "function" || error === null) return false;
		try {
			return Reflect.get(error, "name") === expectedName;
		} catch {
			return false;
		}
	}

//#endregion
//#region dist/esm/plugins/mosaic/mosaic-renderer.js
	function isRecord$1(value) {
		if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
		const prototype = Object.getPrototypeOf(value);
		return prototype === Object.prototype || prototype === null;
	}
	function normalizeMosaicCommitOptions(value, configuration, sourceMimeType) {
		var _a, _b;
		if (value !== void 0 && !isRecord$1(value)) throw new MosaicValidationError("Mosaic commit options must be an object.");
		const record = value !== null && value !== void 0 ? value : {};
		const allowedKeys = /* @__PURE__ */ new Set([
			"format",
			"quality",
			"bakeVisibleFilters"
		]);
		if (Object.keys(record).some((key) => !allowedKeys.has(key))) throw new MosaicValidationError("Mosaic commit options contain unknown keys.");
		const requestedFormat = (_a = record.format) !== null && _a !== void 0 ? _a : configuration.format;
		if (requestedFormat !== "source" && requestedFormat !== "png" && requestedFormat !== "jpeg" && requestedFormat !== "webp") throw new MosaicValidationError("Mosaic output format is invalid.");
		const format = requestedFormat === "source" ? sourceMimeType === "image/jpeg" ? "jpeg" : sourceMimeType === "image/webp" ? "webp" : "png" : requestedFormat;
		const quality = (_b = record.quality) !== null && _b !== void 0 ? _b : configuration.quality;
		if (typeof quality !== "number" || !Number.isFinite(quality) || quality < 0 || quality > 1) throw new MosaicValidationError("Mosaic output quality must be within [0, 1].");
		if (record.bakeVisibleFilters !== void 0 && typeof record.bakeVisibleFilters !== "boolean") throw new MosaicValidationError("bakeVisibleFilters must be a boolean.");
		return Object.freeze({
			format,
			...format === "png" ? {} : { quality },
			mimeType: format === "jpeg" ? "image/jpeg" : `image/${format}`,
			bakeVisibleFilters: record.bakeVisibleFilters !== false
		});
	}
	function encodedBytes(dataUrl, expectedMimeType) {
		const commaIndex = dataUrl.indexOf(",");
		if (commaIndex < 0 || !/;base64$/i.test(dataUrl.slice(0, commaIndex))) throw new MosaicValidationError("Mosaic output is not a base64 Data URL.");
		const mimeType = dataUrl.slice(5, dataUrl.indexOf(";"));
		if (mimeType !== expectedMimeType) throw new MosaicValidationError(`Mosaic encoder returned ${mimeType || "an unknown MIME"} instead of ${expectedMimeType}.`);
		const payload = dataUrl.slice(commaIndex + 1);
		try {
			return base64PayloadByteLength(payload);
		} catch {
			throw new MosaicValidationError("Mosaic output contains a malformed base64 payload.");
		}
	}
	async function decodeMosaicImage(fabric, dataUrl, timeoutMs, signal) {
		var _a;
		const controller = new AbortController();
		const abort = () => controller.abort(signal.reason);
		signal.addEventListener("abort", abort, { once: true });
		if (signal.aborted) abort();
		const timeout = setTimeout(() => controller.abort(new MosaicValidationError("Mosaic decode timed out.")), timeoutMs);
		try {
			return await settleAbortable(fabric.FabricImage.fromURL(dataUrl, {
				crossOrigin: "anonymous",
				signal: controller.signal
			}), controller.signal, (lateImage) => lateImage.dispose());
		} catch (error) {
			if (controller.signal.aborted) throw (_a = controller.signal.reason) !== null && _a !== void 0 ? _a : error;
			throw new MosaicValidationError("Mosaic decode failed.");
		} finally {
			clearTimeout(timeout);
			signal.removeEventListener("abort", abort);
		}
	}
	async function renderMosaicImage(host, source, cache, options, signal) {
		var _a;
		const policy = host.getImageResourcePolicy();
		const pixelBudget = Math.min(policy.maxInputPixels, policy.maxExportPixels);
		if (cache.widthPx > policy.maxExportDimension || cache.heightPx > policy.maxExportDimension || !isPixelAreaWithinBudget(cache.widthPx, cache.heightPx, pixelBudget)) throw new MosaicValidationError("Mosaic dimensions exceed the Core resource policy.");
		let dataUrl;
		try {
			cache.context.putImageData(cache.imageData, 0, 0);
			if (signal.aborted) throw signal.reason;
			dataUrl = cache.surface.toDataURL(options.mimeType, options.quality);
		} catch (error) {
			if (signal.aborted) throw (_a = signal.reason) !== null && _a !== void 0 ? _a : error;
			if (hasErrorName(error, "SecurityError")) throw new MosaicValidationError("Mosaic pixels cannot be exported because canvas access is blocked.");
			throw error;
		}
		if (encodedBytes(dataUrl, options.mimeType) > policy.maxInputBytes) throw new MosaicValidationError("Mosaic output exceeds the Core input budget.");
		const image = await decodeMosaicImage(host.fabric, dataUrl, policy.imageLoadTimeoutMs, signal);
		try {
			if (image.width !== cache.widthPx || image.height !== cache.heightPx) throw new MosaicValidationError("Mosaic dimensions changed during decode.");
			copyMosaicImagePresentation(source, image, false);
			image.set({
				selectable: false,
				evented: false,
				hasControls: false
			});
			image.setCoords();
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
//#region dist/esm/plugins/mosaic/mosaic-controller.js
	const DEFAULT_CONFIGURATION = Object.freeze({
		brushSizePx: 24,
		pixelBlockSizePx: 8,
		format: "source",
		quality: .92,
		maxPointCount: 4096,
		preview: Object.freeze({
			stroke: "#333333",
			strokeWidth: 1,
			strokeDashArray: Object.freeze([4, 4]),
			fill: "rgba(0,0,0,0)"
		})
	});
	const MAX_INTERPOLATED_POINT_COUNT = 25e4;
	function isRecord(value) {
		if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
		const prototype = Object.getPrototypeOf(value);
		return prototype === Object.prototype || prototype === null;
	}
	function normalizePreviewStyle(current, value) {
		var _a, _b;
		if (value === void 0) return current;
		if (!isRecord(value)) throw new MosaicValidationError("Mosaic preview configuration must be an object.");
		const allowedKeys = /* @__PURE__ */ new Set([
			"stroke",
			"strokeWidth",
			"strokeDashArray",
			"fill"
		]);
		if (Object.keys(value).some((key) => !allowedKeys.has(key))) throw new MosaicValidationError("Mosaic preview configuration contains unknown keys.");
		const stroke = value.stroke === void 0 ? current.stroke : value.stroke;
		const strokeWidth = (_a = value.strokeWidth) !== null && _a !== void 0 ? _a : current.strokeWidth;
		const strokeDashArray = value.strokeDashArray === void 0 ? current.strokeDashArray : value.strokeDashArray;
		const fill = (_b = value.fill) !== null && _b !== void 0 ? _b : current.fill;
		if (stroke !== null && typeof stroke !== "string" || typeof stroke === "string" && stroke.length > 256) throw new MosaicValidationError("Mosaic preview stroke must be a bounded string or null.");
		if (typeof strokeWidth !== "number" || !Number.isFinite(strokeWidth) || strokeWidth < 0 || strokeWidth > 32) throw new MosaicValidationError("Mosaic preview strokeWidth must be within [0, 32].");
		if (strokeDashArray !== null && (!Array.isArray(strokeDashArray) || strokeDashArray.length > 16 || strokeDashArray.some((entry) => typeof entry !== "number" || !Number.isFinite(entry) || entry < 0))) throw new MosaicValidationError("Mosaic preview strokeDashArray must contain bounded non-negative values or be null.");
		if (typeof fill !== "string" || fill.length > 256) throw new MosaicValidationError("Mosaic preview fill must be a bounded string.");
		return Object.freeze({
			stroke,
			strokeWidth,
			strokeDashArray: strokeDashArray === null ? null : Object.freeze([...strokeDashArray]),
			fill
		});
	}
	function normalizeConfiguration(current, patch) {
		var _a, _b, _c, _d, _e;
		if (!isRecord(patch)) throw new MosaicValidationError("Mosaic configuration patch must be an object.");
		const allowedKeys = /* @__PURE__ */ new Set([
			"brushSizePx",
			"pixelBlockSizePx",
			"format",
			"quality",
			"maxPointCount",
			"preview"
		]);
		if (Object.keys(patch).some((key) => !allowedKeys.has(key))) throw new MosaicValidationError("Mosaic configuration contains unknown keys.");
		const brushSizePx = (_a = patch.brushSizePx) !== null && _a !== void 0 ? _a : current.brushSizePx;
		const pixelBlockSizePx = (_b = patch.pixelBlockSizePx) !== null && _b !== void 0 ? _b : current.pixelBlockSizePx;
		const format = (_c = patch.format) !== null && _c !== void 0 ? _c : current.format;
		const quality = (_d = patch.quality) !== null && _d !== void 0 ? _d : current.quality;
		const maxPointCount = (_e = patch.maxPointCount) !== null && _e !== void 0 ? _e : current.maxPointCount;
		const preview = normalizePreviewStyle(current.preview, patch.preview);
		if (typeof brushSizePx !== "number" || !Number.isFinite(brushSizePx) || brushSizePx < 1 || brushSizePx > 4096) throw new MosaicValidationError("Mosaic brushSizePx must be within [1, 4096].");
		if (typeof pixelBlockSizePx !== "number" || !Number.isSafeInteger(pixelBlockSizePx) || pixelBlockSizePx < 1 || pixelBlockSizePx > 1024) throw new MosaicValidationError("Mosaic pixelBlockSizePx must be within [1, 1024].");
		if (format !== "source" && format !== "png" && format !== "jpeg" && format !== "webp") throw new MosaicValidationError("Mosaic format is invalid.");
		if (typeof quality !== "number" || !Number.isFinite(quality) || quality < 0 || quality > 1) throw new MosaicValidationError("Mosaic quality must be within [0, 1].");
		if (typeof maxPointCount !== "number" || !Number.isSafeInteger(maxPointCount) || maxPointCount < 1 || maxPointCount > 1e5) throw new MosaicValidationError("Mosaic maxPointCount must be within [1, 100000].");
		return Object.freeze({
			brushSizePx,
			pixelBlockSizePx,
			format,
			quality,
			maxPointCount,
			preview
		});
	}
	function resolveMosaicConfiguration(options) {
		return normalizeConfiguration(DEFAULT_CONFIGURATION, options);
	}
	function cloneDirtyRectangle(rectangle) {
		return rectangle ? Object.freeze({ ...rectangle }) : null;
	}
	function cloneSessionState(state) {
		return Object.freeze({
			...state,
			dirtyRectangle: cloneDirtyRectangle(state.dirtyRectangle),
			configuration: Object.freeze({
				...state.configuration,
				preview: Object.freeze({
					...state.configuration.preview,
					strokeDashArray: state.configuration.preview.strokeDashArray ? Object.freeze([...state.configuration.preview.strokeDashArray]) : null
				})
			})
		});
	}
	function replayStroke(cache, stroke, configuration, replayBudget) {
		let dirty = null;
		let previous = null;
		for (const point of stroke) {
			const points = previous ? interpolateMosaicPoints(previous, point, configuration.brushSizePx / 2) : [point];
			replayBudget.count += points.length;
			if (replayBudget.count > MAX_INTERPOLATED_POINT_COUNT) throw new MosaicValidationError("Mosaic interpolation exceeds the safe processing budget.");
			for (const interpolated of points) dirty = mergeDirtyRectangles(dirty, applyCircularMosaic(cache.imageData, {
				...interpolated,
				radiusPx: configuration.brushSizePx / 2,
				blockSizePx: configuration.pixelBlockSizePx
			}));
			previous = point;
		}
		return dirty;
	}
	var MosaicController = class {
		constructor(host, geometry, raster, visibleRasterBake, visibleRasterBakeStatus, configuration) {
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
				value: void 0
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
			this.configuration = configuration;
		}
		get isActive() {
			return this.session !== null;
		}
		getConfiguration() {
			this.assertActive("read Mosaic configuration");
			return this.configuration;
		}
		configure(patch) {
			this.assertActive("configure Mosaic");
			const session = this.session;
			if (session && session.activeStrokeIndex !== null) throw new MosaicSessionError("End the active Mosaic stroke before configuring it.");
			const configuration = normalizeConfiguration(this.configuration, patch);
			const sessionConfiguration = session ? normalizeConfiguration(session.state.configuration, patch) : null;
			this.configuration = configuration;
			if (session && sessionConfiguration) {
				session.state = Object.freeze({
					...session.state,
					configuration: sessionConfiguration
				});
				this.refreshBrushPreviewPresentation(session);
			}
			this.emitStatus();
		}
		getSession() {
			this.assertActive("read the Mosaic session");
			return this.session ? cloneSessionState(this.session.state) : null;
		}
		subscribe(listener) {
			this.assertActive("subscribe to Mosaic status");
			if (typeof listener !== "function") throw new TypeError("[ImageEditor] Mosaic status listener must be a function.");
			this.listeners.add(listener);
			return (0, _bensitu_image_editor_sdk.createDisposable)(() => {
				this.listeners.delete(listener);
			});
		}
		enter(options = {}) {
			this.assertActive("enter Mosaic");
			if (this.session) throw new MosaicSessionError("Mosaic is already active.");
			if (!this.host.isImageLoaded()) throw new MosaicSessionError("Mosaic requires a loaded image.");
			if (!isRecord(options)) throw new MosaicValidationError("Mosaic enter options must be an object.");
			if (Object.keys(options).some((key) => key !== "configuration")) throw new MosaicValidationError("Mosaic enter options contain unknown keys.");
			const configuration = options.configuration ? normalizeConfiguration(this.configuration, options.configuration) : this.configuration;
			const source = this.requireBaseImage();
			const cache = createMosaicRasterCache(source);
			this.assertCachePolicy(cache);
			const preview = markSessionObject(createMosaicPreviewImage(this.host.fabric, source, cache), "mosaicPreviewImage");
			const brushPreview = markSessionObject(new this.host.fabric.Circle({
				left: 0,
				top: 0,
				radius: configuration.brushSizePx / 2,
				originX: "center",
				originY: "center",
				fill: configuration.preview.fill,
				stroke: configuration.preview.stroke,
				strokeWidth: configuration.preview.strokeWidth,
				strokeDashArray: configuration.preview.strokeDashArray ? [...configuration.preview.strokeDashArray] : null,
				strokeUniform: true,
				selectable: false,
				evented: false,
				excludeFromExport: true,
				objectCaching: false,
				visible: false
			}), "mosaicPreviewCircle");
			const canvas = this.host.requireCanvas("enter Mosaic");
			placeSessionObject(canvas, preview);
			placeSessionObject(canvas, brushPreview);
			const state = Object.freeze({
				sourceRevision: this.host.getGeometryRevision(),
				sourceWidthPx: cache.widthPx,
				sourceHeightPx: cache.heightPx,
				strokeCount: 0,
				pointCount: 0,
				isStrokeActive: false,
				dirtyRectangle: null,
				configuration
			});
			this.session = {
				state,
				cache,
				preview,
				brushPreview,
				previewInteraction: null,
				strokes: [],
				activeStrokeIndex: null,
				userPointCount: 0,
				interpolatedPointCount: 0
			};
			this.session.previewInteraction = this.bindBrushPreview(this.session);
			this.refreshBrushPreviewPresentation(this.session);
			this.host.requestRender();
			this.emitStatus();
		}
		beginStroke(value) {
			const session = this.requireSession("begin a Mosaic stroke");
			this.assertSourceCurrent(session);
			if (session.activeStrokeIndex !== null) throw new MosaicSessionError("A Mosaic stroke is already active.");
			const point = this.normalizePoint(value, session);
			this.assertPointBudget(session);
			this.assertInterpolatedPointBudget(session, 1);
			const stroke = {
				configuration: session.state.configuration,
				points: [point]
			};
			session.strokes.push(stroke);
			session.activeStrokeIndex = session.strokes.length - 1;
			session.userPointCount += 1;
			this.applyPreviewPoints(session, [point], stroke.configuration);
			session.interpolatedPointCount += 1;
			this.updateSessionState(session, true);
		}
		appendStroke(value) {
			const session = this.requireSession("append a Mosaic stroke");
			this.assertSourceCurrent(session);
			const strokeIndex = session.activeStrokeIndex;
			if (strokeIndex === null) throw new MosaicSessionError("Mosaic appendStroke requires an active stroke.");
			const stroke = session.strokes[strokeIndex];
			const point = this.normalizePoint(value, session);
			this.assertPointBudget(session);
			const previous = stroke.points[stroke.points.length - 1];
			const interpolated = interpolateMosaicPoints(previous, point, stroke.configuration.brushSizePx / 2);
			this.assertInterpolatedPointBudget(session, interpolated.length);
			stroke.points.push(point);
			session.userPointCount += 1;
			this.applyPreviewPoints(session, interpolated, stroke.configuration);
			session.interpolatedPointCount += interpolated.length;
			this.updateSessionState(session, true);
		}
		endStroke() {
			const session = this.requireSession("end a Mosaic stroke");
			if (session.activeStrokeIndex === null) throw new MosaicSessionError("Mosaic endStroke requires an active stroke.");
			session.activeStrokeIndex = null;
			this.updateSessionState(session, false);
		}
		cancel() {
			this.assertActive("cancel Mosaic");
			if (this.session) this.closeSession();
		}
		async commit(options) {
			var _a, _b;
			const session = this.requireSession("commit Mosaic");
			this.assertSourceCurrent(session);
			if (session.activeStrokeIndex !== null) throw new MosaicSessionError("End the active Mosaic stroke before commit.");
			const normalizedOptions = normalizeMosaicCommitOptions(options, session.state.configuration, (_b = (_a = this.host.getImageInfo()) === null || _a === void 0 ? void 0 : _a.mimeType) !== null && _b !== void 0 ? _b : null);
			const strokes = Object.freeze(session.strokes.map((stroke) => Object.freeze({
				configuration: Object.freeze({ ...stroke.configuration }),
				points: Object.freeze(stroke.points.map((point) => Object.freeze({ ...point })))
			})));
			const state = session.state;
			if (state.pointCount === 0) {
				this.closeSession();
				return;
			}
			this.hideBrushPreview(session);
			const mutationId = `mosaic:commit:${++this.mutationSequence}`;
			const resources = {
				cache: null,
				replacement: null,
				replacedSource: null
			};
			let committed = false;
			try {
				await this.geometry.run({
					id: mutationId,
					kind: "raster-replace",
					operationId: "mosaic:commit",
					targetSize: {
						width: state.sourceWidthPx,
						height: state.sourceHeightPx
					},
					metadata: Object.freeze({
						sourceRevision: state.sourceRevision,
						strokeCount: state.strokeCount,
						pointCount: state.pointCount,
						dirtyRectangle: state.dirtyRectangle,
						bakeVisibleFilters: normalizedOptions.bakeVisibleFilters
					}),
					mutateBase: async ({ transaction, signal }) => {
						var _a;
						if (normalizedOptions.bakeVisibleFilters && this.visibleRasterBakeStatus === "incompatible") throw new MosaicIntegrationError("The installed visible-raster bake provider is incompatible.");
						if (normalizedOptions.bakeVisibleFilters && ((_a = this.visibleRasterBake) === null || _a === void 0 ? void 0 : _a.hasVisibleState())) await this.visibleRasterBake.bakeIntoBase(transaction);
						this.assertSourceDimensions(state);
						const source = this.requireBaseImage();
						const cache = createMosaicRasterCache(source);
						resources.cache = cache;
						this.assertCachePolicy(cache);
						const replayBudget = { count: 0 };
						for (const stroke of strokes) replayStroke(cache, stroke.points, stroke.configuration, replayBudget);
						const rendered = await renderMosaicImage(this.host, source, cache, normalizedOptions, signal);
						resources.replacement = rendered.image;
						resources.replacedSource = source;
						this.raster.replaceBaseImage(transaction, rendered.image, {
							baseScale: this.host.getBaseImageScale(),
							mimeType: rendered.mimeType
						});
						this.validateBaseImage(rendered.image, state);
					}
				});
				committed = true;
				if (resources.replacedSource && resources.replacedSource !== this.host.getBaseImage()) resources.replacedSource.dispose();
			} finally {
				if (this.session === session) this.closeSession();
				disposeMosaicRasterCache(resources.cache);
				if (!committed && resources.replacement && this.host.getBaseImage() !== resources.replacement) resources.replacement.dispose();
			}
		}
		ownsPreview(object) {
			var _a, _b;
			return ((_a = this.session) === null || _a === void 0 ? void 0 : _a.preview) === object || ((_b = this.session) === null || _b === void 0 ? void 0 : _b.brushPreview) === object;
		}
		closeForImage() {
			if (this.session) this.closeSession();
		}
		dispose() {
			if (this.disposed) return;
			if (this.session) this.closeSession();
			this.listeners.clear();
			this.disposed = true;
		}
		bindBrushPreview(session) {
			const canvas = this.host.requireCanvas("bind the Mosaic brush preview");
			const stopMoving = canvas.on("mouse:move", (event) => {
				const point = event.scenePoint;
				if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
					this.hideBrushPreview(session);
					return;
				}
				this.moveBrushPreview(session, point);
			});
			const stopLeaving = canvas.on("mouse:out", () => this.hideBrushPreview(session));
			return (0, _bensitu_image_editor_sdk.createDisposable)(() => {
				stopLeaving();
				stopMoving();
			});
		}
		moveBrushPreview(session, scenePoint) {
			if (this.session !== session) return;
			const baseImage = this.requireBaseImage();
			const imagePoint = new this.host.fabric.Point(scenePoint.x, scenePoint.y).transform(this.host.fabric.util.invertTransform(baseImage.calcTransformMatrix()));
			const halfWidth = Number(baseImage.width) / 2;
			const halfHeight = Number(baseImage.height) / 2;
			if (imagePoint.x < -halfWidth || imagePoint.x >= halfWidth || imagePoint.y < -halfHeight || imagePoint.y >= halfHeight) {
				this.hideBrushPreview(session);
				return;
			}
			session.brushPreview.set({
				left: scenePoint.x,
				top: scenePoint.y,
				visible: true
			});
			session.brushPreview.setCoords();
			this.host.requestRender();
		}
		hideBrushPreview(session) {
			if (this.session !== session || session.brushPreview.visible === false) return;
			session.brushPreview.set({ visible: false });
			this.host.requestRender();
		}
		refreshBrushPreviewPresentation(session) {
			const baseImage = this.requireBaseImage();
			session.brushPreview.set({
				radius: session.state.configuration.brushSizePx / 2,
				fill: session.state.configuration.preview.fill,
				stroke: session.state.configuration.preview.stroke,
				strokeWidth: session.state.configuration.preview.strokeWidth,
				strokeDashArray: session.state.configuration.preview.strokeDashArray ? [...session.state.configuration.preview.strokeDashArray] : null,
				scaleX: baseImage.scaleX,
				scaleY: baseImage.scaleY,
				angle: baseImage.angle,
				skewX: baseImage.skewX,
				skewY: baseImage.skewY,
				flipX: baseImage.flipX,
				flipY: baseImage.flipY
			});
			session.brushPreview.setCoords();
			placeSessionObject(this.host.requireCanvas("refresh the Mosaic brush preview"), session.brushPreview);
			this.host.requestRender();
		}
		applyPreviewPoints(session, points, configuration) {
			let dirty = null;
			for (const point of points) dirty = mergeDirtyRectangles(dirty, applyCircularMosaic(session.cache.imageData, {
				...point,
				radiusPx: configuration.brushSizePx / 2,
				blockSizePx: configuration.pixelBlockSizePx
			}));
			if (!dirty) return;
			writeMosaicDirtyRegion(session.cache.context, session.cache.imageData, dirty);
			session.preview.dirty = true;
			session.state = Object.freeze({
				...session.state,
				dirtyRectangle: mergeDirtyRectangles(session.state.dirtyRectangle, dirty)
			});
			this.host.requestRender();
		}
		updateSessionState(session, isStrokeActive) {
			session.state = Object.freeze({
				...session.state,
				strokeCount: session.strokes.length,
				pointCount: session.userPointCount,
				isStrokeActive
			});
			this.emitStatus();
		}
		normalizePoint(value, session) {
			if (!isRecord(value)) throw new MosaicValidationError("Mosaic point must be an object.");
			if (Object.keys(value).some((key) => key !== "xPx" && key !== "yPx")) throw new MosaicValidationError("Mosaic point contains unknown keys.");
			const xPx = value.xPx;
			const yPx = value.yPx;
			if (typeof xPx !== "number" || typeof yPx !== "number" || !Number.isFinite(xPx) || !Number.isFinite(yPx) || xPx < 0 || yPx < 0 || xPx >= session.state.sourceWidthPx || yPx >= session.state.sourceHeightPx) throw new MosaicValidationError("Mosaic point must be finite and within natural image bounds.");
			return Object.freeze({
				xPx,
				yPx
			});
		}
		assertPointBudget(session) {
			if (session.userPointCount >= session.state.configuration.maxPointCount) throw new MosaicValidationError("Mosaic point count exceeds maxPointCount.");
		}
		assertInterpolatedPointBudget(session, additionalPointCount) {
			if (session.interpolatedPointCount + additionalPointCount > MAX_INTERPOLATED_POINT_COUNT) throw new MosaicValidationError("Mosaic interpolation exceeds the safe processing budget.");
		}
		closeSession() {
			const session = this.session;
			if (!session) return;
			this.session = null;
			if (session.previewInteraction) {
				try {
					(0, _bensitu_image_editor_sdk.observePromise)(Promise.resolve(session.previewInteraction.dispose()), (error) => {
						this.host.reportWarning(error, "Mosaic brush preview cleanup failed.");
					});
				} catch (error) {
					this.host.reportWarning(error, "Mosaic brush preview cleanup failed.");
				}
				session.previewInteraction = null;
			}
			const canvas = this.host.getCanvas();
			if (canvas === null || canvas === void 0 ? void 0 : canvas.getObjects().includes(session.brushPreview)) canvas.remove(session.brushPreview);
			if (canvas === null || canvas === void 0 ? void 0 : canvas.getObjects().includes(session.preview)) canvas.remove(session.preview);
			session.brushPreview.dispose();
			session.preview.dispose();
			disposeMosaicRasterCache(session.cache);
			this.host.requestRender();
			this.emitStatus();
		}
		requireSession(operation) {
			this.assertActive(operation);
			if (!this.session) throw new MosaicSessionError(`Cannot ${operation} without an active Mosaic session.`);
			return this.session;
		}
		requireBaseImage() {
			const baseImage = this.host.getBaseImage();
			if (!baseImage) throw new MosaicSessionError("Mosaic requires a loaded image.");
			return baseImage;
		}
		assertSourceCurrent(session) {
			if (!this.host.isImageLoaded() || this.host.getGeometryRevision() !== session.state.sourceRevision) throw new MosaicSessionError("Mosaic source revision is stale.");
			this.assertSourceDimensions(session.state);
		}
		assertSourceDimensions(state) {
			const baseImage = this.requireBaseImage();
			if (Number(baseImage.width) !== state.sourceWidthPx || Number(baseImage.height) !== state.sourceHeightPx) throw new MosaicSessionError("Mosaic source dimensions changed during the session.");
		}
		assertCachePolicy(cache) {
			const policy = this.host.getImageResourcePolicy();
			const pixelBudget = Math.min(policy.maxInputPixels, policy.maxExportPixels);
			if (cache.widthPx > policy.maxExportDimension || cache.heightPx > policy.maxExportDimension || !isPixelAreaWithinBudget(cache.widthPx, cache.heightPx, pixelBudget)) {
				disposeMosaicRasterCache(cache);
				throw new MosaicValidationError("Mosaic dimensions exceed the Core resource policy.");
			}
		}
		validateBaseImage(image, state) {
			const canvas = this.host.requireCanvas("validate Mosaic");
			const baseImages = canvas.getObjects().filter((object) => object.editorObjectKind === "baseImage");
			if (this.host.getBaseImage() !== image || baseImages.length !== 1 || baseImages[0] !== image || canvas.getObjects()[0] !== image || image.width !== state.sourceWidthPx || image.height !== state.sourceHeightPx || image.selectable !== false || image.evented !== false) throw new MosaicValidationError("Mosaic violated the Base Image invariant.");
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
				this.host.reportWarning(error, "A Mosaic status listener failed.");
			}
		}
		assertActive(operation) {
			if (this.disposed || this.host.isDisposed()) throw new MosaicSessionError(`Cannot ${operation} after Mosaic disposal.`);
		}
	};

//#endregion
//#region dist/esm/plugins/mosaic/index.js
	const MOSAIC_TOOL_ID = "plugin:mosaic";
	const mosaicPreviewDomains = [
		"base-image",
		"overlay",
		"selection",
		"state"
	];
	const mosaicMutationDomains = [
		"document",
		"base-image",
		"geometry",
		"raster",
		"overlay",
		"selection",
		"state"
	];
	const mosaicPluginRef = (0, _bensitu_image_editor_sdk.definePluginRef)("plugin:mosaic", "1.0.0");
	function mosaicPlugin(options = {}) {
		const configuration = resolveMosaicConfiguration(options);
		let controller = null;
		return (0, _bensitu_image_editor_sdk.definePlugin)({
			ref: mosaicPluginRef,
			manifest: {
				id: mosaicPluginRef.id,
				version: "1.0.0",
				apiVersion: mosaicPluginRef.apiVersion,
				engine: "^3.0.0",
				requires: [
					{
						token: _bensitu_image_editor_sdk.CORE_STATUS_CAPABILITY,
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
						token: _bensitu_image_editor_sdk.CANVAS_READ_CAPABILITY,
						range: "^1.0.0"
					},
					{
						token: _bensitu_image_editor_sdk.BASE_IMAGE_READ_CAPABILITY,
						range: "^1.0.0"
					},
					{
						token: _bensitu_image_editor_sdk.IMAGE_RESOURCE_POLICY_CAPABILITY,
						range: "^1.0.0"
					},
					{
						token: _bensitu_image_editor_sdk.RENDER_REQUEST_CAPABILITY,
						range: "^1.0.0"
					},
					{
						token: _bensitu_image_editor_sdk.RASTER_MUTATION_CAPABILITY,
						range: "^1.0.0"
					},
					{
						token: _bensitu_image_editor_sdk.SNAPSHOT_REGISTRATION_CAPABILITY,
						range: "^1.0.0"
					},
					{
						token: _bensitu_image_editor_sdk.GEOMETRY_MUTATION_CAPABILITY,
						range: "^1.0.0"
					}
				],
				optional: [{
					token: _bensitu_image_editor_sdk.VISIBLE_RASTER_BAKE_CAPABILITY,
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
				const status = context.capabilities.require(_bensitu_image_editor_sdk.CORE_STATUS_CAPABILITY);
				const diagnostics = context.capabilities.require(_bensitu_image_editor_sdk.CORE_DIAGNOSTICS_CAPABILITY);
				const fabricRuntime = context.capabilities.require(_bensitu_image_editor_sdk.FABRIC_RUNTIME_CAPABILITY);
				const canvas = context.capabilities.require(_bensitu_image_editor_sdk.CANVAS_READ_CAPABILITY);
				const baseImage = context.capabilities.require(_bensitu_image_editor_sdk.BASE_IMAGE_READ_CAPABILITY);
				const resourcePolicy = context.capabilities.require(_bensitu_image_editor_sdk.IMAGE_RESOURCE_POLICY_CAPABILITY);
				const render = context.capabilities.require(_bensitu_image_editor_sdk.RENDER_REQUEST_CAPABILITY);
				const raster = context.capabilities.require(_bensitu_image_editor_sdk.RASTER_MUTATION_CAPABILITY);
				const snapshots = context.capabilities.require(_bensitu_image_editor_sdk.SNAPSHOT_REGISTRATION_CAPABILITY);
				const geometry = context.capabilities.require(_bensitu_image_editor_sdk.GEOMETRY_MUTATION_CAPABILITY);
				const visibleRasterBake = context.capabilities.optional(_bensitu_image_editor_sdk.VISIBLE_RASTER_BAKE_CAPABILITY);
				controller = new MosaicController(Object.freeze({
					...status,
					...diagnostics,
					...fabricRuntime,
					...canvas,
					...baseImage,
					...resourcePolicy,
					...render
				}), geometry, raster, visibleRasterBake, context.capabilities.getOptionalStatus(_bensitu_image_editor_sdk.VISIBLE_RASTER_BAKE_CAPABILITY), configuration);
				const requireController = () => {
					if (!controller) throw new Error("Mosaic Plugin is not installed.");
					return controller;
				};
				for (const operationId of [
					"mosaic:enter",
					"mosaic:begin-stroke",
					"mosaic:append-stroke",
					"mosaic:end-stroke",
					"mosaic:cancel",
					"mosaic:configure"
				]) context.disposables.add(context.operations.register({
					id: operationId,
					mode: "busy",
					conflictDomains: mosaicPreviewDomains,
					reentrancy: "queue"
				}));
				context.disposables.add(context.operations.register({
					id: "mosaic:commit",
					mode: "mutation",
					conflictDomains: mosaicMutationDomains,
					reentrancy: "queue"
				}));
				context.disposables.add(context.tools.register({
					id: MOSAIC_TOOL_ID,
					enter: () => void 0,
					exit: () => {
						if (controller === null || controller === void 0 ? void 0 : controller.isActive) controller.cancel();
					},
					canRunOperation: (operationId) => operationId.startsWith("mosaic:") || operationId === "crop:enter" || operationId === "core:load-image" || operationId === "core:commit-load-image" || operationId === "core:load-state" || operationId === "core:export"
				}));
				context.disposables.add(snapshots.registerTransientObject(mosaicPluginRef.id, (object) => {
					var _a;
					return (_a = controller === null || controller === void 0 ? void 0 : controller.ownsPreview(object)) !== null && _a !== void 0 ? _a : false;
				}));
				const runPreviewOperation = (operationId, value, task) => context.operations.run(operationId, value, (args) => task(requireController(), args));
				return Object.freeze({
					get isActive() {
						return requireController().isActive;
					},
					enter: (enterOptions) => runPreviewOperation("mosaic:enter", enterOptions !== null && enterOptions !== void 0 ? enterOptions : {}, async (mosaic, value) => {
						if (mosaic.isActive) {
							mosaic.enter(value);
							return;
						}
						await context.tools.enter(MOSAIC_TOOL_ID);
						try {
							mosaic.enter(value);
						} catch (error) {
							await context.tools.exit("operation");
							throw error;
						}
					}),
					beginStroke: (point) => runPreviewOperation("mosaic:begin-stroke", point, (mosaic, value) => mosaic.beginStroke(value)),
					appendStroke: (point) => runPreviewOperation("mosaic:append-stroke", point, (mosaic, value) => mosaic.appendStroke(value)),
					endStroke: () => runPreviewOperation("mosaic:end-stroke", void 0, (mosaic) => mosaic.endStroke()),
					commit: async (commitOptions) => {
						try {
							await requireController().commit(commitOptions);
						} finally {
							if (context.tools.getActiveToolId() === MOSAIC_TOOL_ID) await context.tools.exit("operation");
						}
					},
					cancel: () => runPreviewOperation("mosaic:cancel", void 0, async (mosaic) => {
						mosaic.cancel();
						if (context.tools.getActiveToolId() === MOSAIC_TOOL_ID) await context.tools.exit("requested");
					}),
					configure: (patch) => runPreviewOperation("mosaic:configure", patch, (mosaic, value) => mosaic.configure(value)),
					getConfiguration: () => requireController().getConfiguration(),
					getSession: () => requireController().getSession(),
					subscribe: (listener) => requireController().subscribe(listener)
				});
			},
			onImageCleared(context) {
				if (context.tools.getActiveToolId() === MOSAIC_TOOL_ID) return context.tools.exit("operation");
				controller === null || controller === void 0 || controller.closeForImage();
			},
			onDispose() {
				controller === null || controller === void 0 || controller.dispose();
				controller = null;
			}
		});
	}

//#endregion
exports.MosaicError = MosaicError;
exports.MosaicIntegrationError = MosaicIntegrationError;
exports.MosaicSessionError = MosaicSessionError;
exports.MosaicValidationError = MosaicValidationError;
exports.mosaicPlugin = mosaicPlugin;
exports.mosaicPluginRef = mosaicPluginRef;
});
//# sourceMappingURL=image-editor.plugin.mosaic.umd.js.map