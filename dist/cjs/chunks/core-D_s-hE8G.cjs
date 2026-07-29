const require_plugin_identifier = require('./plugin-identifier-gLkfk0AM.cjs');
const require_core_capabilities = require('./core-capabilities-CWXMFfBX.cjs');
const require_plugin_manager = require('./plugin-manager-CU2i7a0b.cjs');
const require_image_budget = require('./image-budget-BCsM4W1R.cjs');
const require_internal_operation_conflict_domains = require('./internal-operation-conflict-domains-H4wymp0y.cjs');

//#region dist/esm/utils/dom.js
function forceReflow(element) {
	if (!element) return;
	element.offsetWidth;
}

//#endregion
//#region dist/esm/image/layout-manager.js
function selectLayoutStrategy(mode) {
	return mode;
}
const ZERO_SCROLLBAR_SIZE = Object.freeze({
	width: 0,
	height: 0
});
const scrollbarSizeCache = /* @__PURE__ */ new WeakMap();
var ViewportCache = class {
	constructor() {
		Object.defineProperty(this, "lastVisible", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: null
		});
	}
	measure(container, fallback, scrollbarSize) {
		var _a;
		if (!container) return fallback;
		const containerWidth = Math.floor(container.clientWidth);
		const containerHeight = Math.floor(container.clientHeight);
		if (containerWidth > 0 && containerHeight > 0) {
			this.lastVisible = measureContainerViewport(container, fallback, scrollbarSize);
			return this.lastVisible;
		}
		return (_a = this.lastVisible) !== null && _a !== void 0 ? _a : fallback;
	}
	peek() {
		return this.lastVisible;
	}
	clear() {
		this.lastVisible = null;
	}
};
const OVERFLOW_EPSILON = .5;
function normalizeOverflowValue(value) {
	return typeof value === "string" ? value.trim().toLowerCase() : "";
}
function getContainerOverflowValues(container) {
	var _a, _b;
	const style = container.style;
	let computedOverflow = "";
	let computedOverflowX = "";
	let computedOverflowY = "";
	const view = (_b = (_a = container.ownerDocument) === null || _a === void 0 ? void 0 : _a.defaultView) !== null && _b !== void 0 ? _b : typeof window === "undefined" ? null : window;
	if (typeof (view === null || view === void 0 ? void 0 : view.getComputedStyle) === "function") {
		const computed = view.getComputedStyle(container);
		computedOverflow = computed.overflow;
		computedOverflowX = computed.overflowX;
		computedOverflowY = computed.overflowY;
	}
	const x = [
		normalizeOverflowValue(style === null || style === void 0 ? void 0 : style.overflow),
		normalizeOverflowValue(style === null || style === void 0 ? void 0 : style.overflowX),
		normalizeOverflowValue(computedOverflow),
		normalizeOverflowValue(computedOverflowX)
	];
	const y = [
		normalizeOverflowValue(style === null || style === void 0 ? void 0 : style.overflow),
		normalizeOverflowValue(style === null || style === void 0 ? void 0 : style.overflowY),
		normalizeOverflowValue(computedOverflow),
		normalizeOverflowValue(computedOverflowY)
	];
	return {
		x,
		y,
		all: [...x, ...y]
	};
}
function isAutoScrollableOverflow(value) {
	return value === "auto" || value === "overlay";
}
function measureScrollbarSize(ownerDocument) {
	const doc = ownerDocument !== null && ownerDocument !== void 0 ? ownerDocument : typeof document === "undefined" ? null : document;
	if (!(doc === null || doc === void 0 ? void 0 : doc.body)) return ZERO_SCROLLBAR_SIZE;
	const cached = scrollbarSizeCache.get(doc);
	if (cached) return cached;
	const probe = doc.createElement("div");
	probe.style.position = "absolute";
	probe.style.left = "-9999px";
	probe.style.top = "-9999px";
	probe.style.width = "100px";
	probe.style.height = "100px";
	probe.style.overflow = "scroll";
	probe.style.visibility = "hidden";
	probe.style.pointerEvents = "none";
	doc.body.appendChild(probe);
	const width = Math.max(0, probe.offsetWidth - probe.clientWidth);
	const height = Math.max(0, probe.offsetHeight - probe.clientHeight);
	probe.remove();
	const measured = Object.freeze({
		width,
		height
	});
	scrollbarSizeCache.set(doc, measured);
	return measured;
}
function normalizeScrollbarSize(scrollbarSize) {
	return {
		width: Math.max(0, Number(scrollbarSize === null || scrollbarSize === void 0 ? void 0 : scrollbarSize.width) || 0),
		height: Math.max(0, Number(scrollbarSize === null || scrollbarSize === void 0 ? void 0 : scrollbarSize.height) || 0)
	};
}
function measureContainerViewport(container, fallback, scrollbarSize) {
	if (!container) return fallback;
	const clientWidth = Math.floor(container.clientWidth || 0);
	const clientHeight = Math.floor(container.clientHeight || 0);
	if (clientWidth <= 0 || clientHeight <= 0) return fallback;
	const overflow = getContainerOverflowValues(container);
	if (overflow.all.includes("scroll")) return {
		width: clientWidth,
		height: clientHeight
	};
	const scrollbar = normalizeScrollbarSize(scrollbarSize);
	const canAutoScrollX = overflow.x.some(isAutoScrollableOverflow);
	const canAutoScrollY = overflow.y.some(isAutoScrollableOverflow);
	const scrollWidth = Math.ceil(container.scrollWidth || 0);
	const scrollHeight = Math.ceil(container.scrollHeight || 0);
	const hasHorizontalScrollbar = canAutoScrollX && scrollWidth > clientWidth + OVERFLOW_EPSILON;
	return {
		width: clientWidth + (canAutoScrollY && scrollHeight > clientHeight + OVERFLOW_EPSILON ? scrollbar.width : 0),
		height: clientHeight + (hasHorizontalScrollbar ? scrollbar.height : 0)
	};
}
function computeScrollableCanvasSize(contentWidth, contentHeight, viewport, scrollbarSize) {
	const viewportW = Math.max(1, viewport.width || 1);
	const viewportH = Math.max(1, viewport.height || 1);
	const scrollbar = normalizeScrollbarSize(scrollbarSize);
	let hasHorizontal = false;
	let hasVertical = false;
	for (let i = 0; i < 4; i += 1) {
		const effectiveW = Math.max(1, viewportW - (hasVertical ? scrollbar.width : 0));
		const effectiveH = Math.max(1, viewportH - (hasHorizontal ? scrollbar.height : 0));
		const nextHorizontal = contentWidth > effectiveW + OVERFLOW_EPSILON;
		const nextVertical = contentHeight > effectiveH + OVERFLOW_EPSILON;
		if (nextHorizontal === hasHorizontal && nextVertical === hasVertical) break;
		hasHorizontal = nextHorizontal;
		hasVertical = nextVertical;
	}
	const effectiveW = Math.max(1, viewportW - (hasVertical ? scrollbar.width : 0));
	const effectiveH = Math.max(1, viewportH - (hasHorizontal ? scrollbar.height : 0));
	return {
		width: hasHorizontal ? Math.ceil(contentWidth) : effectiveW,
		height: hasVertical ? Math.ceil(contentHeight) : effectiveH
	};
}
function computeFitLayout(imageWidth, imageHeight, optionsCanvasWidth, optionsCanvasHeight, containerSize) {
	const canvasWidth = Math.max(1, (containerSize.width || optionsCanvasWidth) - 1);
	const canvasHeight = Math.max(1, (containerSize.height || optionsCanvasHeight) - 1);
	const fitScale = Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight, 1);
	return {
		canvasWidth,
		canvasHeight,
		imageScale: fitScale,
		imageLeft: 0,
		imageTop: 0,
		baseImageScale: fitScale
	};
}
function computeCoverLayout(imageWidth, imageHeight, optionsCanvasWidth, optionsCanvasHeight, containerSize, scrollbarSize) {
	const viewportW = containerSize.width || optionsCanvasWidth;
	const viewportH = containerSize.height || optionsCanvasHeight;
	const scrollbar = normalizeScrollbarSize(scrollbarSize);
	let hasHorizontal = false;
	let hasVertical = false;
	let coverScale = 1;
	let scaledW = imageWidth;
	let scaledH = imageHeight;
	for (let i = 0; i < 4; i += 1) {
		const effectiveW = Math.max(1, viewportW - (hasVertical ? scrollbar.width : 0));
		const effectiveH = Math.max(1, viewportH - (hasHorizontal ? scrollbar.height : 0));
		coverScale = Math.min(1, Math.max(effectiveW / imageWidth, effectiveH / imageHeight));
		scaledW = imageWidth * coverScale;
		scaledH = imageHeight * coverScale;
		const nextHasHorizontal = scaledW > effectiveW + OVERFLOW_EPSILON;
		const nextHasVertical = scaledH > effectiveH + OVERFLOW_EPSILON;
		if (nextHasHorizontal === hasHorizontal && nextHasVertical === hasVertical) break;
		hasHorizontal = nextHasHorizontal;
		hasVertical = nextHasVertical;
	}
	const canvasSize = computeScrollableCanvasSize(scaledW, scaledH, {
		width: viewportW,
		height: viewportH
	}, scrollbar);
	return {
		canvasWidth: canvasSize.width,
		canvasHeight: canvasSize.height,
		imageScale: coverScale,
		imageLeft: 0,
		imageTop: 0,
		baseImageScale: coverScale
	};
}
function computeExpandLayout(imageWidth, imageHeight, containerSize) {
	return {
		canvasWidth: Math.max(containerSize.width, Math.floor(imageWidth)),
		canvasHeight: Math.max(containerSize.height, Math.floor(imageHeight)),
		imageScale: 1,
		imageLeft: 0,
		imageTop: 0,
		baseImageScale: 1
	};
}
function applyCanvasDimensions(canvas, width, height, containerElement) {
	const integerWidth = Math.max(1, Math.round(Number(width) || 1));
	const integerHeight = Math.max(1, Math.round(Number(height) || 1));
	canvas.setDimensions({
		width: integerWidth,
		height: integerHeight
	});
	forceReflow(containerElement);
}

//#endregion
//#region dist/esm/core-runtime/errors.js
function severityFor(behavior) {
	if (behavior === "operation-cancelled") return "cancelled";
	if (behavior === "recoverable-object" || behavior === "recoverable-optional-capability" || behavior === "operation-conflict") return "recoverable";
	return "fatal";
}
function errorCode(value) {
	if (!value || typeof value !== "object" || !("code" in value)) return null;
	return typeof value.code === "string" ? value.code : null;
}
function classifyCoreError(error) {
	if (error instanceof CoreRuntimeError) return Object.freeze({
		behavior: error.behavior,
		severity: error.severity
	});
	if (error instanceof DOMException && error.name === "AbortError") return Object.freeze({
		behavior: "operation-cancelled",
		severity: "cancelled"
	});
	const code = errorCode(error);
	if (code === "OPTIONAL_CAPABILITY_INCOMPATIBLE") return Object.freeze({
		behavior: "recoverable-optional-capability",
		severity: "recoverable"
	});
	if (code === "OPERATION_CONFLICT") return Object.freeze({
		behavior: "operation-conflict",
		severity: "recoverable"
	});
	return Object.freeze({
		behavior: "fatal-participant",
		severity: "fatal"
	});
}
var CoreRuntimeError = class extends Error {
	constructor(message, options = {}) {
		var _a, _b;
		super(message);
		Object.defineProperty(this, "code", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "cause", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "behavior", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "severity", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		this.name = new.target.name;
		this.code = (_a = options.code) !== null && _a !== void 0 ? _a : "CORE_RUNTIME_ERROR";
		this.cause = options.cause;
		this.behavior = (_b = options.behavior) !== null && _b !== void 0 ? _b : "fatal-participant";
		this.severity = severityFor(this.behavior);
	}
};
var EditorAlreadyInitializedError = class extends CoreRuntimeError {
	constructor() {
		super("[ImageEditor] The editor is already initialized.", {
			code: "EDITOR_ALREADY_INITIALIZED",
			behavior: "lifecycle"
		});
	}
};
var EditorInitializationInProgressError = class extends CoreRuntimeError {
	constructor(operation = "initialize") {
		super(`[ImageEditor] Cannot ${operation} while initialization is in progress.`, {
			code: "EDITOR_INITIALIZATION_IN_PROGRESS",
			behavior: "lifecycle"
		});
	}
};
var EditorDisposingError = class extends CoreRuntimeError {
	constructor(operation) {
		super(`[ImageEditor] Cannot ${operation} while the editor is disposing.`, {
			code: "EDITOR_DISPOSING",
			behavior: "lifecycle"
		});
	}
};
var EditorDisposedError = class extends CoreRuntimeError {
	constructor(operation) {
		super(`[ImageEditor] Cannot ${operation} after the editor has been disposed.`, {
			code: "EDITOR_DISPOSED",
			behavior: "lifecycle"
		});
	}
};
var EditorFaultedError = class extends CoreRuntimeError {
	constructor(operation) {
		super(`[ImageEditor] Cannot ${operation} while the editor is faulted.`, {
			code: "EDITOR_FAULTED",
			behavior: "lifecycle"
		});
	}
};
var StateRegistrationError = class extends CoreRuntimeError {
	constructor(message, sliceId) {
		super(`[ImageEditor] ${message}`, { code: "STATE_REGISTRATION_ERROR" });
		Object.defineProperty(this, "sliceId", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: sliceId
		});
	}
};
var StateCloneError = class extends CoreRuntimeError {
	constructor(message, cause) {
		super(`[ImageEditor] ${message}`, {
			code: "STATE_CLONE_ERROR",
			cause
		});
	}
};
var MementoCaptureError = class extends CoreRuntimeError {
	constructor(sliceId, cause) {
		super(`[ImageEditor] Failed to capture state slice "${sliceId}".`, {
			code: "MEMENTO_CAPTURE_ERROR",
			cause
		});
		Object.defineProperty(this, "sliceId", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: sliceId
		});
	}
};
var MementoRestoreError = class extends CoreRuntimeError {
	constructor(sliceId, phase, cause, rollbackErrors = []) {
		super(`[ImageEditor] Failed to ${phase} state slice "${sliceId}"${rollbackErrors.length > 0 ? `; ${rollbackErrors.length} rollback error(s) followed` : ""}.`, {
			code: "MEMENTO_RESTORE_ERROR",
			cause,
			behavior: rollbackErrors.length > 0 ? "fatal-rollback" : "fatal-restore"
		});
		Object.defineProperty(this, "sliceId", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: sliceId
		});
		Object.defineProperty(this, "phase", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: phase
		});
		Object.defineProperty(this, "rollbackErrors", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: rollbackErrors
		});
	}
};
var SnapshotValidationError = class extends CoreRuntimeError {
	constructor(message, path = "$", cause, code = "SNAPSHOT_VALIDATION_ERROR") {
		super(`[ImageEditor] Invalid snapshot at ${path}: ${message}`, {
			code,
			cause,
			behavior: "snapshot-validation"
		});
		Object.defineProperty(this, "path", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: path
		});
	}
};
var SnapshotVersionUnsupportedError = class extends SnapshotValidationError {
	constructor(detectedVersion = "unversioned") {
		super(`snapshot version "${detectedVersion}" is unsupported; migrate it with "@bensitu/image-editor/migrate-v2" before loading.`, "$.version", void 0, "SNAPSHOT_VERSION_UNSUPPORTED");
		Object.defineProperty(this, "detectedVersion", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: detectedVersion
		});
		Object.defineProperty(this, "migrationEntry", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: "@bensitu/image-editor/migrate-v2"
		});
	}
};
var EmergencyResetError = class extends CoreRuntimeError {
	constructor(diagnostics, cause) {
		super(`[ImageEditor] Emergency reset failed with ${diagnostics.length} diagnostic(s); the editor was permanently disposed.`, {
			code: "EMERGENCY_RESET_ERROR",
			cause,
			behavior: "lifecycle"
		});
		Object.defineProperty(this, "diagnostics", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: diagnostics
		});
	}
};
var GeometryRegistrationError = class extends CoreRuntimeError {
	constructor(message, participantId) {
		super(`[ImageEditor] ${message}`, { code: "GEOMETRY_REGISTRATION_ERROR" });
		Object.defineProperty(this, "participantId", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: participantId
		});
	}
};
var GeometryMutationError = class extends CoreRuntimeError {
	constructor(mutationId, message, cause, rollbackErrors = []) {
		super(`[ImageEditor] Geometry mutation "${mutationId}" failed: ${message}`, {
			code: "GEOMETRY_MUTATION_ERROR",
			cause
		});
		Object.defineProperty(this, "mutationId", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: mutationId
		});
		Object.defineProperty(this, "rollbackErrors", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: rollbackErrors
		});
	}
};
var GeometryRecoverableObjectError = class extends CoreRuntimeError {
	constructor(message, objectIdentity, objectKind, cause) {
		super(`[ImageEditor] Recoverable overlay geometry failure: ${message}`, {
			code: "GEOMETRY_RECOVERABLE_OBJECT_ERROR",
			cause,
			behavior: "recoverable-object"
		});
		Object.defineProperty(this, "objectIdentity", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: objectIdentity
		});
		Object.defineProperty(this, "objectKind", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: objectKind
		});
	}
};
var GeometryUnrecoverableError = class extends CoreRuntimeError {
	constructor(mutationId, cause, errors) {
		super(`[ImageEditor] Geometry mutation "${mutationId}" could not restore its pre-operation state.`, {
			code: "GEOMETRY_UNRECOVERABLE_ERROR",
			cause,
			behavior: "fatal-restore"
		});
		Object.defineProperty(this, "mutationId", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: mutationId
		});
		Object.defineProperty(this, "errors", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: errors
		});
	}
};
var DocumentMutationRegistrationError = class extends CoreRuntimeError {
	constructor(message, transactionId) {
		super(`[ImageEditor] ${message}`, { code: "DOCUMENT_MUTATION_REGISTRATION_ERROR" });
		Object.defineProperty(this, "transactionId", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: transactionId
		});
	}
};
var DocumentMutationError = class extends CoreRuntimeError {
	constructor(transactionId, message, cause, rollbackErrors = [], code = "DOCUMENT_MUTATION_ERROR", behavior = rollbackErrors.length > 0 ? "fatal-rollback" : "fatal-participant") {
		super(`[ImageEditor] Document mutation "${transactionId}" failed: ${message}`, {
			code,
			cause,
			behavior
		});
		Object.defineProperty(this, "transactionId", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: transactionId
		});
		Object.defineProperty(this, "rollbackErrors", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: rollbackErrors
		});
	}
};
var DocumentMutationInvariantError = class extends DocumentMutationError {
	constructor(transactionId, cause) {
		super(transactionId, cause instanceof Error ? cause.message : "invariant validation failed.", cause, [], "DOCUMENT_MUTATION_INVARIANT_ERROR", "fatal-invariant");
	}
};
var DocumentMutationUnrecoverableError = class extends DocumentMutationError {
	constructor(transactionId, cause, rollbackErrors) {
		super(transactionId, "the pre-operation state could not be restored.", cause, rollbackErrors, "DOCUMENT_MUTATION_UNRECOVERABLE_ERROR", "fatal-restore");
	}
};

//#endregion
//#region dist/esm/core-runtime/core-state-adapter.js
const DEFAULT_SECURITY_LIMITS = Object.freeze({
	maxDecodedPixels: 5e7,
	maxImageDimension: 32768,
	decodeTimeoutMs: 15e3
});
function isRecord$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isPositiveSafeInteger(value) {
	return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function isImageMimeType(value) {
	return value === "image/jpeg" || value === "image/png" || value === "image/webp";
}
function isBaseImage(object) {
	return object.editorObjectKind === "baseImage";
}
function disposeReplacedBaseImage(previous, replacement, operation) {
	if (!previous || previous === replacement) return;
	try {
		previous.dispose();
	} catch (cause) {
		throw new CoreRuntimeError(`[ImageEditor] Replaced base image cleanup failed during ${operation}.`, {
			code: "BASE_IMAGE_DISPOSAL_ERROR",
			cause
		});
	}
}
function disposeRejectedBaseImages(canvas, retainedImage, cause) {
	const cleanupErrors = [];
	let objects = [];
	try {
		objects = canvas.getObjects();
	} catch (error) {
		cleanupErrors.push(error);
	}
	const visited = /* @__PURE__ */ new Set();
	for (const object of objects) {
		if (!isBaseImage(object) || object === retainedImage || visited.has(object)) continue;
		visited.add(object);
		try {
			disposeReplacedBaseImage(object, null, "failed state restore");
		} catch (error) {
			cleanupErrors.push(error);
		}
	}
	if (cleanupErrors.length > 0) throw new CoreRuntimeError("[ImageEditor] State restore failed and rejected base image cleanup also failed.", { cause: Object.freeze([cause, ...cleanupErrors]) });
}
var CanvasCoreStateAdapter = class {
	constructor(access, properties, transientObjects, externalObjects, securityLimits = DEFAULT_SECURITY_LIMITS) {
		Object.defineProperty(this, "access", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: access
		});
		Object.defineProperty(this, "properties", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: properties
		});
		Object.defineProperty(this, "transientObjects", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: transientObjects
		});
		Object.defineProperty(this, "externalObjects", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: externalObjects
		});
		Object.defineProperty(this, "securityLimits", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: securityLimits
		});
	}
	capture(context) {
		const canvas = this.access.getCanvas();
		if (!canvas) return {
			initialized: false,
			canvasWidth: 0,
			canvasHeight: 0,
			canvas: null,
			imageMimeType: null,
			baseImageScale: 1,
			geometryRevision: this.access.getGeometryRevision()
		};
		const serializedValue = canvas.toJSON(this.properties.listKeys());
		if (!isRecord$1(serializedValue)) throw new SnapshotValidationError("Fabric canvas serialization must be an object.");
		const serialized = { ...serializedValue };
		const serializedObjects = Array.isArray(serialized.objects) ? serialized.objects : [];
		const liveObjects = canvas.getObjects();
		const propertyKeys = this.properties.listKeys();
		for (let index = 0; index < serializedObjects.length; index += 1) {
			const serializedObject = serializedObjects[index];
			const liveObject = liveObjects[index];
			if (!isRecord$1(serializedObject) || !liveObject) continue;
			const liveRecord = liveObject;
			for (const key of propertyKeys) if (liveRecord[key] !== void 0) serializedObject[key] = liveRecord[key];
		}
		serialized.objects = serializedObjects.filter((entry, index) => {
			const liveObject = liveObjects[index];
			if (!entry || !liveObject || this.transientObjects.isTransient(liveObject) || this.externalObjects.isTransient(liveObject)) return false;
			if (context.mode === "snapshot") return isBaseImage(liveObject);
			return true;
		});
		return {
			initialized: true,
			canvasWidth: canvas.getWidth(),
			canvasHeight: canvas.getHeight(),
			canvas: serialized,
			imageMimeType: this.access.getImageMimeType(),
			baseImageScale: this.access.getBaseImageScale(),
			geometryRevision: this.access.getGeometryRevision()
		};
	}
	async restore(state, context) {
		var _a, _b, _c;
		if (this.access.isDisposed()) throw new Error("Cannot restore Core state after disposal.");
		const validated = this.validateState(state, context.mode === "public-snapshot");
		if (!validated.valid) throw new SnapshotValidationError(validated.message, validated.path);
		const next = validated.value;
		if (context.signal.aborted) throw (_a = context.signal.reason) !== null && _a !== void 0 ? _a : /* @__PURE__ */ new Error("State restore aborted.");
		const previousBaseImage = this.access.getBaseImage();
		if (!next.initialized) {
			const canvas = this.access.getCanvas();
			canvas === null || canvas === void 0 || canvas.clear();
			this.access.setBaseImage(null);
			this.access.setImageMimeType(null);
			this.access.setBaseImageScale(1);
			this.access.setGeometryRevision(next.geometryRevision);
			disposeReplacedBaseImage(previousBaseImage, null, "state restore");
			return;
		}
		const canvas = this.access.getCanvas();
		if (!canvas) throw new Error("Core Canvas must be initialized before state restore.");
		this.access.setCanvasSize(next.canvasWidth, next.canvasHeight);
		if (!next.canvas) throw new Error("Initialized Core state requires Canvas JSON.");
		const controller = new AbortController();
		const abort = () => controller.abort(context.signal.reason);
		context.signal.addEventListener("abort", abort, { once: true });
		if (context.signal.aborted) abort();
		const timeout = setTimeout(() => {
			controller.abort(new SnapshotValidationError(`Canvas decode timed out after ${this.securityLimits.decodeTimeoutMs}ms.`, "$.core.canvas"));
		}, this.securityLimits.decodeTimeoutMs);
		try {
			try {
				await canvas.loadFromJSON(next.canvas, void 0, { signal: controller.signal });
			} catch (error) {
				if (controller.signal.aborted && controller.signal.reason) throw controller.signal.reason;
				throw error;
			} finally {
				clearTimeout(timeout);
				context.signal.removeEventListener("abort", abort);
			}
			if (context.signal.aborted) throw (_b = context.signal.reason) !== null && _b !== void 0 ? _b : /* @__PURE__ */ new Error("State restore aborted.");
			const baseImages = canvas.getObjects().filter(isBaseImage);
			if (baseImages.length > 1) throw new Error("Restored Core state contains multiple base images.");
			const baseImage = (_c = baseImages[0]) !== null && _c !== void 0 ? _c : null;
			if (baseImage) {
				baseImage.set({
					selectable: false,
					evented: false
				});
				baseImage.setCoords();
				canvas.sendObjectToBack(baseImage);
			}
			this.access.setBaseImage(baseImage);
			this.access.setImageMimeType(next.imageMimeType);
			this.access.setBaseImageScale(next.baseImageScale);
			this.access.setGeometryRevision(next.geometryRevision);
			disposeReplacedBaseImage(previousBaseImage, baseImage, "state restore");
		} catch (error) {
			if (this.access.getBaseImage() === previousBaseImage) disposeRejectedBaseImages(canvas, previousBaseImage, error);
			throw error;
		}
	}
	validateSnapshot(value) {
		return this.validateState(value, true);
	}
	validateState(value, publicInput) {
		if (!isRecord$1(value)) return {
			valid: false,
			message: "Core state must be an object."
		};
		if (typeof value.initialized !== "boolean") return {
			valid: false,
			message: "initialized must be boolean.",
			path: "$.core.initialized"
		};
		if (!Number.isSafeInteger(value.geometryRevision) || Number(value.geometryRevision) < 0) return {
			valid: false,
			message: "geometryRevision must be a non-negative integer.",
			path: "$.core:geometryRevision"
		};
		if (!value.initialized) return {
			valid: true,
			value: {
				initialized: false,
				canvasWidth: 0,
				canvasHeight: 0,
				canvas: null,
				imageMimeType: null,
				baseImageScale: 1,
				geometryRevision: Number(value.geometryRevision)
			}
		};
		if (!isPositiveSafeInteger(value.canvasWidth) || !isPositiveSafeInteger(value.canvasHeight)) return {
			valid: false,
			message: "Canvas dimensions must be positive safe integers.",
			path: "$.core.canvasWidth"
		};
		if (!require_image_budget.isRasterAllocationWithinBudget(value.canvasWidth, value.canvasHeight, {
			maxDimension: this.securityLimits.maxImageDimension,
			maxPixels: this.securityLimits.maxDecodedPixels
		})) return {
			valid: false,
			message: "Canvas dimensions exceed the configured Snapshot budget.",
			path: "$.core.canvasWidth"
		};
		if (!isRecord$1(value.canvas)) return {
			valid: false,
			message: "canvas must be an object.",
			path: "$.core.canvas"
		};
		if (publicInput) {
			const objects = value.canvas.objects;
			if (!Array.isArray(objects)) return {
				valid: false,
				message: "Canvas objects must be an array.",
				path: "$.core.canvas.objects"
			};
			for (let index = 0; index < objects.length; index += 1) {
				const object = objects[index];
				if (!isRecord$1(object)) return {
					valid: false,
					message: "Canvas object must be a record.",
					path: `$.core.canvas.objects.${index}`
				};
				if (object.type !== "Image") return {
					valid: false,
					message: `unknown Fabric class "${String(object.type)}".`,
					path: `$.core.canvas.objects.${index}.type`
				};
				if (object.editorObjectKind !== "baseImage") return {
					valid: false,
					message: "persistent Canvas objects require an installed Object Codec.",
					path: `$.core.canvas.objects.${index}.editorObjectKind`
				};
				if ("filters" in object && (!Array.isArray(object.filters) || object.filters.length > 0)) return {
					valid: false,
					message: "Base Image Fabric filters are not accepted in public Snapshots.",
					path: `$.core.canvas.objects.${index}.filters`
				};
			}
			if (objects.length > 1) return {
				valid: false,
				message: "Public Core Snapshot may contain at most one base image.",
				path: "$.core.canvas.objects"
			};
		}
		if (value.imageMimeType !== null && value.imageMimeType !== void 0 && !isImageMimeType(value.imageMimeType)) return {
			valid: false,
			message: "imageMimeType is unsupported.",
			path: "$.core.imageMimeType"
		};
		if (typeof value.baseImageScale !== "number" || !Number.isFinite(value.baseImageScale) || value.baseImageScale <= 0) return {
			valid: false,
			message: "baseImageScale must be positive and finite.",
			path: "$.core.baseImageScale"
		};
		return {
			valid: true,
			value: {
				initialized: true,
				canvasWidth: value.canvasWidth,
				canvasHeight: value.canvasHeight,
				canvas: value.canvas,
				imageMimeType: isImageMimeType(value.imageMimeType) ? value.imageMimeType : null,
				baseImageScale: value.baseImageScale,
				geometryRevision: Number(value.geometryRevision)
			}
		};
	}
};

//#endregion
//#region dist/esm/core-runtime/export-contributor-registry.js
var ExportContributorRegistry = class {
	constructor() {
		Object.defineProperty(this, "contributors", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Map()
		});
		Object.defineProperty(this, "registrationSequence", {
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
	register(owner, contributor) {
		this.assertActive("register an export contributor");
		if (!require_plugin_identifier.isRuntimeIdentifier(owner)) throw new CoreRuntimeError("[ImageEditor] Invalid Export contributor owner Runtime ID.");
		if (!require_plugin_identifier.isRuntimeIdentifier(contributor.id)) throw new CoreRuntimeError("[ImageEditor] Invalid Export contributor Runtime ID.");
		if (!Number.isFinite(contributor.order)) throw new CoreRuntimeError(`[ImageEditor] Export contributor "${contributor.id}" must use a finite order.`);
		const existing = this.contributors.get(contributor.id);
		if (existing) throw new CoreRuntimeError(`[ImageEditor] Export contributor "${contributor.id}" is already registered by "${existing.owner}".`);
		const record = {
			owner,
			contributor: Object.freeze({ ...contributor }),
			registrationOrder: this.registrationSequence++
		};
		this.contributors.set(contributor.id, record);
		return require_core_capabilities.createDisposable(() => {
			if (this.contributors.get(contributor.id) === record) this.contributors.delete(contributor.id);
		});
	}
	async render(context) {
		this.assertActive("render export contributors");
		const records = [...this.contributors.values()].sort((left, right) => left.contributor.order - right.contributor.order || left.registrationOrder - right.registrationOrder);
		for (const record of records) {
			let enabled;
			try {
				enabled = record.contributor.isEnabled(context.options);
			} catch (error) {
				throw new CoreRuntimeError(`[ImageEditor] Export contributor "${record.contributor.id}" enablement failed.`, {
					code: "EXPORT_CONTRIBUTOR_ERROR",
					cause: error
				});
			}
			if (!enabled) continue;
			try {
				await record.contributor.render(context);
			} catch (error) {
				throw new CoreRuntimeError(`[ImageEditor] Export contributor "${record.contributor.id}" render failed.`, {
					code: "EXPORT_CONTRIBUTOR_ERROR",
					cause: error
				});
			}
		}
	}
	dispose() {
		if (this.disposed) return;
		this.contributors.clear();
		this.disposed = true;
	}
	assertActive(operation) {
		if (this.disposed) throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} after disposal.`);
	}
};

//#endregion
//#region dist/esm/core-runtime/geometry/affine-matrix.js
const IDENTITY_AFFINE_MATRIX = Object.freeze([
	1,
	0,
	0,
	1,
	0,
	0
]);
const AFFINE_EPSILON = 1e-10;
function isFiniteAffineMatrix(value) {
	return Array.isArray(value) && value.length === 6 && value.every((entry) => typeof entry === "number" && Number.isFinite(entry));
}
function assertAffineMatrix(value, label = "matrix") {
	if (!isFiniteAffineMatrix(value)) throw new GeometryMutationError("affine", `${label} must contain six finite numbers.`);
}
function affineDeterminant(matrix) {
	return matrix[0] * matrix[3] - matrix[1] * matrix[2];
}
function hasAffineReflection(matrix) {
	return affineDeterminant(matrix) < 0;
}
function multiplyAffine(left, right) {
	const [a1, b1, c1, d1, e1, f1] = left;
	const [a2, b2, c2, d2, e2, f2] = right;
	return Object.freeze([
		a1 * a2 + c1 * b2,
		b1 * a2 + d1 * b2,
		a1 * c2 + c1 * d2,
		b1 * c2 + d1 * d2,
		a1 * e2 + c1 * f2 + e1,
		b1 * e2 + d1 * f2 + f1
	]);
}
function invertAffine(matrix, epsilon = AFFINE_EPSILON) {
	const [a, b, c, d, e, f] = matrix;
	const determinant = affineDeterminant(matrix);
	if (!Number.isFinite(determinant) || Math.abs(determinant) <= epsilon) throw new GeometryMutationError("affine", "matrix is singular and cannot be inverted.");
	return Object.freeze([
		d / determinant,
		-b / determinant,
		-c / determinant,
		a / determinant,
		(c * f - d * e) / determinant,
		(b * e - a * f) / determinant
	]);
}
function applyAffineToPoint(matrix, point) {
	return Object.freeze({
		x: matrix[0] * point.x + matrix[2] * point.y + matrix[4],
		y: matrix[1] * point.x + matrix[3] * point.y + matrix[5]
	});
}
function transformRectBounds(matrix, rect) {
	const points = [
		applyAffineToPoint(matrix, {
			x: rect.left,
			y: rect.top
		}),
		applyAffineToPoint(matrix, {
			x: rect.left + rect.width,
			y: rect.top
		}),
		applyAffineToPoint(matrix, {
			x: rect.left,
			y: rect.top + rect.height
		}),
		applyAffineToPoint(matrix, {
			x: rect.left + rect.width,
			y: rect.top + rect.height
		})
	];
	const xs = points.map((point) => point.x);
	const ys = points.map((point) => point.y);
	const left = Math.min(...xs);
	const top = Math.min(...ys);
	return Object.freeze({
		left,
		top,
		width: Math.max(...xs) - left,
		height: Math.max(...ys) - top
	});
}
function approximatelyEqualAffine(left, right, epsilon = AFFINE_EPSILON) {
	return left.every((entry, index) => Math.abs(entry - right[index]) <= epsilon);
}
function sanitizeAffineMatrix(matrix, epsilon = AFFINE_EPSILON) {
	return Object.freeze(matrix.map((entry) => Math.abs(entry) <= epsilon ? 0 : entry));
}
function computeAffineDelta(before, after) {
	return sanitizeAffineMatrix(multiplyAffine(after, invertAffine(before)));
}

//#endregion
//#region dist/esm/core-runtime/state/clone-state-value.js
function isObject(value) {
	return typeof value === "object" && value !== null;
}
function assertSafeStateValue(value, seen = /* @__PURE__ */ new WeakSet(), path = "$") {
	var _a;
	if (!isObject(value) || seen.has(value)) return;
	seen.add(value);
	if (value instanceof Map) {
		for (const [key, entry] of value) {
			assertSafeStateValue(key, seen, `${path}.<map-key>`);
			assertSafeStateValue(entry, seen, `${path}.<map-value>`);
		}
		return;
	}
	if (value instanceof Set) {
		for (const entry of value) assertSafeStateValue(entry, seen, `${path}.<set-value>`);
		return;
	}
	if (value instanceof Date || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return;
	for (const key of Object.getOwnPropertySymbols(value)) if ((_a = Object.getOwnPropertyDescriptor(value, key)) === null || _a === void 0 ? void 0 : _a.enumerable) throw new StateCloneError(`State at ${path} contains an enumerable symbol key.`);
	const descriptors = Object.getOwnPropertyDescriptors(value);
	for (const [key, descriptor] of Object.entries(descriptors)) {
		if (!(descriptor === null || descriptor === void 0 ? void 0 : descriptor.enumerable)) continue;
		if (require_plugin_identifier.isDangerousStateKey(key)) throw new StateCloneError(`State contains dangerous key "${key}".`);
		if (!("value" in descriptor)) throw new StateCloneError(`State at ${path}.${key} contains an accessor property.`);
		assertSafeStateValue(descriptor.value, seen, `${path}.${key}`);
	}
}
function cloneFallback(value, seen) {
	var _a, _b;
	if (!isObject(value)) {
		if (typeof value === "function" || typeof value === "symbol") throw new StateCloneError(`State contains an unsupported ${typeof value} value.`);
		return value;
	}
	const existing = seen.get(value);
	if (existing !== void 0) return existing;
	if (value instanceof Date) return new Date(value.getTime());
	if (value instanceof ArrayBuffer) return value.slice(0);
	if (ArrayBuffer.isView(value)) {
		const source = value;
		return new Uint8Array(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength));
	}
	if (value instanceof Map) {
		const result = /* @__PURE__ */ new Map();
		seen.set(value, result);
		for (const [key, entry] of value) result.set(cloneFallback(key, seen), cloneFallback(entry, seen));
		return result;
	}
	if (value instanceof Set) {
		const result = /* @__PURE__ */ new Set();
		seen.set(value, result);
		for (const entry of value) result.add(cloneFallback(entry, seen));
		return result;
	}
	if (Array.isArray(value)) {
		const result = [];
		seen.set(value, result);
		for (const entry of value) result.push(cloneFallback(entry, seen));
		return result;
	}
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null) throw new StateCloneError(`State contains unsupported object type "${(_b = (_a = prototype === null || prototype === void 0 ? void 0 : prototype.constructor) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : "unknown"}".`);
	const result = Object.create(null);
	seen.set(value, result);
	for (const key of Object.keys(value)) {
		if (require_plugin_identifier.isDangerousStateKey(key)) throw new StateCloneError(`State contains dangerous key "${key}".`);
		result[key] = cloneFallback(value[key], seen);
	}
	return result;
}
function deepFreeze(value, seen = /* @__PURE__ */ new WeakSet()) {
	if (!isObject(value) || seen.has(value)) return value;
	seen.add(value);
	if (value instanceof Map) for (const [key, entry] of value) {
		deepFreeze(key, seen);
		deepFreeze(entry, seen);
	}
	else if (value instanceof Set) for (const entry of value) deepFreeze(entry, seen);
	else for (const key of Object.keys(value)) deepFreeze(value[key], seen);
	try {
		Object.freeze(value);
	} catch {}
	return value;
}
function cloneStateValue(value) {
	try {
		assertSafeStateValue(value);
		const structuredCloneFunction = globalThis.structuredClone;
		return deepFreeze(typeof structuredCloneFunction === "function" ? structuredCloneFunction(value) : cloneFallback(value, /* @__PURE__ */ new Map()));
	} catch (error) {
		if (error instanceof StateCloneError) throw error;
		throw new StateCloneError("State could not be cloned safely.", error);
	}
}
function assertSafeImmutableReference(value, path = "$", seen = /* @__PURE__ */ new WeakSet()) {
	var _a, _b;
	if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") throw new StateCloneError(`Reference state at ${path} contains an unsupported ${typeof value}.`);
	if (typeof value === "number" && !Number.isFinite(value)) throw new StateCloneError(`Reference state at ${path} contains a non-finite number.`);
	if (!isObject(value)) return;
	if (seen.has(value)) throw new StateCloneError(`Reference state at ${path} contains a cyclic reference.`);
	if (!Object.isFrozen(value)) throw new StateCloneError(`Reference state at ${path} must be frozen.`);
	const prototype = Object.getPrototypeOf(value);
	if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) throw new StateCloneError(`Reference state at ${path} contains unsupported object type "${(_b = (_a = prototype === null || prototype === void 0 ? void 0 : prototype.constructor) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : "unknown"}".`);
	seen.add(value);
	for (const key of Object.keys(value)) {
		if (require_plugin_identifier.isDangerousStateKey(key)) throw new StateCloneError(`Reference state at ${path} contains dangerous key "${key}".`);
		assertSafeImmutableReference(value[key], Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`, seen);
	}
	seen.delete(value);
}

//#endregion
//#region dist/esm/core-runtime/mutation/bounded-replay-id-tracker.js
const DEFAULT_RECENT_REPLAY_ID_LIMIT = 1e4;
var BoundedReplayIdTracker = class {
	constructor(recentLimit = DEFAULT_RECENT_REPLAY_ID_LIMIT) {
		Object.defineProperty(this, "recentLimit", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: recentLimit
		});
		Object.defineProperty(this, "activeIds", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Set()
		});
		Object.defineProperty(this, "recentCompletedIds", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Set()
		});
		if (!Number.isSafeInteger(recentLimit) || recentLimit <= 0) throw new RangeError("recentLimit must be a positive safe integer.");
	}
	get activeSize() {
		return this.activeIds.size;
	}
	get recentSize() {
		return this.recentCompletedIds.size;
	}
	has(id) {
		return this.activeIds.has(id) || this.recentCompletedIds.has(id);
	}
	start(id) {
		if (this.has(id)) return false;
		this.activeIds.add(id);
		return true;
	}
	complete(id) {
		if (!this.activeIds.delete(id)) return;
		this.recentCompletedIds.add(id);
		while (this.recentCompletedIds.size > this.recentLimit) {
			const oldest = this.recentCompletedIds.values().next().value;
			if (oldest === void 0) break;
			this.recentCompletedIds.delete(oldest);
		}
	}
	clear() {
		this.activeIds.clear();
		this.recentCompletedIds.clear();
	}
};

//#endregion
//#region dist/esm/core-runtime/geometry/geometry-mutation-coordinator.js
function assertIdentifier$2(value, label) {
	if (value.trim().length === 0 || value.trim() !== value) throw new GeometryMutationError(value || "unknown", `${label} must be non-empty and trimmed.`);
}
function freezeGeometry(snapshot) {
	if (!isFiniteAffineMatrix(snapshot.matrix) || !Number.isFinite(snapshot.canvasWidth) || !Number.isFinite(snapshot.canvasHeight) || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0) throw new GeometryMutationError("geometry", "captured geometry is malformed.");
	return Object.freeze({
		...snapshot,
		matrix: Object.freeze([...snapshot.matrix]),
		boundingBox: Object.freeze({ ...snapshot.boundingBox })
	});
}
function createDescriptor(request, before, after, metadata, provisional) {
	const affineDelta = provisional ? IDENTITY_AFFINE_MATRIX : request.kind === "raster-replace" ? null : computeAffineDelta(before.matrix, after.matrix);
	return Object.freeze({
		id: request.id,
		kind: request.kind,
		operationId: request.operationId,
		before,
		after,
		affineDelta,
		hasReflection: affineDelta ? hasAffineReflection(affineDelta) : false,
		...request.sourceRect ? { sourceRect: Object.freeze({ ...request.sourceRect }) } : {},
		...request.targetSize ? { targetSize: Object.freeze({ ...request.targetSize }) } : {},
		metadata
	});
}
var GeometryMutationCoordinator = class {
	constructor(options) {
		Object.defineProperty(this, "options", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: options
		});
		Object.defineProperty(this, "participants", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Map()
		});
		Object.defineProperty(this, "usedMutationIds", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: new BoundedReplayIdTracker()
		});
		Object.defineProperty(this, "activeControllers", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Set()
		});
		Object.defineProperty(this, "activePromises", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Set()
		});
		Object.defineProperty(this, "registrationCounter", {
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
	get isRunning() {
		return this.activePromises.size > 0;
	}
	registerParticipant(participant) {
		this.assertActive("register a participant");
		assertIdentifier$2(participant.id, "Participant id");
		if (!Number.isFinite(participant.order)) throw new GeometryRegistrationError(`Geometry participant "${participant.id}" must use a finite order.`, participant.id);
		if (this.participants.has(participant.id)) throw new GeometryRegistrationError(`Geometry participant "${participant.id}" is already registered.`, participant.id);
		const record = {
			participant: Object.freeze({ ...participant }),
			registrationOrder: this.registrationCounter++
		};
		this.participants.set(participant.id, record);
		return require_core_capabilities.createDisposable(() => {
			if (this.participants.get(participant.id) === record) this.participants.delete(participant.id);
		});
	}
	run(request) {
		this.assertActive("run a geometry mutation");
		let metadata;
		try {
			metadata = this.validateRequest(request);
		} catch (error) {
			return Promise.reject(error);
		}
		if (!this.usedMutationIds.start(request.id)) return Promise.reject(new GeometryMutationError(request.id, "mutation id has already been used."));
		const controller = new AbortController();
		this.activeControllers.add(controller);
		const operation = this.performRun(request, metadata, controller.signal);
		this.activePromises.add(operation);
		return operation.finally(() => {
			this.activePromises.delete(operation);
			this.activeControllers.delete(controller);
			this.usedMutationIds.complete(request.id);
		});
	}
	async dispose() {
		if (this.disposed) return;
		this.disposed = true;
		for (const controller of this.activeControllers) controller.abort(new DOMException("Geometry coordinator was disposed.", "AbortError"));
		await Promise.allSettled([...this.activePromises]);
		this.participants.clear();
		this.usedMutationIds.clear();
	}
	async abortActive(reason) {
		this.assertActive("abort geometry mutations");
		for (const controller of this.activeControllers) controller.abort(reason);
		await Promise.allSettled([...this.activePromises]);
	}
	reset() {
		this.assertActive("reset geometry mutations");
		if (this.activePromises.size > 0) throw new GeometryRegistrationError("Cannot reset while a geometry mutation is active.");
		this.participants.clear();
		this.usedMutationIds.clear();
		this.registrationCounter = 0;
	}
	disposeSync() {
		if (this.disposed) return;
		if (this.activePromises.size > 0) throw new GeometryRegistrationError("Cannot synchronously dispose an active geometry mutation.");
		this.disposed = true;
		this.participants.clear();
		this.usedMutationIds.clear();
	}
	async performRun(request, metadata, signal) {
		var _a, _b;
		let before = null;
		let provisional = null;
		const participantSnapshot = Object.freeze([...this.participants.values()].sort((left, right) => left.participant.order - right.participant.order || left.registrationOrder - right.registrationOrder));
		const geometryParticipant = Object.freeze({
			id: "core:geometry-participants",
			order: 0,
			prepare: async (context) => {
				const capturedBefore = freezeGeometry(this.options.state.captureGeometry());
				const provisionalDescriptor = createDescriptor(request, capturedBefore, capturedBefore, metadata, true);
				before = capturedBefore;
				provisional = provisionalDescriptor;
				const participantContext = this.createParticipantContext(request.id, context.signal);
				const entries = [];
				for (const record of participantSnapshot) {
					if (!record.participant.supports(provisionalDescriptor)) continue;
					const prepared = record.participant.prepare ? await record.participant.prepare(provisionalDescriptor, participantContext) : void 0;
					entries.push({
						record,
						prepared
					});
				}
				return Object.freeze({
					entries: Object.freeze(entries),
					context: participantContext
				});
			},
			apply: async (descriptor, prepared) => {
				for (const entry of prepared.entries) try {
					await entry.record.participant.apply(descriptor, entry.prepared, prepared.context);
				} catch (error) {
					if (error instanceof GeometryRecoverableObjectError) {
						this.warnRecoverable(request.id, entry.record.participant.id, error);
						continue;
					}
					throw error;
				}
			},
			synchronize: async (descriptor, prepared) => {
				var _a, _b;
				for (const entry of prepared.entries) try {
					await ((_b = (_a = entry.record.participant).synchronize) === null || _b === void 0 ? void 0 : _b.call(_a, descriptor, prepared.context));
				} catch (error) {
					if (error instanceof GeometryRecoverableObjectError) {
						this.warn({
							code: "GEOMETRY_SYNCHRONIZE_WARNING",
							message: error.message,
							mutationId: request.id,
							participantId: entry.record.participant.id,
							...error.objectIdentity === void 0 ? {} : { objectIdentity: error.objectIdentity },
							...error.objectKind === void 0 ? {} : { objectKind: error.objectKind },
							cause: error.cause
						});
						continue;
					}
					throw error;
				}
			},
			...participantSnapshot.some(({ participant }) => participant.rollback) ? { rollback: async (prepared, rollbackContext) => {
				var _a, _b, _c;
				const descriptor = (_a = rollbackContext.result) !== null && _a !== void 0 ? _a : provisional;
				if (!descriptor) return;
				for (let index = prepared.entries.length - 1; index >= 0; index -= 1) {
					const entry = prepared.entries[index];
					if (!entry) continue;
					await ((_c = (_b = entry.record.participant).rollback) === null || _c === void 0 ? void 0 : _c.call(_b, descriptor, entry.prepared, prepared.context));
				}
			} } : {}
		});
		try {
			return await this.options.mutations.run({
				id: request.id,
				kind: "geometry",
				operationId: request.operationId,
				conflictDomains: require_internal_operation_conflict_domains.GEOMETRY_MUTATION_CONFLICT_DOMAINS,
				signal,
				...request.parent ? { parent: request.parent } : {},
				metadata,
				participants: [geometryParticipant],
				mutate: async (context) => {
					const capturedBefore = before;
					if (!capturedBefore) throw new GeometryMutationError(request.id, "geometry preparation did not capture the before state.");
					await request.mutateBase(Object.freeze({
						signal: context.signal,
						transaction: context
					}));
					await this.options.state.finalizeGeometry();
					const after = freezeGeometry(this.options.state.captureGeometry());
					if (after.revision <= capturedBefore.revision) throw new GeometryMutationError(request.id, `geometry revision must increase (${capturedBefore.revision} -> ${after.revision}).`);
					return createDescriptor(request, capturedBefore, after, metadata, false);
				},
				...request.rollbackBase ? { rollback: async (context) => {
					var _a, _b, _c;
					await ((_a = request.rollbackBase) === null || _a === void 0 ? void 0 : _a.call(request, Object.freeze({
						signal: context.signal,
						cause: context.cause
					})));
					if (before) await ((_c = (_b = this.options.state).restoreGeometry) === null || _c === void 0 ? void 0 : _c.call(_b, before));
				} } : {}
			});
		} catch (error) {
			const failure = this.toGeometryFailure(request.id, error);
			(_b = (_a = this.options).errorSink) === null || _b === void 0 || _b.call(_a, failure);
			throw failure;
		}
	}
	createParticipantContext(mutationId, signal) {
		return Object.freeze({
			signal,
			warnRecoverable: (error, objectIdentity, objectKind) => {
				this.warn({
					code: "GEOMETRY_OBJECT_SKIPPED",
					message: "An overlay transform skipped a malformed or unsupported object.",
					mutationId,
					...objectIdentity === void 0 ? {} : { objectIdentity },
					...objectKind === void 0 ? {} : { objectKind },
					cause: error
				});
			}
		});
	}
	warnRecoverable(mutationId, participantId, error) {
		this.warn({
			code: "GEOMETRY_OBJECT_SKIPPED",
			message: error.message,
			mutationId,
			participantId,
			...error.objectIdentity === void 0 ? {} : { objectIdentity: error.objectIdentity },
			...error.objectKind === void 0 ? {} : { objectKind: error.objectKind },
			cause: error.cause
		});
	}
	toGeometryFailure(mutationId, error) {
		if (error instanceof DocumentMutationUnrecoverableError) return new GeometryUnrecoverableError(mutationId, error.cause, error.rollbackErrors);
		if (error instanceof DocumentMutationError) return new GeometryMutationError(mutationId, error.cause instanceof Error ? error.cause.message : error.message, error.cause, error.rollbackErrors);
		if (error instanceof GeometryMutationError) return error;
		return new GeometryMutationError(mutationId, error instanceof Error ? error.message : "unknown failure.", error);
	}
	validateRequest(request) {
		var _a, _b;
		assertIdentifier$2(request.id, "Mutation id");
		assertIdentifier$2(request.kind, "Mutation kind");
		assertIdentifier$2(request.operationId, "Operation id");
		if (this.usedMutationIds.has(request.id)) throw new GeometryMutationError(request.id, "mutation id has already been used.");
		if (typeof request.mutateBase !== "function") throw new GeometryMutationError(request.id, "mutateBase must be a function.");
		let clonedMetadata;
		let serializedMetadata;
		try {
			clonedMetadata = cloneStateValue((_a = request.metadata) !== null && _a !== void 0 ? _a : {});
			serializedMetadata = JSON.stringify(clonedMetadata);
		} catch (error) {
			throw new GeometryMutationError(request.id, "metadata must be safely JSON-serializable.", error);
		}
		const maxMetadataBytes = (_b = this.options.maxMetadataBytes) !== null && _b !== void 0 ? _b : 64 * 1024;
		if (new TextEncoder().encode(serializedMetadata).byteLength > maxMetadataBytes) throw new GeometryMutationError(request.id, `metadata exceeds ${maxMetadataBytes} bytes.`);
		return clonedMetadata;
	}
	warn(warning) {
		var _a, _b, _c, _d;
		try {
			(_b = (_a = this.options).warningSink) === null || _b === void 0 || _b.call(_a, Object.freeze(warning));
		} catch (error) {
			(_d = (_c = this.options).errorSink) === null || _d === void 0 || _d.call(_c, error);
		}
	}
	assertActive(operation) {
		if (this.disposed) throw new GeometryRegistrationError(`Cannot ${operation} after coordinator disposal.`);
	}
};

//#endregion
//#region dist/esm/core-runtime/history-commit-router.js
const unavailableHistory = Object.freeze({
	isAvailable: () => false,
	commit: () => void 0
});
var HistoryCommitRouter = class {
	constructor() {
		Object.defineProperty(this, "provider", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: unavailableHistory
		});
		Object.defineProperty(this, "owner", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: null
		});
	}
	register(owner, provider) {
		if (!require_plugin_identifier.isRuntimeIdentifier(owner)) throw new CoreRuntimeError("[ImageEditor] Invalid History provider owner Runtime ID.");
		if (this.owner) throw new CoreRuntimeError(`[ImageEditor] History commit provider is already registered by "${this.owner}".`);
		this.owner = owner;
		this.provider = provider;
		return require_core_capabilities.createDisposable(() => {
			if (this.owner !== owner || this.provider !== provider) return;
			this.owner = null;
			this.provider = unavailableHistory;
		});
	}
	isAvailable() {
		return this.provider.isAvailable();
	}
	commit(record) {
		const coreRecord = Object.freeze({
			operationId: record.operationId,
			before: record.before,
			after: record.after,
			timestamp: record.timestamp,
			detail: record.detail
		});
		return this.provider.commit(coreRecord);
	}
};

//#endregion
//#region dist/esm/core-runtime/internal-capabilities.js
const CORE_ENVIRONMENT_CAPABILITY = require_core_capabilities.createCapabilityToken("core:environment", "1.0.0");

//#endregion
//#region dist/esm/core-runtime/lifecycle.js
const ALLOWED_TRANSITIONS = {
	configured: ["initializing", "disposing"],
	initializing: [
		"configured",
		"initialized",
		"faulted"
	],
	initialized: ["disposing", "faulted"],
	disposing: ["disposed"],
	disposed: [],
	faulted: ["configured", "disposing"]
};
var EditorLifecycleController = class {
	constructor() {
		Object.defineProperty(this, "state", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: "configured"
		});
	}
	get current() {
		return this.state;
	}
	beginInitialization() {
		switch (this.state) {
			case "configured":
				this.transition("initializing");
				return;
			case "initializing": throw new EditorInitializationInProgressError();
			case "initialized": throw new EditorAlreadyInitializedError();
			case "disposing": throw new EditorDisposingError("initialize");
			case "disposed": throw new EditorDisposedError("initialize");
			case "faulted": throw new EditorFaultedError("initialize");
		}
	}
	completeInitialization() {
		this.transition("initialized");
	}
	recoverInitialization() {
		this.transition("configured");
	}
	failInitialization() {
		this.transition("faulted");
	}
	failRuntime() {
		if (this.state === "faulted") return;
		if (this.state !== "initialized") throw new CoreRuntimeError(`[ImageEditor] Cannot enter faulted from "${this.state}" during runtime.`, {
			code: "INVALID_LIFECYCLE_TRANSITION",
			behavior: "lifecycle"
		});
		this.transition("faulted");
	}
	recoverFault() {
		if (this.state !== "faulted") throw new CoreRuntimeError(`[ImageEditor] Cannot complete emergency reset from "${this.state}".`, {
			code: "INVALID_LIFECYCLE_TRANSITION",
			behavior: "lifecycle"
		});
		this.transition("configured");
	}
	beginDisposal() {
		if (this.state === "disposing" || this.state === "disposed") return false;
		if (this.state === "initializing") throw new EditorInitializationInProgressError("dispose");
		this.transition("disposing");
		return true;
	}
	completeDisposal() {
		this.transition("disposed");
	}
	assertOperational(operation) {
		switch (this.state) {
			case "initialized": return;
			case "configured": throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} before initialization.`, { code: "EDITOR_NOT_INITIALIZED" });
			case "initializing": throw new EditorInitializationInProgressError(operation);
			case "disposing": throw new EditorDisposingError(operation);
			case "disposed": throw new EditorDisposedError(operation);
			case "faulted": throw new EditorFaultedError(operation);
		}
	}
	assertAvailable(operation) {
		switch (this.state) {
			case "disposing": throw new EditorDisposingError(operation);
			case "disposed": throw new EditorDisposedError(operation);
			case "faulted": throw new EditorFaultedError(operation);
			default: return;
		}
	}
	transition(next) {
		if (!ALLOWED_TRANSITIONS[this.state].includes(next)) throw new CoreRuntimeError(`[ImageEditor] Invalid lifecycle transition from "${this.state}" to "${next}".`, { code: "INVALID_LIFECYCLE_TRANSITION" });
		this.state = next;
	}
};

//#endregion
//#region dist/esm/core-runtime/plugin-api-handle.js
function isProxyablePluginApi(value) {
	return typeof value === "object" && value !== null || typeof value === "function";
}
var StablePluginApiHandle = class {
	constructor(pluginId, initialTarget, assertAvailable) {
		Object.defineProperty(this, "pluginId", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: pluginId
		});
		Object.defineProperty(this, "assertAvailable", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: assertAvailable
		});
		Object.defineProperty(this, "target", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "methodWrappers", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Map()
		});
		Object.defineProperty(this, "api", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		this.target = initialTarget;
		const shadowTarget = typeof initialTarget === "function" ? function stablePluginApi() {} : Object.create(null);
		this.api = new Proxy(shadowTarget, {
			apply: (shadow, thisArgument, argumentsList) => {
				const target = this.requireTarget();
				if (typeof target !== "function") throw this.incompatibleReplayError("is no longer callable");
				return Reflect.apply(target, thisArgument, argumentsList);
			},
			construct: (shadow, argumentsList, newTarget) => {
				const target = this.requireTarget();
				if (typeof target !== "function") throw this.incompatibleReplayError("is no longer constructable");
				const instance = Reflect.construct(target, argumentsList, newTarget);
				if (!isProxyablePluginApi(instance)) throw this.incompatibleReplayError("returned a non-object from its constructor");
				return instance;
			},
			deleteProperty: (shadow, property) => {
				return Reflect.deleteProperty(this.requireTarget(), property);
			},
			get: (shadow, property) => {
				if (property === "then" && (!this.target || !Reflect.has(this.target, property))) return;
				const target = this.requireTarget();
				const value = Reflect.get(target, property, target);
				if (typeof value !== "function") return value;
				return this.getMethodWrapper(property);
			},
			has: (shadow, property) => {
				return Reflect.has(this.requireTarget(), property);
			},
			set: (shadow, property, value) => {
				const target = this.requireTarget();
				return Reflect.set(target, property, value, target);
			}
		});
	}
	assertCompatible(nextTarget) {
		if (typeof nextTarget !== typeof this.api) throw this.incompatibleReplayError("changed between callable and object forms");
	}
	update(nextTarget) {
		this.assertCompatible(nextTarget);
		this.target = nextTarget;
	}
	clear() {
		this.target = null;
	}
	getMethodWrapper(property) {
		const existing = this.methodWrappers.get(property);
		if (existing) return existing;
		const wrapper = (...args) => {
			const target = this.requireTarget();
			const method = Reflect.get(target, property, target);
			if (typeof method !== "function") throw this.incompatibleReplayError(`no longer exposes method "${String(property)}"`);
			return Reflect.apply(method, target, args);
		};
		this.methodWrappers.set(property, wrapper);
		return wrapper;
	}
	requireTarget() {
		this.assertAvailable(`use Plugin API "${this.pluginId}"`);
		if (!this.target) throw new CoreRuntimeError(`[ImageEditor] Plugin API "${this.pluginId}" is no longer available.`, {
			code: "PLUGIN_API_UNAVAILABLE",
			behavior: "lifecycle"
		});
		return this.target;
	}
	incompatibleReplayError(reason) {
		return new CoreRuntimeError(`[ImageEditor] Plugin API "${this.pluginId}" ${reason} during runtime replay.`, {
			code: "PLUGIN_API_REPLAY_INCOMPATIBLE",
			behavior: "lifecycle"
		});
	}
};

//#endregion
//#region dist/esm/core-runtime/mutation/document-mutation-coordinator.js
const DEFAULT_ROLLBACK_TIMEOUT_MS$1 = 3e4;
function isCancellation(error) {
	return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}
function assertIdentifier$1(value, label) {
	if (value.trim().length === 0 || value.trim() !== value) throw new DocumentMutationRegistrationError(`${label} must be non-empty and trimmed.`);
}
function immutableMetadata(value) {
	const cloned = cloneStateValue(value !== null && value !== void 0 ? value : {});
	if (typeof cloned !== "object" || cloned === null || Array.isArray(cloned)) throw new DocumentMutationRegistrationError("Mutation metadata must be an object.");
	return Object.freeze(cloned);
}
var DocumentMutationCoordinator = class {
	constructor(options) {
		var _a;
		Object.defineProperty(this, "options", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: options
		});
		Object.defineProperty(this, "usedTransactionIds", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: new BoundedReplayIdTracker()
		});
		Object.defineProperty(this, "contextRecords", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new WeakMap()
		});
		Object.defineProperty(this, "activeControllers", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Set()
		});
		Object.defineProperty(this, "activePromises", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Set()
		});
		Object.defineProperty(this, "disposed", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: false
		});
		const rollbackTimeoutMs = (_a = options.rollbackTimeoutMs) !== null && _a !== void 0 ? _a : DEFAULT_ROLLBACK_TIMEOUT_MS$1;
		if (!Number.isSafeInteger(rollbackTimeoutMs) || rollbackTimeoutMs <= 0) throw new DocumentMutationRegistrationError("rollbackTimeoutMs must be a positive safe integer.");
	}
	get isRunning() {
		return this.activePromises.size > 0;
	}
	assertContextActive(context) {
		const record = this.contextRecords.get(context);
		if (!record || record.session.closed || context.signal.aborted) throw new DocumentMutationInvariantError(context.transactionId, /* @__PURE__ */ new Error("The document mutation context is not active."));
	}
	run(request) {
		var _a, _b, _c, _d, _e;
		let normalized;
		let parentRecord;
		try {
			this.assertActive("run a document mutation");
			(_b = (_a = this.options.state).assertOperational) === null || _b === void 0 || _b.call(_a, "run a document mutation");
			normalized = this.normalizeRequest(request);
			parentRecord = normalized.parent ? this.requireParent(normalized.parent) : null;
		} catch (error) {
			return Promise.reject(error);
		}
		if (!this.usedTransactionIds.start(normalized.id)) return Promise.reject(new DocumentMutationRegistrationError(`Transaction id "${normalized.id}" has already been used.`, normalized.id));
		const controller = new AbortController();
		const abort = () => {
			var _a;
			return controller.abort((_a = normalized.signal) === null || _a === void 0 ? void 0 : _a.reason);
		};
		let operation;
		try {
			if ((_c = normalized.signal) === null || _c === void 0 ? void 0 : _c.aborted) abort();
			else (_d = normalized.signal) === null || _d === void 0 || _d.addEventListener("abort", abort, { once: true });
			this.activeControllers.add(controller);
			operation = this.options.operations.run(normalized.operationId, (operationContext) => parentRecord ? this.performNested(normalized, operationContext.token, parentRecord) : this.performTopLevel(normalized, operationContext.token), {
				signal: controller.signal,
				...parentRecord ? { parent: parentRecord.operationToken } : {}
			});
		} catch (error) {
			(_e = normalized.signal) === null || _e === void 0 || _e.removeEventListener("abort", abort);
			this.activeControllers.delete(controller);
			this.usedTransactionIds.complete(normalized.id);
			return Promise.reject(error);
		}
		this.activePromises.add(operation);
		return operation.finally(() => {
			var _a;
			(_a = normalized.signal) === null || _a === void 0 || _a.removeEventListener("abort", abort);
			this.activeControllers.delete(controller);
			this.activePromises.delete(operation);
			this.usedTransactionIds.complete(normalized.id);
		});
	}
	async dispose() {
		if (this.disposed) return;
		this.disposed = true;
		const reason = new DOMException("Document Mutation Coordinator was disposed.", "AbortError");
		for (const controller of this.activeControllers) controller.abort(reason);
		await Promise.allSettled([...this.activePromises]);
		this.activeControllers.clear();
		this.usedTransactionIds.clear();
	}
	async abortActive(reason) {
		this.assertActive("abort document mutations");
		for (const controller of this.activeControllers) controller.abort(reason);
		await Promise.allSettled([...this.activePromises]);
	}
	reset() {
		this.assertActive("reset document mutations");
		if (this.activePromises.size > 0) throw new DocumentMutationRegistrationError("Cannot reset while a document mutation is active.");
		this.usedTransactionIds.clear();
	}
	disposeSync() {
		if (this.disposed) return;
		if (this.activePromises.size > 0) throw new DocumentMutationRegistrationError("Cannot synchronously dispose an active document mutation.");
		this.disposed = true;
		this.usedTransactionIds.clear();
	}
	async performTopLevel(request, operationToken) {
		const before = this.options.mementos.capture();
		const session = {
			before,
			rollbackEntries: [],
			validators: [],
			diagnostics: [],
			failure: null,
			closed: false
		};
		const context = this.createContext(request, operationToken, session, null);
		let result;
		let committedResult;
		try {
			result = await this.executeRequest(request, context, session);
			if (session.failure) throw session.failure;
			this.throwIfUnavailable(context.signal, request.id);
			this.options.state.requestRender();
			for (const validate of session.validators) {
				this.throwIfUnavailable(context.signal, request.id);
				try {
					await validate();
				} catch (error) {
					throw new DocumentMutationInvariantError(request.id, error);
				}
			}
			this.throwIfUnavailable(context.signal, request.id);
			committedResult = request.describeCommit ? await request.describeCommit(result, context) : result;
			this.throwIfUnavailable(context.signal, request.id);
		} catch (error) {
			session.closed = true;
			throw await this.restoreAfterFailure(request.id, session, error);
		}
		let descriptor;
		try {
			const after = this.options.mementos.capture();
			descriptor = Object.freeze({
				transactionId: request.id,
				parentTransactionId: null,
				kind: request.kind,
				operationId: request.operationId,
				conflictDomains: request.conflictDomains,
				metadata: request.metadata,
				diagnostics: Object.freeze([...session.diagnostics]),
				result: committedResult,
				committedAt: Date.now()
			});
			if (this.options.history.isAvailable()) await this.options.history.commit(Object.freeze({
				operationId: request.operationId,
				before,
				after,
				timestamp: descriptor.committedAt,
				detail: descriptor
			}));
		} catch (error) {
			session.closed = true;
			throw await this.restoreAfterFailure(request.id, session, error);
		}
		session.closed = true;
		try {
			await this.options.events.emitCommitted(descriptor);
		} catch (error) {
			this.warn({
				code: "DOCUMENT_COMMITTED_OBSERVER_FAILED",
				message: "A committed document observer failed after the transaction committed.",
				transactionId: request.id,
				cause: error
			});
		}
		return result;
	}
	async performNested(request, operationToken, parentRecord) {
		var _a;
		var _b;
		const parent = request.parent;
		if (!parent) throw new DocumentMutationRegistrationError("Nested mutation requires a parent.");
		const context = this.createContext(request, operationToken, parentRecord.session, parent);
		try {
			return await this.executeRequest(request, context, parentRecord.session);
		} catch (error) {
			(_a = (_b = parentRecord.session).failure) !== null && _a !== void 0 || (_b.failure = require_plugin_manager.normalizeThrownError(error, `[ImageEditor] Nested document mutation "${request.id}" failed with a non-Error value.`));
			throw error;
		}
	}
	async executeRequest(request, context, session) {
		var _a, _b, _c, _d, _e;
		const outcome = { result: void 0 };
		const requestRollback = request.rollback ? {
			enabled: false,
			run: async (cause, signal) => {
				var _a;
				const rollbackContext = this.createRollbackContext(context, cause, outcome.result, signal);
				await ((_a = request.rollback) === null || _a === void 0 ? void 0 : _a.call(request, rollbackContext));
			}
		} : null;
		if (requestRollback) session.rollbackEntries.push(requestRollback);
		const prepared = [];
		for (const participant of request.participants) {
			this.throwIfUnavailable(context.signal, request.id);
			const preparedValue = participant.prepare ? await participant.prepare(context) : void 0;
			prepared.push({
				participant,
				value: preparedValue
			});
			if (participant.rollback) session.rollbackEntries.push({
				enabled: true,
				run: async (cause, signal) => {
					var _a;
					const rollbackContext = this.createRollbackContext(context, cause, outcome.result, signal);
					await ((_a = participant.rollback) === null || _a === void 0 ? void 0 : _a.call(participant, preparedValue, rollbackContext));
				}
			});
		}
		this.throwIfUnavailable(context.signal, request.id);
		if (requestRollback) requestRollback.enabled = true;
		const result = await request.mutate(context);
		outcome.result = result;
		this.throwIfUnavailable(context.signal, request.id);
		for (const entry of prepared) {
			await ((_b = (_a = entry.participant).apply) === null || _b === void 0 ? void 0 : _b.call(_a, result, entry.value, context));
			this.throwIfUnavailable(context.signal, request.id);
		}
		for (const entry of prepared) {
			await ((_d = (_c = entry.participant).synchronize) === null || _d === void 0 ? void 0 : _d.call(_c, result, entry.value, context));
			this.throwIfUnavailable(context.signal, request.id);
		}
		await ((_e = request.synchronize) === null || _e === void 0 ? void 0 : _e.call(request, result, context));
		this.throwIfUnavailable(context.signal, request.id);
		if (request.validate) session.validators.push(async () => {
			var _a;
			return (_a = request.validate) === null || _a === void 0 ? void 0 : _a.call(request, result, context);
		});
		return result;
	}
	createContext(request, operationToken, session, parent) {
		var _a, _b;
		const participantIds = Object.freeze(request.participants.map(({ id }) => id));
		const context = Object.freeze({
			transactionId: request.id,
			parentTransactionId: (_a = parent === null || parent === void 0 ? void 0 : parent.transactionId) !== null && _a !== void 0 ? _a : null,
			operationId: request.operationId,
			conflictDomains: request.conflictDomains,
			historyOwner: parent ? "parent" : "self",
			eventOwner: parent ? "parent" : "self",
			signal: operationToken.signal,
			participantIds,
			metadata: request.metadata
		});
		this.contextRecords.set(context, {
			session,
			operationToken
		});
		session.diagnostics.push(Object.freeze({
			transactionId: request.id,
			parentTransactionId: (_b = parent === null || parent === void 0 ? void 0 : parent.transactionId) !== null && _b !== void 0 ? _b : null,
			participantIds,
			metadata: request.metadata
		}));
		return context;
	}
	createRollbackContext(context, cause, result, signal) {
		return Object.freeze({
			...context,
			signal,
			cause,
			result
		});
	}
	async restoreAfterFailure(transactionId, session, cause) {
		var _a, _b, _c, _d, _e, _f, _g;
		const rollbackErrors = [];
		const rollbackTimeoutMs = (_a = this.options.rollbackTimeoutMs) !== null && _a !== void 0 ? _a : DEFAULT_ROLLBACK_TIMEOUT_MS$1;
		const rollbackController = new AbortController();
		const timeoutError = /* @__PURE__ */ new Error(`Document mutation rollback timed out after ${rollbackTimeoutMs}ms.`);
		timeoutError.name = "TimeoutError";
		const timeout = setTimeout(() => rollbackController.abort(timeoutError), rollbackTimeoutMs);
		const runRollbackTask = async (task) => {
			var _a;
			if (rollbackController.signal.aborted) throw (_a = rollbackController.signal.reason) !== null && _a !== void 0 ? _a : timeoutError;
			let removeAbortListener = () => void 0;
			const aborted = new Promise((resolve, reject) => {
				const abort = () => {
					var _a;
					return reject((_a = rollbackController.signal.reason) !== null && _a !== void 0 ? _a : timeoutError);
				};
				removeAbortListener = () => rollbackController.signal.removeEventListener("abort", abort);
				rollbackController.signal.addEventListener("abort", abort, { once: true });
			});
			try {
				await Promise.race([task(), aborted]);
			} finally {
				removeAbortListener();
			}
		};
		try {
			for (let index = session.rollbackEntries.length - 1; index >= 0; index -= 1) {
				const entry = session.rollbackEntries[index];
				if (!(entry === null || entry === void 0 ? void 0 : entry.enabled)) continue;
				try {
					await runRollbackTask(() => entry.run(cause, rollbackController.signal));
				} catch (error) {
					rollbackErrors.push(error);
				}
			}
			let targetedStateMatches = false;
			if (session.rollbackEntries.some((entry) => entry.enabled) && rollbackErrors.length === 0 && this.options.mementos.matches) try {
				targetedStateMatches = await this.options.mementos.matches(session.before);
			} catch (error) {
				rollbackErrors.push(error);
			}
			if (!targetedStateMatches) try {
				await runRollbackTask(() => this.options.mementos.restore(session.before, {
					rollbackOnFailure: false,
					signal: rollbackController.signal
				}));
			} catch (restoreError) {
				rollbackErrors.push(restoreError);
				const failure = new DocumentMutationUnrecoverableError(transactionId, cause, Object.freeze(rollbackErrors));
				(_c = (_b = this.options).faultSink) === null || _c === void 0 || _c.call(_b, failure);
				(_e = (_d = this.options).errorSink) === null || _e === void 0 || _e.call(_d, failure);
				return failure;
			}
			if (!this.options.state.isDisposed()) try {
				this.options.state.requestRender();
			} catch (error) {
				rollbackErrors.push(error);
			}
		} finally {
			clearTimeout(timeout);
		}
		if (isCancellation(cause)) return cause;
		const failure = cause instanceof DocumentMutationError ? cause : new DocumentMutationError(transactionId, cause instanceof Error ? cause.message : "unknown failure.", cause, Object.freeze(rollbackErrors));
		(_g = (_f = this.options).errorSink) === null || _g === void 0 || _g.call(_f, failure);
		return failure;
	}
	normalizeRequest(request) {
		var _a, _b;
		assertIdentifier$1(request.id, "Transaction id");
		assertIdentifier$1(request.kind, "Mutation kind");
		assertIdentifier$1(request.operationId, "Operation id");
		if (this.usedTransactionIds.has(request.id)) throw new DocumentMutationRegistrationError(`Transaction id "${request.id}" has already been used.`, request.id);
		if (!this.options.operations.has(request.operationId)) throw new DocumentMutationRegistrationError(`Operation "${request.operationId}" is not registered.`, request.id);
		const operation = this.options.operations.get(request.operationId);
		if (!operation) throw new DocumentMutationRegistrationError(`Operation "${request.operationId}" is unavailable.`, request.id);
		if (!Array.isArray(request.conflictDomains) || request.conflictDomains.length === 0 || request.conflictDomains.some((domain) => !operation.conflictDomains.includes(domain))) throw new DocumentMutationRegistrationError("Mutation conflict domains must be covered by its registered operation.", request.id);
		if (typeof request.mutate !== "function") throw new DocumentMutationRegistrationError("Mutation request must define mutate().", request.id);
		const participants = [...(_a = request.participants) !== null && _a !== void 0 ? _a : []];
		const participantIds = /* @__PURE__ */ new Set();
		for (const participant of participants) {
			assertIdentifier$1(participant.id, "Participant id");
			if (!Number.isFinite(participant.order)) throw new DocumentMutationRegistrationError(`Participant "${participant.id}" must use a finite order.`, request.id);
			if (participantIds.has(participant.id)) throw new DocumentMutationRegistrationError(`Participant "${participant.id}" is duplicated.`, request.id);
			participantIds.add(participant.id);
		}
		participants.sort((left, right) => left.order - right.order);
		let metadata;
		let serializedMetadata;
		try {
			metadata = immutableMetadata(request.metadata);
			serializedMetadata = JSON.stringify(metadata);
		} catch (error) {
			if (error instanceof DocumentMutationRegistrationError) throw error;
			throw new DocumentMutationRegistrationError("Mutation metadata must be safely JSON-serializable.", request.id);
		}
		const maxMetadataBytes = (_b = this.options.maxMetadataBytes) !== null && _b !== void 0 ? _b : 64 * 1024;
		if (new TextEncoder().encode(serializedMetadata).byteLength > maxMetadataBytes) throw new DocumentMutationRegistrationError(`Mutation metadata exceeds ${maxMetadataBytes} bytes.`, request.id);
		return Object.freeze({
			...request,
			conflictDomains: Object.freeze([...request.conflictDomains]),
			participants: Object.freeze(participants),
			metadata
		});
	}
	requireParent(parent) {
		const record = this.contextRecords.get(parent);
		if (!record || record.session.closed || parent.signal.aborted) throw new DocumentMutationRegistrationError(`Parent transaction "${parent.transactionId}" is not active.`, parent.transactionId);
		return record;
	}
	throwIfUnavailable(signal, transactionId) {
		var _a;
		if (signal.aborted) throw (_a = signal.reason) !== null && _a !== void 0 ? _a : new DOMException("Document mutation was aborted.", "AbortError");
		if (this.options.state.isDisposed()) throw new DocumentMutationError(transactionId, "Core state is disposed.");
	}
	warn(warning) {
		var _a, _b, _c, _d;
		try {
			(_b = (_a = this.options).warningSink) === null || _b === void 0 || _b.call(_a, Object.freeze(warning));
		} catch (error) {
			(_d = (_c = this.options).errorSink) === null || _d === void 0 || _d.call(_c, error);
		}
	}
	assertActive(operation) {
		if (this.disposed) throw new DocumentMutationRegistrationError(`Cannot ${operation} after coordinator disposal.`);
	}
};

//#endregion
//#region dist/esm/core-runtime/state/memento-service.js
const DEFAULT_ROLLBACK_TIMEOUT_MS = 3e4;
function createAbortError(message) {
	if (typeof DOMException === "function") return new DOMException(message, "AbortError");
	const error = new Error(message);
	error.name = "AbortError";
	return error;
}
function throwIfAborted(signal) {
	var _a;
	if (signal.aborted) throw (_a = signal.reason) !== null && _a !== void 0 ? _a : createAbortError("State restoration was aborted.");
}
async function runBoundedRollback(task, timeoutMs) {
	const controller = new AbortController();
	const timeoutError = /* @__PURE__ */ new Error(`Memento rollback timed out after ${timeoutMs}ms.`);
	timeoutError.name = "TimeoutError";
	const timeout = setTimeout(() => controller.abort(timeoutError), timeoutMs);
	let removeAbortListener = () => void 0;
	const aborted = new Promise((resolve, reject) => {
		const abort = () => {
			var _a;
			return reject((_a = controller.signal.reason) !== null && _a !== void 0 ? _a : timeoutError);
		};
		removeAbortListener = () => controller.signal.removeEventListener("abort", abort);
		controller.signal.addEventListener("abort", abort, { once: true });
	});
	try {
		await Promise.race([task(controller.signal), aborted]);
	} finally {
		clearTimeout(timeout);
		removeAbortListener();
	}
}
function stateValuesMatch(left, right) {
	if (Object.is(left, right)) return true;
	if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) return false;
	if (Array.isArray(left) !== Array.isArray(right)) return false;
	const leftRecord = left;
	const rightRecord = right;
	const leftKeys = Object.keys(leftRecord);
	const rightKeys = Object.keys(rightRecord);
	if (leftKeys.length !== rightKeys.length) return false;
	return leftKeys.every((key) => Object.prototype.hasOwnProperty.call(rightRecord, key) && stateValuesMatch(leftRecord[key], rightRecord[key]));
}
var MementoService = class {
	constructor(coreAdapter, slices) {
		Object.defineProperty(this, "coreAdapter", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: coreAdapter
		});
		Object.defineProperty(this, "slices", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: slices
		});
		Object.defineProperty(this, "trustedMementos", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new WeakSet()
		});
		Object.defineProperty(this, "revision", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: 0
		});
		Object.defineProperty(this, "restoring", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: false
		});
		Object.defineProperty(this, "disposed", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: false
		});
	}
	capture() {
		this.assertActive("capture a memento");
		if (this.restoring) throw new StateRegistrationError("Cannot capture a new memento during restoration.");
		return this.captureInternal();
	}
	isTrusted(value) {
		return typeof value === "object" && value !== null && this.trustedMementos.has(value);
	}
	matches(memento) {
		this.assertActive("compare a memento");
		if (!this.isTrusted(memento)) return false;
		const current = this.captureInternal(false);
		return stateValuesMatch(current.core, memento.core) && stateValuesMatch(current.plugins, memento.plugins);
	}
	async restore(memento, options = {}) {
		var _a;
		this.assertActive("restore a memento");
		if (!this.isTrusted(memento)) throw new MementoRestoreError("core", "restore", /* @__PURE__ */ new Error("Untrusted memento."));
		if (this.restoring) throw new MementoRestoreError("core", "restore", /* @__PURE__ */ new Error("Reentrant memento restoration is not allowed."));
		const rollbackTimeoutMs = (_a = options.rollbackTimeoutMs) !== null && _a !== void 0 ? _a : DEFAULT_ROLLBACK_TIMEOUT_MS;
		if (!Number.isSafeInteger(rollbackTimeoutMs) || rollbackTimeoutMs <= 0) throw new MementoRestoreError("core", "restore", /* @__PURE__ */ new TypeError("rollbackTimeoutMs must be a positive safe integer."));
		const controller = new AbortController();
		const providedSignal = options.signal;
		const abort = () => controller.abort(providedSignal === null || providedSignal === void 0 ? void 0 : providedSignal.reason);
		providedSignal === null || providedSignal === void 0 || providedSignal.addEventListener("abort", abort, { once: true });
		if (providedSignal === null || providedSignal === void 0 ? void 0 : providedSignal.aborted) abort();
		this.restoring = true;
		let rollback = null;
		try {
			if (options.rollbackOnFailure !== false) rollback = this.captureInternal(false);
			await this.restoreInternal(memento, "trusted-memento", controller.signal);
		} catch (error) {
			if (!rollback) {
				if (error instanceof MementoRestoreError) throw error;
				throw new MementoRestoreError("core", "restore", error);
			}
			const rollbackMemento = rollback;
			const rollbackErrors = [];
			try {
				await runBoundedRollback((signal) => this.restoreInternal(rollbackMemento, "rollback", signal), rollbackTimeoutMs);
			} catch (rollbackError) {
				rollbackErrors.push(rollbackError);
			}
			if (error instanceof MementoRestoreError) throw new MementoRestoreError(error.sliceId, "restore", error.cause, rollbackErrors);
			throw new MementoRestoreError("core", "restore", error, rollbackErrors);
		} finally {
			providedSignal === null || providedSignal === void 0 || providedSignal.removeEventListener("abort", abort);
			this.restoring = false;
		}
	}
	dispose() {
		this.disposed = true;
	}
	reset() {
		this.assertActive("reset MementoService");
		if (this.restoring) throw new StateRegistrationError("Cannot reset MementoService during restoration.");
		this.trustedMementos = /* @__PURE__ */ new WeakSet();
		this.revision = 0;
	}
	captureInternal(validateReferenceIdentity = true) {
		var _a;
		const capturedAt = Date.now();
		const context = Object.freeze({
			mode: "memento",
			capturedAt
		});
		let core;
		try {
			core = cloneStateValue(this.coreAdapter.capture(context));
			assertSafeImmutableReference(core);
		} catch (error) {
			throw new MementoCaptureError("core", error);
		}
		const plugins = Object.create(null);
		for (const slice of this.slices.list()) try {
			const captured = slice.capture(context);
			let capturePolicy = (_a = slice.capturePolicy) !== null && _a !== void 0 ? _a : "always";
			let data;
			if (capturePolicy === "reference") if (validateReferenceIdentity) {
				const validation = slice.validate(captured, {
					sliceId: slice.id,
					version: slice.version
				});
				if (!validation.valid || validation.value !== captured) throw new Error(validation.valid ? "Reference validation must preserve the captured identity." : validation.message);
				assertSafeImmutableReference(captured);
				data = captured;
			} else {
				data = cloneStateValue(captured);
				capturePolicy = "always";
			}
			else data = cloneStateValue(captured);
			assertSafeImmutableReference(data);
			plugins[slice.id] = Object.freeze({
				version: slice.version,
				capturePolicy,
				data
			});
		} catch (error) {
			throw new MementoCaptureError(slice.id, error);
		}
		const memento = Object.freeze({
			revision: ++this.revision,
			capturedAt,
			core,
			plugins: Object.freeze(plugins)
		});
		this.trustedMementos.add(memento);
		return memento;
	}
	async restoreInternal(memento, mode, signal) {
		var _a;
		const context = Object.freeze({
			mode,
			signal
		});
		throwIfAborted(signal);
		try {
			await this.coreAdapter.restore(cloneStateValue(memento.core), context);
		} catch (error) {
			throw new MementoRestoreError("core", mode === "rollback" ? "rollback" : "restore", error);
		}
		for (const slice of this.slices.list()) {
			throwIfAborted(signal);
			const entry = memento.plugins[slice.id];
			try {
				if (!entry) {
					await ((_a = slice.clearState) === null || _a === void 0 ? void 0 : _a.call(slice, context));
					continue;
				}
				if (entry.version !== slice.version) throw new Error(`Captured version ${entry.version} does not match installed version ${slice.version}.`);
				await slice.restore(entry.capturePolicy === "reference" ? entry.data : cloneStateValue(entry.data), context);
			} catch (error) {
				throw new MementoRestoreError(slice.id, mode === "rollback" ? "rollback" : "restore", error);
			}
		}
	}
	assertActive(operation) {
		if (this.disposed) throw new StateRegistrationError(`Cannot ${operation} after MementoService disposal.`);
	}
};

//#endregion
//#region dist/esm/core-runtime/state/object-property-registry.js
function assertIdentifier(value, label) {
	if (value.trim().length === 0 || value.trim() !== value) throw new StateRegistrationError(`${label} must be a non-empty trimmed string.`);
}
var ObjectPropertyRegistry = class {
	constructor() {
		Object.defineProperty(this, "properties", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: {
				records: /* @__PURE__ */ new Map(),
				snapshot: Object.freeze([])
			}
		});
		Object.defineProperty(this, "disposed", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: false
		});
	}
	register(registration) {
		this.assertActive();
		if (!require_plugin_identifier.isRuntimeIdentifier(registration.owner)) throw new StateRegistrationError("Invalid object property owner Runtime ID.", registration.owner);
		if (registration.keys.length === 0) throw new StateRegistrationError(`Object property registration for "${registration.owner}" must include a key.`);
		const keys = [...new Set(registration.keys)];
		for (const key of keys) {
			assertIdentifier(key, "Object property key");
			if (require_plugin_identifier.isDangerousStateKey(key)) throw new StateRegistrationError(`Object property key "${key}" is forbidden.`);
			const existing = this.properties.records.get(key);
			if (existing && existing.owner !== registration.owner) throw new StateRegistrationError(`Object property "${key}" is already owned by "${existing.owner}".`);
		}
		let keySetChanged = false;
		for (const key of keys) {
			const existing = this.properties.records.get(key);
			if (existing) existing.references += 1;
			else {
				this.properties.records.set(key, {
					owner: registration.owner,
					references: 1
				});
				keySetChanged = true;
			}
		}
		if (keySetChanged) this.properties.snapshot = Object.freeze([...this.properties.records.keys()]);
		return require_core_capabilities.createDisposable(() => {
			let registeredKeyRemoved = false;
			for (const key of keys) {
				const record = this.properties.records.get(key);
				if (!record || record.owner !== registration.owner) continue;
				record.references -= 1;
				if (record.references === 0) {
					this.properties.records.delete(key);
					registeredKeyRemoved = true;
				}
			}
			if (registeredKeyRemoved) this.properties.snapshot = Object.freeze([...this.properties.records.keys()]);
		});
	}
	listKeys() {
		this.assertActive();
		return this.properties.snapshot;
	}
	getOwner(key) {
		var _a, _b;
		this.assertActive();
		return (_b = (_a = this.properties.records.get(key)) === null || _a === void 0 ? void 0 : _a.owner) !== null && _b !== void 0 ? _b : null;
	}
	dispose() {
		if (this.disposed) return;
		this.properties.records.clear();
		this.properties.snapshot = Object.freeze([]);
		this.disposed = true;
	}
	assertActive() {
		if (this.disposed) throw new StateRegistrationError("Object property registry is disposed.");
	}
};

//#endregion
//#region dist/esm/core-runtime/state/image-data-url.js
const PNG_SIGNATURE = [
	137,
	80,
	78,
	71,
	13,
	10,
	26,
	10
];
const HEADER_PROBE_BASE64_CHARACTERS = Math.ceil(256 * 1024 / 3) * 4;
const MAX_DATA_URL_HEADER_LENGTH = 64;
const ASCII_CHUNK_SIZE = 8 * 1024;
function matchesAscii(bytes, offset, value) {
	if (offset < 0 || offset + value.length > bytes.length) return false;
	for (let index = 0; index < value.length; index += 1) if (bytes[offset + index] !== value.charCodeAt(index)) return false;
	return true;
}
function uint16BE(bytes, offset) {
	if (offset < 0 || offset + 2 > bytes.length) return null;
	return bytes[offset] << 8 | bytes[offset + 1];
}
function uint16LE(bytes, offset) {
	if (offset < 0 || offset + 2 > bytes.length) return null;
	return bytes[offset] | bytes[offset + 1] << 8;
}
function uint24LE(bytes, offset) {
	if (offset < 0 || offset + 3 > bytes.length) return null;
	return bytes[offset] | bytes[offset + 1] << 8 | bytes[offset + 2] << 16;
}
function uint32BE(bytes, offset) {
	if (offset < 0 || offset + 4 > bytes.length) return null;
	return bytes[offset] * 16777216 + (bytes[offset + 1] << 16 | bytes[offset + 2] << 8 | bytes[offset + 3]);
}
function positiveDimensions(width, height) {
	return width !== null && height !== null && width > 0 && height > 0 ? Object.freeze({
		width,
		height
	}) : null;
}
function readPngDimensions(bytes) {
	if (bytes.length < 24 || !PNG_SIGNATURE.every((byte, index) => bytes[index] === byte) || !matchesAscii(bytes, 12, "IHDR")) return null;
	return positiveDimensions(uint32BE(bytes, 16), uint32BE(bytes, 20));
}
function isJpegStartOfFrame(marker) {
	return marker >= 192 && marker <= 195 || marker >= 197 && marker <= 199 || marker >= 201 && marker <= 203 || marker >= 205 && marker <= 207;
}
function readJpegDimensions(bytes) {
	if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216) return null;
	let offset = 2;
	while (offset + 1 < bytes.length) {
		while (offset < bytes.length && bytes[offset] === 255) offset += 1;
		if (offset >= bytes.length) return null;
		const marker = bytes[offset];
		offset += 1;
		if (marker === 218 || marker === 217) return null;
		if (marker === 1 || marker >= 208 && marker <= 215) continue;
		const length = uint16BE(bytes, offset);
		if (length === null || length < 2 || offset + length > bytes.length) return null;
		if (isJpegStartOfFrame(marker) && length >= 7) return positiveDimensions(uint16BE(bytes, offset + 5), uint16BE(bytes, offset + 3));
		offset += length;
	}
	return null;
}
function readWebpDimensions(bytes) {
	var _a, _b;
	if (bytes.length < 20 || !matchesAscii(bytes, 0, "RIFF") || !matchesAscii(bytes, 8, "WEBP")) return null;
	if (matchesAscii(bytes, 12, "VP8X") && bytes.length >= 30) {
		const width = uint24LE(bytes, 24);
		const height = uint24LE(bytes, 27);
		return width === null || height === null ? null : Object.freeze({
			width: width + 1,
			height: height + 1
		});
	}
	if (matchesAscii(bytes, 12, "VP8 ") && bytes.length >= 30) return positiveDimensions(((_a = uint16LE(bytes, 26)) !== null && _a !== void 0 ? _a : 0) & 16383, ((_b = uint16LE(bytes, 28)) !== null && _b !== void 0 ? _b : 0) & 16383);
	if (matchesAscii(bytes, 12, "VP8L") && bytes.length >= 25 && bytes[20] === 47) return Object.freeze({
		width: 1 + bytes[21] + ((bytes[22] & 63) << 8),
		height: 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 15) << 10)
	});
	return null;
}
function decodePrefix(encoded) {
	if (!encoded) return /* @__PURE__ */ new Uint8Array();
	const remainder = encoded.length % 4;
	if (remainder === 1) return null;
	const padded = remainder === 0 ? encoded : `${encoded}${"=".repeat(4 - remainder)}`;
	const buffer = globalThis.Buffer;
	if (buffer) return buffer.from(padded, "base64");
	if (typeof globalThis.atob !== "function") return null;
	try {
		const binary = globalThis.atob(padded);
		return Uint8Array.from(binary, (character) => character.charCodeAt(0));
	} catch {
		return null;
	}
}
function isBase64Character(code) {
	return code >= 65 && code <= 90 || code >= 97 && code <= 122 || code >= 48 && code <= 57 || code === 43 || code === 47;
}
function prefixToString(prefix, length) {
	let result = "";
	for (let offset = 0; offset < length; offset += ASCII_CHUNK_SIZE) result += String.fromCharCode(...prefix.subarray(offset, Math.min(length, offset + ASCII_CHUNK_SIZE)));
	return result;
}
function scanBase64Payload(value, payloadOffset) {
	const prefix = new Uint8Array(HEADER_PROBE_BASE64_CHARACTERS);
	let prefixLength = 0;
	let encodedLength = 0;
	let padding = 0;
	let sawPadding = false;
	for (let index = payloadOffset; index < value.length; index += 1) {
		const code = value.charCodeAt(index);
		if (isBase64Character(code)) {
			if (sawPadding) return null;
		} else if (code === 61) {
			sawPadding = true;
			padding += 1;
			if (padding > 2) return null;
		} else if (/\s/u.test(value[index])) continue;
		else return null;
		encodedLength += 1;
		if (prefixLength < prefix.length) {
			prefix[prefixLength] = code;
			prefixLength += 1;
		}
	}
	const remainder = encodedLength % 4;
	if (remainder === 1 || padding > 0 && remainder !== 0) return null;
	return Object.freeze({
		encodedBytes: Math.max(0, Math.floor(encodedLength * 3 / 4) - padding),
		prefix: prefixToString(prefix, prefixLength)
	});
}
function inspectEncodedImageDataUrl(value) {
	var _a, _b;
	const commaIndex = value.indexOf(",");
	if (commaIndex < 0 || commaIndex > MAX_DATA_URL_HEADER_LENGTH) return null;
	const header = value.slice(0, commaIndex).toLowerCase();
	let mimeType;
	if (header === "data:image/png;base64") mimeType = "image/png";
	else if (header === "data:image/jpeg;base64") mimeType = "image/jpeg";
	else if (header === "data:image/webp;base64") mimeType = "image/webp";
	else return null;
	const payload = scanBase64Payload(value, commaIndex + 1);
	if (!payload) return null;
	const decodedPrefix = decodePrefix(payload.prefix);
	const dimensions = decodedPrefix ? (_b = (_a = readPngDimensions(decodedPrefix)) !== null && _a !== void 0 ? _a : readJpegDimensions(decodedPrefix)) !== null && _b !== void 0 ? _b : readWebpDimensions(decodedPrefix) : null;
	return Object.freeze({
		mimeType,
		encodedBytes: payload.encodedBytes,
		dimensions
	});
}

//#endregion
//#region dist/esm/core-runtime/state/snapshot-service.js
const EXTERNAL_RESOURCE_KEYS = /* @__PURE__ */ new Set([
	"href",
	"source",
	"src",
	"url"
]);
function isExternalResourceKey(propertyName) {
	if (!propertyName) return false;
	const normalized = propertyName.toLowerCase();
	return EXTERNAL_RESOURCE_KEYS.has(normalized) || normalized.endsWith("url");
}
const DEFAULT_SNAPSHOT_LIMITS = Object.freeze({
	maxInputBytes: 16 * 1024 * 1024,
	maxDepth: 64,
	maxObjectCount: 1e5,
	maxPluginCount: 256,
	maxPluginPayloadBytes: 4 * 1024 * 1024,
	maxMetadataBytes: 256 * 1024,
	maxStringLength: 16 * 1024 * 1024,
	maxDataUrlBytes: 16 * 1024 * 1024,
	maxDecodedPixels: 5e7,
	maxImageDimension: 32768,
	externalUrlPolicy: "reject"
});
function byteLength(value) {
	return new TextEncoder().encode(value).byteLength;
}
function inspectTree(value, limits, path = "$", depth = 0, ancestors = /* @__PURE__ */ new WeakSet(), counter = { count: 0 }, propertyName) {
	if (depth > limits.maxDepth) throw new SnapshotValidationError(`nesting exceeds ${limits.maxDepth}.`, path);
	if (value === null || typeof value !== "object") {
		if (typeof value === "number" && !Number.isFinite(value)) throw new SnapshotValidationError("number must be finite.", path);
		if (typeof value === "string") {
			if (value.length > limits.maxStringLength) throw new SnapshotValidationError(`string length exceeds ${limits.maxStringLength}.`, path);
			if (value.startsWith("data:")) {
				const inspection = inspectEncodedImageDataUrl(value);
				if (!inspection) throw new SnapshotValidationError("Data URL must be a base64 PNG, JPEG, or WebP image.", path);
				if (inspection.encodedBytes > limits.maxDataUrlBytes) throw new SnapshotValidationError(`Data URL exceeds ${limits.maxDataUrlBytes} bytes.`, path);
				if (inspection.dimensions) {
					const { width, height } = inspection.dimensions;
					if (width * height > limits.maxDecodedPixels) throw new SnapshotValidationError(`decoded pixel count exceeds ${limits.maxDecodedPixels}.`, path);
					if (width > limits.maxImageDimension || height > limits.maxImageDimension) throw new SnapshotValidationError(`image dimensions exceed ${limits.maxImageDimension}.`, path);
				}
			} else if (limits.externalUrlPolicy === "reject" && isExternalResourceKey(propertyName) && /^(?:[a-z][a-z\d+.-]*:|\/\/)/iu.test(value)) throw new SnapshotValidationError("external URL references are forbidden.", path);
		}
		if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") throw new SnapshotValidationError(`unsupported ${typeof value} value.`, path);
		return;
	}
	counter.count += 1;
	if (counter.count > limits.maxObjectCount) throw new SnapshotValidationError(`object count exceeds ${limits.maxObjectCount}.`, path);
	if (ancestors.has(value)) throw new SnapshotValidationError("cyclic value.", path);
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null && !Array.isArray(value)) throw new SnapshotValidationError("only plain objects and arrays are accepted.", path);
	if (Object.prototype.hasOwnProperty.call(value, "toJSON") || Object.getOwnPropertySymbols(value).length > 0) throw new SnapshotValidationError("toJSON hooks and symbol properties are forbidden.", path);
	ancestors.add(value);
	for (const key of Object.keys(value)) {
		if (require_plugin_identifier.isDangerousStateKey(key)) throw new SnapshotValidationError(`dangerous key "${key}" is forbidden.`, `${path}.${key}`);
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (!descriptor || !("value" in descriptor)) throw new SnapshotValidationError("accessor properties are forbidden.", `${path}.${key}`);
		const nestedValue = descriptor.value;
		inspectTree(nestedValue, limits, `${path}.${key}`, depth + 1, ancestors, counter, key);
		if (key === "metadata" || key.endsWith("Metadata")) {
			if (byteLength(JSON.stringify(nestedValue)) > limits.maxMetadataBytes) throw new SnapshotValidationError(`metadata exceeds ${limits.maxMetadataBytes} bytes.`, `${path}.${key}`);
		}
	}
	ancestors.delete(value);
}
function stableJson(value, limits) {
	inspectTree(value, limits);
	const sortValue = (entry) => {
		if (Array.isArray(entry)) return entry.map(sortValue);
		if (entry && typeof entry === "object") {
			const result = {};
			for (const key of Object.keys(entry).sort()) result[key] = sortValue(entry[key]);
			return result;
		}
		return entry;
	};
	return JSON.stringify(sortValue(value));
}
function parseInput(input, limits) {
	if (typeof input !== "string") {
		inspectTree(input, limits);
		if (byteLength(JSON.stringify(input)) > limits.maxInputBytes) throw new SnapshotValidationError(`input exceeds ${limits.maxInputBytes} bytes.`);
		return input;
	}
	if (byteLength(input) > limits.maxInputBytes) throw new SnapshotValidationError(`input exceeds ${limits.maxInputBytes} bytes.`);
	try {
		const parsed = JSON.parse(input);
		inspectTree(parsed, limits);
		return parsed;
	} catch (error) {
		if (error instanceof SnapshotValidationError) throw error;
		throw new SnapshotValidationError("input is not valid JSON.", "$", error);
	}
}
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isUnsupportedCanvasEnvelope(value) {
	if ("schema" in value || !Array.isArray(value.objects) || !isRecord(value._editorState)) return false;
	const editorState = value._editorState;
	return [
		"currentScale",
		"currentRotation",
		"baseImageScale"
	].every((key) => typeof editorState[key] === "number");
}
var SnapshotService = class {
	constructor(coreAdapter, slices, mementos, warningSink, limits = DEFAULT_SNAPSHOT_LIMITS) {
		Object.defineProperty(this, "coreAdapter", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: coreAdapter
		});
		Object.defineProperty(this, "slices", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: slices
		});
		Object.defineProperty(this, "mementos", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: mementos
		});
		Object.defineProperty(this, "warningSink", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: warningSink
		});
		Object.defineProperty(this, "limits", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: limits
		});
		Object.defineProperty(this, "opaque", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Map()
		});
		Object.defineProperty(this, "prepared", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new WeakSet()
		});
		Object.defineProperty(this, "disposed", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: false
		});
	}
	capture() {
		this.assertActive("capture a public snapshot");
		const context = Object.freeze({
			mode: "snapshot",
			capturedAt: Date.now()
		});
		const plugins = Object.create(null);
		for (const [id, entry] of this.opaque) plugins[id] = cloneStateValue(entry);
		for (const slice of this.slices.list()) plugins[slice.id] = Object.freeze({
			version: slice.version,
			data: cloneStateValue(slice.capture(context))
		});
		return Object.freeze({
			schema: "image-editor.state",
			version: 3,
			core: cloneStateValue(this.coreAdapter.capture(context)),
			plugins: Object.freeze(plugins)
		});
	}
	stringify() {
		return stableJson(this.capture(), this.limits);
	}
	async load(input, options = {}) {
		this.assertActive("load a public snapshot");
		const prepared = await this.prepareForLoad(input, options);
		await this.loadPrepared(prepared, options);
	}
	prepare(input, options = {}) {
		this.assertActive("prepare a public snapshot");
		return this.prepareParsed(parseInput(input, this.limits), options);
	}
	async prepareForLoad(input, options = {}) {
		var _a;
		this.assertActive("prepare a public snapshot");
		const parsed = parseInput(input, this.limits);
		if (!((_a = options.migrations) === null || _a === void 0 ? void 0 : _a.length) || isRecord(parsed) && parsed.schema === "image-editor.state" && parsed.version === 3) return this.prepareParsed(parsed, options);
		const immutableInput = cloneStateValue(parsed);
		const migration = options.migrations.find((candidate) => candidate.canMigrate(immutableInput));
		if (!migration) return this.prepareParsed(parsed, options);
		const context = options.signal ? { signal: options.signal } : {};
		const migrated = await migration.migrate(immutableInput, context);
		return this.prepareParsed(parseInput(migrated, this.limits), options);
	}
	prepareParsed(input, options) {
		var _a, _b, _c, _d;
		const snapshot = this.validateEnvelope(input);
		const policy = (_a = options.missingPluginPolicy) !== null && _a !== void 0 ? _a : "warn-and-skip";
		const coreValidation = this.coreAdapter.validateSnapshot(snapshot.core);
		if (!coreValidation.valid) throw new SnapshotValidationError(coreValidation.message, (_b = coreValidation.path) !== null && _b !== void 0 ? _b : "$.core");
		const validatedSlices = [];
		const opaqueSlices = [];
		for (const [id, entry] of Object.entries(snapshot.plugins)) {
			if (byteLength(stableJson(entry.data, this.limits)) > this.limits.maxPluginPayloadBytes) throw new SnapshotValidationError(`plugin payload exceeds ${this.limits.maxPluginPayloadBytes} bytes.`, `$.plugins.${id}.data`);
			const slice = this.slices.get(id);
			if (!slice) {
				if (policy === "error") throw new SnapshotValidationError("required plugin is not installed.", `$.plugins.${id}`);
				if (policy === "preserve-opaque") opaqueSlices.push(Object.freeze({
					id,
					entry: cloneStateValue(entry)
				}));
				(_c = this.warningSink) === null || _c === void 0 || _c.call(this, {
					code: "SNAPSHOT_PLUGIN_MISSING",
					message: `Snapshot data for missing plugin "${id}" was ${policy === "preserve-opaque" ? "preserved opaquely" : "skipped"}.`,
					sliceId: id
				});
				continue;
			}
			if (entry.version !== slice.version) throw new SnapshotValidationError(`version ${entry.version} is incompatible with installed version ${slice.version}.`, `$.plugins.${id}.version`);
			const validation = slice.validate(entry.data, {
				sliceId: id,
				version: entry.version
			});
			if (!validation.valid) throw new SnapshotValidationError(validation.message, (_d = validation.path) !== null && _d !== void 0 ? _d : `$.plugins.${id}.data`);
			validatedSlices.push(Object.freeze({
				id,
				value: cloneStateValue(validation.value)
			}));
		}
		const prepared = Object.freeze({
			core: cloneStateValue(coreValidation.value),
			validatedSlices: Object.freeze(validatedSlices),
			opaqueSlices: Object.freeze(opaqueSlices)
		});
		this.prepared.add(prepared);
		return prepared;
	}
	async loadPrepared(prepared, options = {}) {
		var _a, _b, _c, _d;
		this.assertActive("load a prepared public snapshot");
		if (!this.prepared.has(prepared)) throw new SnapshotValidationError("prepared snapshot is not trusted.");
		const before = options.rollbackOnFailure === false ? null : this.mementos.capture();
		const controller = new AbortController();
		const abort = () => {
			var _a;
			return controller.abort((_a = options.signal) === null || _a === void 0 ? void 0 : _a.reason);
		};
		(_a = options.signal) === null || _a === void 0 || _a.addEventListener("abort", abort, { once: true });
		if ((_b = options.signal) === null || _b === void 0 ? void 0 : _b.aborted) abort();
		const context = Object.freeze({
			mode: "public-snapshot",
			signal: controller.signal
		});
		const validatedSlices = new Map(prepared.validatedSlices.map(({ id, value }) => [id, value]));
		const nextOpaque = new Map(prepared.opaqueSlices.map(({ id, entry }) => [id, entry]));
		try {
			await this.coreAdapter.restore(cloneStateValue(prepared.core), context);
			for (const slice of this.slices.list()) if (validatedSlices.has(slice.id)) await slice.restore(validatedSlices.get(slice.id), context);
			else await ((_c = slice.clearState) === null || _c === void 0 ? void 0 : _c.call(slice, context));
			this.opaque = nextOpaque;
		} catch (error) {
			if (!before) throw error;
			try {
				await this.mementos.restore(before, { rollbackOnFailure: false });
			} catch (rollbackError) {
				const combinedError = /* @__PURE__ */ new Error("Snapshot load and rollback both failed.");
				combinedError.causes = Object.freeze([error, rollbackError]);
				throw new SnapshotValidationError("load failed and rollback could not restore the previous state.", "$", combinedError);
			}
			throw error;
		} finally {
			(_d = options.signal) === null || _d === void 0 || _d.removeEventListener("abort", abort);
		}
	}
	dispose() {
		this.opaque.clear();
		this.disposed = true;
	}
	reset() {
		this.assertActive("reset SnapshotService");
		this.opaque.clear();
		this.prepared = /* @__PURE__ */ new WeakSet();
	}
	validateEnvelope(value) {
		if (!isRecord(value)) throw new SnapshotValidationError("snapshot must be an object.");
		if (isUnsupportedCanvasEnvelope(value)) throw new SnapshotVersionUnsupportedError(typeof value.version === "number" ? value.version : "unversioned");
		if (value.schema !== "image-editor.state") throw new SnapshotValidationError("schema must be \"image-editor.state\".", "$.schema");
		if (value.version !== 3) throw new SnapshotVersionUnsupportedError(typeof value.version === "number" ? value.version : "unversioned");
		if (!isRecord(value.core)) throw new SnapshotValidationError("core must be an object.", "$.core");
		if (!isRecord(value.plugins)) throw new SnapshotValidationError("plugins must be an object.", "$.plugins");
		const entries = Object.entries(value.plugins);
		if (entries.length > this.limits.maxPluginCount) throw new SnapshotValidationError(`plugin count exceeds ${this.limits.maxPluginCount}.`, "$.plugins");
		const plugins = Object.create(null);
		for (const [id, entry] of entries) {
			if (!require_plugin_identifier.isRuntimeIdentifier(id) || require_plugin_identifier.isDangerousStateKey(id)) throw new SnapshotValidationError("plugin id is invalid.", `$.plugins.${id}`);
			if (!isRecord(entry) || !Number.isSafeInteger(entry.version) || Number(entry.version) <= 0) throw new SnapshotValidationError("plugin entry requires a positive integer version and data.", `$.plugins.${id}`);
			plugins[id] = Object.freeze({
				version: Number(entry.version),
				data: entry.data
			});
		}
		return Object.freeze({
			schema: "image-editor.state",
			version: 3,
			core: cloneStateValue(value.core),
			plugins: Object.freeze(plugins)
		});
	}
	assertActive(operation) {
		if (this.disposed) throw new StateRegistrationError(`Cannot ${operation} after disposal.`);
	}
};

//#endregion
//#region dist/esm/core-runtime/state/state-slice-registry.js
function assertDefinition(definition) {
	if (!require_plugin_identifier.isRuntimeIdentifier(definition.id)) throw new StateRegistrationError("Invalid State Slice Runtime ID.", definition.id);
	if (!Number.isSafeInteger(definition.version) || definition.version <= 0) throw new StateRegistrationError(`State slice "${definition.id}" must use a positive integer version.`, definition.id);
	if (typeof definition.capture !== "function" || typeof definition.validate !== "function" || typeof definition.restore !== "function") throw new StateRegistrationError(`State slice "${definition.id}" has an incomplete contract.`, definition.id);
	if (definition.capturePolicy !== void 0 && definition.capturePolicy !== "always" && definition.capturePolicy !== "reference") throw new StateRegistrationError(`State slice "${definition.id}" capturePolicy must be "always" or "reference".`, definition.id);
}
var StateSliceRegistry = class {
	constructor() {
		Object.defineProperty(this, "definitions", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: {
				records: /* @__PURE__ */ new Map(),
				snapshot: Object.freeze([])
			}
		});
		Object.defineProperty(this, "disposed", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: false
		});
	}
	register(definition) {
		var _a;
		this.assertActive();
		assertDefinition(definition);
		if (this.definitions.records.has(definition.id)) throw new StateRegistrationError(`State slice "${definition.id}" is already registered.`, definition.id);
		const stored = Object.freeze({
			...definition,
			capturePolicy: (_a = definition.capturePolicy) !== null && _a !== void 0 ? _a : "always"
		});
		this.definitions.records.set(definition.id, stored);
		this.definitions.snapshot = Object.freeze([...this.definitions.records.values()]);
		return require_core_capabilities.createDisposable(() => {
			if (this.definitions.records.get(definition.id) === stored) {
				this.definitions.records.delete(definition.id);
				this.definitions.snapshot = Object.freeze([...this.definitions.records.values()]);
			}
		});
	}
	get(id) {
		var _a;
		this.assertActive();
		return (_a = this.definitions.records.get(id)) !== null && _a !== void 0 ? _a : null;
	}
	list() {
		this.assertActive();
		return this.definitions.snapshot;
	}
	dispose() {
		if (this.disposed) return;
		this.definitions.records.clear();
		this.definitions.snapshot = Object.freeze([]);
		this.disposed = true;
	}
	assertActive() {
		if (this.disposed) throw new StateRegistrationError("State slice registry is disposed.");
	}
};

//#endregion
//#region dist/esm/core-runtime/state/transient-object-registry.js
var TransientObjectRegistry = class {
	constructor(warningSink) {
		Object.defineProperty(this, "warningSink", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: warningSink
		});
		Object.defineProperty(this, "predicates", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: {
				records: [],
				snapshot: Object.freeze([])
			}
		});
		Object.defineProperty(this, "disposed", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: false
		});
	}
	register(owner, predicate) {
		this.assertActive();
		if (!require_plugin_identifier.isRuntimeIdentifier(owner)) throw new StateRegistrationError("Invalid transient predicate owner Runtime ID.");
		if (typeof predicate !== "function") throw new StateRegistrationError(`Transient predicate for "${owner}" must be a function.`);
		const record = {
			owner,
			predicate
		};
		this.predicates.records.push(record);
		this.predicates.snapshot = Object.freeze([...this.predicates.records]);
		return require_core_capabilities.createDisposable(() => {
			const index = this.predicates.records.indexOf(record);
			if (index < 0) return;
			this.predicates.records.splice(index, 1);
			this.predicates.snapshot = Object.freeze([...this.predicates.records]);
		});
	}
	isTransient(object) {
		var _a;
		this.assertActive();
		const snapshot = this.predicates.snapshot;
		for (const record of snapshot) try {
			if (record.predicate(object)) return true;
		} catch (error) {
			(_a = this.warningSink) === null || _a === void 0 || _a.call(this, {
				code: "TRANSIENT_PREDICATE_FAILED",
				message: `Transient object predicate owned by "${record.owner}" failed and was ignored.`,
				details: Object.freeze({
					owner: record.owner,
					cause: error
				})
			});
		}
		return false;
	}
	dispose() {
		if (this.disposed) return;
		this.predicates.records.length = 0;
		this.predicates.snapshot = Object.freeze([]);
		this.disposed = true;
	}
	assertActive() {
		if (this.disposed) throw new StateRegistrationError("Transient object registry is disposed.");
	}
};

//#endregion
//#region dist/esm/core-runtime/image-editor-core.js
const DEFAULT_CORE_OPTIONS = Object.freeze({
	canvasWidth: 800,
	canvasHeight: 600,
	backgroundColor: "#ffffff",
	layoutMode: "expand",
	groupSelection: true,
	maxInputBytes: 32 * 1024 * 1024,
	maxInputPixels: 64 * 1024 * 1024,
	imageLoadTimeoutMs: 3e4,
	maxExportPixels: 64 * 1024 * 1024,
	maxExportDimension: 16384,
	exportMultiplier: 1,
	initialImageBase64: ""
});
const MAX_RETAINED_DIAGNOSTICS = 1e3;
function positiveFinite(value, fallback) {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}
function positiveInteger(value, fallback) {
	return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
function isLayoutMode(value) {
	return value === "fit" || value === "cover" || value === "expand";
}
function resolveOptions(options) {
	var _a, _b, _c;
	const layoutMode = options.defaultLayoutMode;
	return Object.freeze({
		canvasWidth: positiveFinite(options.canvasWidth, DEFAULT_CORE_OPTIONS.canvasWidth),
		canvasHeight: positiveFinite(options.canvasHeight, DEFAULT_CORE_OPTIONS.canvasHeight),
		backgroundColor: (_a = options.backgroundColor) !== null && _a !== void 0 ? _a : DEFAULT_CORE_OPTIONS.backgroundColor,
		layoutMode: isLayoutMode(layoutMode) ? layoutMode : DEFAULT_CORE_OPTIONS.layoutMode,
		groupSelection: (_b = options.groupSelection) !== null && _b !== void 0 ? _b : DEFAULT_CORE_OPTIONS.groupSelection,
		maxInputBytes: positiveInteger(options.maxInputBytes, DEFAULT_CORE_OPTIONS.maxInputBytes),
		maxInputPixels: positiveInteger(options.maxInputPixels, DEFAULT_CORE_OPTIONS.maxInputPixels),
		imageLoadTimeoutMs: positiveInteger(options.imageLoadTimeoutMs, DEFAULT_CORE_OPTIONS.imageLoadTimeoutMs),
		maxExportPixels: positiveInteger(options.maxExportPixels, DEFAULT_CORE_OPTIONS.maxExportPixels),
		maxExportDimension: positiveInteger(options.maxExportDimension, DEFAULT_CORE_OPTIONS.maxExportDimension),
		exportMultiplier: positiveFinite(options.exportMultiplier, DEFAULT_CORE_OPTIONS.exportMultiplier),
		initialImageBase64: (_c = options.initialImageBase64) !== null && _c !== void 0 ? _c : "",
		...options.onError ? { onError: options.onError } : {},
		...options.onWarning ? { onWarning: options.onWarning } : {}
	});
}
function resolveElement(target, ownerDocument) {
	if (!target) return null;
	if (typeof target === "string") return ownerDocument.getElementById(target);
	return target;
}
function inferMimeType(source) {
	var _a;
	const match = /^data:(image\/(?:jpeg|png|webp))(?:[;,])/i.exec(source);
	const mimeType = (_a = match === null || match === void 0 ? void 0 : match[1]) === null || _a === void 0 ? void 0 : _a.toLowerCase();
	return mimeType === "image/jpeg" || mimeType === "image/png" || mimeType === "image/webp" ? mimeType : null;
}
function loadAbortError(message) {
	return new DOMException(message, "AbortError");
}
function loadAbortReason(signal, message) {
	const reason = signal.reason;
	return reason instanceof DOMException && reason.name === "AbortError" ? reason : loadAbortError(message);
}
function isLoadCancellation(error) {
	return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}
function withCoreTimeout(task, timeoutMs, label, signal, disposeLateResult) {
	return new Promise((resolve, reject) => {
		const startedAt = Date.now();
		const controller = new AbortController();
		let settled = false;
		const finish = (body) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeoutId);
			signal.removeEventListener("abort", abort);
			body();
		};
		const abort = () => {
			const reason = loadAbortReason(signal, `${label} was aborted.`);
			controller.abort(reason);
			finish(() => reject(reason));
		};
		const timeoutId = setTimeout(() => {
			const timeoutError = new CoreRuntimeError(`[ImageEditor] ${label} timed out after ${Date.now() - startedAt}ms.`, { code: "IMAGE_LOAD_TIMEOUT" });
			controller.abort(timeoutError);
			finish(() => reject(timeoutError));
		}, timeoutMs);
		signal.addEventListener("abort", abort, { once: true });
		if (signal.aborted) {
			abort();
			return;
		}
		try {
			task(controller.signal).then((value) => {
				if (settled) {
					try {
						disposeLateResult === null || disposeLateResult === void 0 || disposeLateResult(value);
					} catch {}
					return;
				}
				finish(() => resolve(value));
			}, (error) => finish(() => reject(error)));
		} catch (error) {
			finish(() => reject(error));
		}
	});
}
function toAffineMatrix(value) {
	if (value.length !== 6 || value.some((entry) => !Number.isFinite(entry))) throw new CoreRuntimeError("[ImageEditor] Base image returned a malformed transform matrix.");
	return Object.freeze([
		value[0],
		value[1],
		value[2],
		value[3],
		value[4],
		value[5]
	]);
}
function markBaseImage(image) {
	image.editorObjectKind = "baseImage";
	return image;
}
function isCoreImageInfo(value) {
	if (!value || typeof value !== "object") return false;
	const candidate = value;
	return typeof candidate.width === "number" && typeof candidate.height === "number" && typeof candidate.naturalWidth === "number" && typeof candidate.naturalHeight === "number" && typeof candidate.geometryRevision === "number";
}
function reportSafely(callback, error, message, fallback) {
	try {
		callback === null || callback === void 0 || callback(error, message);
	} catch (callbackError) {
		fallback("[ImageEditor] Error callback failed.", callbackError);
	}
}
function base64ToFile(dataUrl, fileName) {
	var _a, _b;
	const [header = "", payload = ""] = dataUrl.split(",", 2);
	const mimeType = (_b = (_a = /data:([^;]+)/.exec(header)) === null || _a === void 0 ? void 0 : _a[1]) !== null && _b !== void 0 ? _b : "application/octet-stream";
	const binary = /;base64/i.test(header) ? atob(payload) : decodeURIComponent(payload);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
	return new File([bytes], fileName, { type: mimeType });
}
var ImageEditorCore = class {
	constructor(fabric, options = {}) {
		Object.defineProperty(this, "fabric", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: fabric
		});
		Object.defineProperty(this, "options", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "slices", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: new StateSliceRegistry()
		});
		Object.defineProperty(this, "objectProperties", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: new ObjectPropertyRegistry()
		});
		Object.defineProperty(this, "transientObjects", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "externalObjects", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "history", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: new HistoryCommitRouter()
		});
		Object.defineProperty(this, "exportContributors", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: new ExportContributorRegistry()
		});
		Object.defineProperty(this, "mementos", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "snapshots", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "documentMutations", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "geometry", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "plugins", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "installationPlan", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: []
		});
		Object.defineProperty(this, "pluginApiHandles", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Map()
		});
		Object.defineProperty(this, "lifecycle", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: new EditorLifecycleController()
		});
		Object.defineProperty(this, "viewportCache", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: new ViewportCache()
		});
		Object.defineProperty(this, "canvas", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: null
		});
		Object.defineProperty(this, "canvasElement", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: null
		});
		Object.defineProperty(this, "containerElement", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: null
		});
		Object.defineProperty(this, "placeholderElement", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: null
		});
		Object.defineProperty(this, "baseImage", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: null
		});
		Object.defineProperty(this, "imageMimeType", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: null
		});
		Object.defineProperty(this, "imageLoaded", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: false
		});
		Object.defineProperty(this, "baseImageScale", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: 1
		});
		Object.defineProperty(this, "layoutMode", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "geometryRevision", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: 0
		});
		Object.defineProperty(this, "loadSequence", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: 0
		});
		Object.defineProperty(this, "latestLoadSequence", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: 0
		});
		Object.defineProperty(this, "stateLoadSequence", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: 0
		});
		Object.defineProperty(this, "initialImageLoadActive", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: false
		});
		Object.defineProperty(this, "disposePromise", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: null
		});
		Object.defineProperty(this, "emergencyResetPromise", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: null
		});
		Object.defineProperty(this, "diagnostics", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: []
		});
		if (!fabric || typeof fabric.Canvas !== "function" || typeof fabric.FabricImage !== "function") throw new CoreRuntimeError("[ImageEditor] ImageEditorCore requires a supported Fabric.js module.");
		this.options = resolveOptions(options);
		this.layoutMode = this.options.layoutMode;
		this.transientObjects = new TransientObjectRegistry((warning) => {
			var _a;
			this.reportWarning((_a = warning.details) === null || _a === void 0 ? void 0 : _a.cause, warning.message);
		});
		this.externalObjects = new TransientObjectRegistry((warning) => {
			var _a;
			this.reportWarning((_a = warning.details) === null || _a === void 0 ? void 0 : _a.cause, warning.message);
		});
		this.objectProperties.register({
			owner: "core:host",
			keys: ["editorObjectKind"]
		});
		const stateAdapter = new CanvasCoreStateAdapter({
			getCanvas: () => this.canvas,
			getBaseImage: () => this.baseImage,
			setBaseImage: (image) => {
				this.baseImage = image;
				this.imageLoaded = image !== null;
			},
			getImageMimeType: () => this.imageMimeType,
			setImageMimeType: (value) => {
				this.imageMimeType = value;
			},
			getBaseImageScale: () => this.baseImageScale,
			setBaseImageScale: (value) => {
				this.baseImageScale = value;
			},
			getGeometryRevision: () => this.geometryRevision,
			setGeometryRevision: (value) => {
				this.geometryRevision = value;
			},
			setCanvasSize: (width, height) => this.setCanvasSize(width, height),
			isDisposed: () => this.lifecycle.current === "disposed"
		}, this.objectProperties, this.transientObjects, this.externalObjects, {
			maxDecodedPixels: Math.min(this.options.maxInputPixels, this.options.maxExportPixels),
			maxImageDimension: Math.min(DEFAULT_SNAPSHOT_LIMITS.maxImageDimension, this.options.maxExportDimension),
			decodeTimeoutMs: this.options.imageLoadTimeoutMs
		});
		this.mementos = new MementoService(stateAdapter, this.slices);
		this.snapshots = new SnapshotService(stateAdapter, this.slices, this.mementos, (warning) => {
			var _a;
			return this.reportWarning((_a = warning.details) === null || _a === void 0 ? void 0 : _a.cause, warning.message);
		}, Object.freeze({
			...DEFAULT_SNAPSHOT_LIMITS,
			maxInputBytes: Math.ceil(this.options.maxInputBytes * 4 / 3) + 1024 * 1024,
			maxStringLength: Math.ceil(this.options.maxInputBytes * 4 / 3) + 1024,
			maxDataUrlBytes: this.options.maxInputBytes,
			maxDecodedPixels: Math.min(this.options.maxInputPixels, this.options.maxExportPixels),
			maxImageDimension: Math.min(DEFAULT_SNAPSHOT_LIMITS.maxImageDimension, this.options.maxExportDimension)
		}));
		this.documentMutations = new DocumentMutationCoordinator({
			mementos: this.mementos,
			operations: {
				has: (operationId) => {
					var _a, _b;
					return (_b = (_a = this.plugins) === null || _a === void 0 ? void 0 : _a.hasOperation(operationId)) !== null && _b !== void 0 ? _b : false;
				},
				get: (operationId) => {
					var _a, _b;
					return (_b = (_a = this.plugins) === null || _a === void 0 ? void 0 : _a.getOperationForHost(operationId)) !== null && _b !== void 0 ? _b : null;
				},
				run: (operationId, task, operationOptions) => {
					if (!this.plugins) throw new Error("Plugin Manager is not ready.");
					return this.plugins.runOperationForHost(operationId, null, (args, context) => {
						return task(context);
					}, operationOptions);
				}
			},
			state: {
				requestRender: () => this.requestRender(),
				isDisposed: () => this.lifecycle.current === "disposed",
				assertOperational: (operation) => this.assertDocumentMutationOperational(operation)
			},
			history: this.history,
			events: { emitCommitted: (descriptor) => this.emitDocumentCommitted(descriptor) },
			warningSink: (warning) => this.reportWarning(warning.cause, warning.message),
			errorSink: (error) => {
				if (!this.initialImageLoadActive) this.reportError(error, "Document mutation failed.");
			},
			faultSink: (error) => this.enterFaulted(error)
		});
		this.geometry = new GeometryMutationCoordinator({
			mutations: this.documentMutations,
			state: {
				captureGeometry: () => this.captureGeometry(),
				finalizeGeometry: () => {
					var _a;
					this.finalizeBaseImageGeometry();
					(_a = this.baseImage) === null || _a === void 0 || _a.setCoords();
					this.geometryRevision += 1;
				},
				restoreGeometry: (snapshot) => {
					this.setCanvasSize(snapshot.canvasWidth, snapshot.canvasHeight);
					this.geometryRevision = snapshot.revision;
				},
				requestRender: () => this.requestRender(),
				isDisposed: () => this.isDisposingOrDisposed()
			},
			warningSink: (warning) => this.reportWarning(warning.cause, warning.message),
			errorSink: (error) => this.reportError(error, "Geometry mutation failed.")
		});
		this.plugins = this.createPluginManager();
	}
	use(plugin) {
		this.lifecycle.assertAvailable("install a plugin");
		const outcome = this.plugins.installSyncForHost(plugin);
		this.installationPlan.push(Object.freeze({ definition: outcome.installedPlugin }));
		return this.publishPluginApi(plugin.ref.id, outcome.api);
	}
	install(pluginsOrPlan) {
		this.lifecycle.assertAvailable("install a plugin batch");
		const plugins = require_core_capabilities.isPluginPlan(pluginsOrPlan) ? pluginsOrPlan.plugins : pluginsOrPlan;
		const outcome = this.plugins.installBatchSync(plugins);
		for (const plugin of outcome.installedPlugins) this.installationPlan.push(Object.freeze({ definition: plugin }));
		const resolveApi = (plugin) => {
			const api = outcome.apisByPluginId.get(plugin.ref.id);
			if (api === void 0) throw new require_plugin_identifier.PluginNotInstalledError(plugin.ref.id);
			return this.publishPluginApi(plugin.ref.id, api);
		};
		if (require_core_capabilities.isPluginPlan(pluginsOrPlan)) return require_core_capabilities.resolvePluginPlanApis(pluginsOrPlan, resolveApi);
		return Object.freeze(pluginsOrPlan.map((plugin) => resolveApi(plugin)));
	}
	getPlugin(ref) {
		const api = this.plugins.get(ref);
		return api === null ? null : this.publishPluginApi(ref.id, api);
	}
	requirePlugin(ref) {
		const api = this.getPlugin(ref);
		if (api === null) throw new require_plugin_identifier.PluginNotInstalledError(ref.id);
		return api;
	}
	getPluginById(pluginId) {
		const api = this.plugins.getById(pluginId);
		return api === null ? null : this.publishPluginApi(pluginId, api);
	}
	getLifecycleState() {
		return this.lifecycle.current;
	}
	getDiagnostics() {
		return Object.freeze([...this.diagnostics]);
	}
	async init(elements) {
		this.lifecycle.beginInitialization();
		let pluginInitializationStarted = false;
		let pluginInitializationCompleted = false;
		let initialImageLoadStarted = false;
		try {
			this.createCanvas(elements);
			pluginInitializationStarted = true;
			await this.plugins.initialize();
			pluginInitializationCompleted = true;
			if (this.options.initialImageBase64) {
				initialImageLoadStarted = true;
				this.initialImageLoadActive = true;
				try {
					await this.performImageLoad(this.options.initialImageBase64);
				} finally {
					this.initialImageLoadActive = false;
				}
			} else this.updatePlaceholder();
			this.lifecycle.completeInitialization();
		} catch (error) {
			this.initialImageLoadActive = false;
			const cleanupErrors = await this.rollbackInitialization(error, pluginInitializationStarted, pluginInitializationCompleted);
			if (cleanupErrors.length > 0) {
				this.lifecycle.failInitialization();
				this.recordDiagnostic(error, "Initialization failed and cleanup was incomplete.");
				for (const cleanupError of cleanupErrors) this.recordDiagnostic(cleanupError, "Initialization cleanup failed.");
			} else this.lifecycle.recoverInitialization();
			if (initialImageLoadStarted) this.reportError(error, "Initial image load failed.");
			throw error;
		}
	}
	createCanvas(elements) {
		var _a, _b, _c, _d, _e, _f;
		const ownerDocument = typeof elements.canvas === "string" ? globalThis.document : (_a = elements.canvas) === null || _a === void 0 ? void 0 : _a.ownerDocument;
		if (!ownerDocument) throw new CoreRuntimeError("[ImageEditor] Canvas document is unavailable.");
		const canvasElement = resolveElement(elements.canvas, ownerDocument);
		if (!canvasElement || canvasElement.tagName.toLowerCase() !== "canvas" || typeof canvasElement.getContext !== "function") throw new CoreRuntimeError("[ImageEditor] Core canvas element was not found.");
		this.canvasElement = canvasElement;
		this.containerElement = (_b = resolveElement(elements.canvasContainer, ownerDocument)) !== null && _b !== void 0 ? _b : canvasElement.parentElement;
		this.placeholderElement = resolveElement(elements.imagePlaceholder, ownerDocument);
		const containerWidth = Math.floor((_d = (_c = this.containerElement) === null || _c === void 0 ? void 0 : _c.clientWidth) !== null && _d !== void 0 ? _d : 0);
		const containerHeight = Math.floor((_f = (_e = this.containerElement) === null || _e === void 0 ? void 0 : _e.clientHeight) !== null && _f !== void 0 ? _f : 0);
		const hasVisibleContainer = containerWidth > 0 && containerHeight > 0;
		const initialWidth = Math.max(1, Math.ceil(hasVisibleContainer ? containerWidth : this.options.canvasWidth));
		const initialHeight = Math.max(1, Math.ceil(hasVisibleContainer ? containerHeight : this.options.canvasHeight));
		this.assertRasterBudget(initialWidth, initialHeight);
		this.canvas = new this.fabric.Canvas(canvasElement, {
			width: initialWidth,
			height: initialHeight,
			backgroundColor: this.options.backgroundColor,
			selection: this.options.groupSelection,
			preserveObjectStacking: true
		});
	}
	async loadImage(source, options = {}) {
		this.assertReady("load an image");
		await this.performImageLoad(source, options);
	}
	async performImageLoad(source, options = {}) {
		const encodedImage = inspectEncodedImageDataUrl(source);
		if (!inferMimeType(source) || !encodedImage) throw new CoreRuntimeError("[ImageEditor] Unsupported image Data URL.");
		if (encodedImage.encodedBytes > this.options.maxInputBytes) throw new CoreRuntimeError("[ImageEditor] Image input exceeds maxInputBytes.");
		if (encodedImage.dimensions && !this.isInputRasterWithinBudget(encodedImage.dimensions.width, encodedImage.dimensions.height)) throw new CoreRuntimeError("[ImageEditor] Image input dimensions exceed the configured budget.");
		if (options.concurrency && options.concurrency !== "replace-pending") throw new CoreRuntimeError("[ImageEditor] Unsupported load concurrency policy.");
		try {
			await this.plugins.runOperationForHost("core:load-image", source, async (loadSource, operationContext) => {
				const sequence = ++this.loadSequence;
				this.latestLoadSequence = sequence;
				const image = await withCoreTimeout((signal) => this.fabric.FabricImage.fromURL(loadSource, {
					crossOrigin: "anonymous",
					signal
				}), this.options.imageLoadTimeoutMs, "FabricImage.fromURL", operationContext.signal, (lateImage) => lateImage.dispose());
				let imageAdopted = false;
				let previousScroll;
				try {
					this.assertCurrentLoad(sequence, operationContext.signal);
					const naturalWidth = Number(image.width) || 0;
					const naturalHeight = Number(image.height) || 0;
					if (!this.isInputRasterWithinBudget(naturalWidth, naturalHeight)) throw new CoreRuntimeError("[ImageEditor] Decoded image dimensions exceed the configured budget.");
					previousScroll = this.containerElement ? {
						left: this.containerElement.scrollLeft,
						top: this.containerElement.scrollTop
					} : null;
					await this.documentMutations.run({
						id: `core:load-image-transaction:${sequence}`,
						kind: "raster",
						operationId: "core:commit-load-image",
						conflictDomains: require_internal_operation_conflict_domains.DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS,
						signal: operationContext.signal,
						metadata: Object.freeze({ sequence }),
						mutate: async (commitContext) => {
							this.assertCurrentLoad(sequence, commitContext.signal);
							const previousBaseImage = this.baseImage;
							if (previousBaseImage) {
								await this.plugins.notifyImageCleared();
								this.assertCurrentLoad(sequence, commitContext.signal);
							}
							const canvas = this.requireCanvasForImageLoad("loadImage");
							canvas.discardActiveObject();
							canvas.clear();
							canvas.backgroundColor = this.options.backgroundColor;
							const baseImage = markBaseImage(image);
							baseImage.set({
								originX: "left",
								originY: "top",
								selectable: false,
								evented: false
							});
							const layout = this.computeLayout(baseImage);
							this.setCanvasSize(layout.canvasWidth, layout.canvasHeight);
							baseImage.set({
								left: layout.imageLeft,
								top: layout.imageTop,
								scaleX: layout.imageScale,
								scaleY: layout.imageScale
							});
							baseImage.setCoords();
							canvas.add(baseImage);
							canvas.sendObjectToBack(baseImage);
							this.baseImage = baseImage;
							imageAdopted = true;
							this.imageLoaded = true;
							this.baseImageScale = layout.imageScale;
							this.imageMimeType = inferMimeType(loadSource);
							this.geometryRevision += 1;
							disposeReplacedBaseImage(previousBaseImage, baseImage, "image replacement");
							const imageInfo = this.getImageInfo();
							if (!imageInfo) throw new Error("Loaded image information is unavailable.");
							await this.plugins.notifyImageLoaded(imageInfo);
							this.assertCurrentLoad(sequence, commitContext.signal);
							return imageInfo;
						},
						validate: (imageInfo, commitContext) => {
							if (!isCoreImageInfo(imageInfo)) throw new Error("Loaded image information is malformed.");
							this.assertCurrentLoad(sequence, commitContext.signal);
						}
					});
				} catch (error) {
					if (!imageAdopted) try {
						disposeReplacedBaseImage(image, null, "failed image load");
					} catch (cleanupError) {
						throw new CoreRuntimeError("[ImageEditor] Image load failed and decoded image cleanup also failed.", { cause: Object.freeze([error, cleanupError]) });
					}
					throw error;
				}
				if (options.preserveScroll && previousScroll && this.containerElement) {
					this.containerElement.scrollLeft = previousScroll.left;
					this.containerElement.scrollTop = previousScroll.top;
				}
				this.updatePlaceholder();
			}, options.signal ? { signal: options.signal } : {});
		} catch (error) {
			if (!isLoadCancellation(error) && !this.initialImageLoadActive) this.reportError(error, "loadImage failed.");
			throw error;
		}
	}
	async loadImageFile(file, options = {}) {
		var _a;
		if (!(file instanceof File)) throw new TypeError("[ImageEditor] loadImageFile expects a File.");
		if (file.size > this.options.maxInputBytes) throw new CoreRuntimeError("[ImageEditor] Image file exceeds maxInputBytes.");
		if ((_a = options.signal) === null || _a === void 0 ? void 0 : _a.aborted) throw loadAbortReason(options.signal, "Image file read was aborted.");
		const dataUrl = await new Promise((resolve, reject) => {
			var _a;
			const reader = new FileReader();
			const cleanup = () => {
				var _a;
				return (_a = options.signal) === null || _a === void 0 ? void 0 : _a.removeEventListener("abort", abort);
			};
			const abort = () => {
				reader.abort();
				cleanup();
				reject(loadAbortReason(options.signal, "Image file read was aborted."));
			};
			reader.onerror = () => {
				var _a;
				cleanup();
				reject((_a = reader.error) !== null && _a !== void 0 ? _a : /* @__PURE__ */ new Error("FileReader failed."));
			};
			reader.onload = () => {
				cleanup();
				if (typeof reader.result === "string") resolve(reader.result);
				else reject(/* @__PURE__ */ new Error("FileReader did not produce a Data URL."));
			};
			(_a = options.signal) === null || _a === void 0 || _a.addEventListener("abort", abort, { once: true });
			reader.readAsDataURL(file);
		});
		await this.loadImage(dataUrl, options);
	}
	saveState() {
		this.assertReady("save state");
		return this.snapshots.stringify();
	}
	async loadFromState(input, options = {}) {
		this.assertReady("load state");
		try {
			const prepared = await this.snapshots.prepareForLoad(input, {
				...options.missingPluginPolicy ? { missingPluginPolicy: options.missingPluginPolicy } : {},
				...options.migrations ? { migrations: options.migrations } : {},
				...options.signal ? { signal: options.signal } : {}
			});
			const sequence = ++this.stateLoadSequence;
			await this.documentMutations.run({
				id: `core:load-state-transaction:${sequence}`,
				kind: "compound",
				operationId: "core:load-state",
				conflictDomains: require_internal_operation_conflict_domains.DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS,
				...options.signal ? { signal: options.signal } : {},
				metadata: Object.freeze({ sequence }),
				mutate: async (context) => {
					await this.snapshots.loadPrepared(prepared, {
						signal: context.signal,
						rollbackOnFailure: false
					});
					return Object.freeze({ schemaVersion: 3 });
				}
			});
			this.updatePlaceholder();
		} catch (error) {
			if (!isLoadCancellation(error)) this.reportError(error, "loadFromState failed.");
			throw error;
		}
	}
	exportImageBase64(options = {}) {
		return this.runExport(options);
	}
	async exportImageFile(options = {}) {
		var _a, _b;
		const dataUrl = await this.runExport(options);
		const format = (_a = options.format) !== null && _a !== void 0 ? _a : "png";
		return base64ToFile(dataUrl, (_b = options.fileName) !== null && _b !== void 0 ? _b : `image.${format === "jpeg" ? "jpg" : format}`);
	}
	isImageLoaded() {
		return this.imageLoaded && this.baseImage !== null;
	}
	getImageInfo() {
		const image = this.baseImage;
		if (!image) return null;
		image.setCoords();
		const bounds = image.getBoundingRect();
		return Object.freeze({
			width: bounds.width,
			height: bounds.height,
			naturalWidth: Number(image.width) || 0,
			naturalHeight: Number(image.height) || 0,
			mimeType: this.imageMimeType,
			geometryRevision: this.geometryRevision
		});
	}
	getCanvas() {
		return this.canvas;
	}
	setLayoutMode(mode) {
		this.assertNotDisposed("set layout mode");
		if (!isLayoutMode(mode)) throw new TypeError("[ImageEditor] Layout mode must be \"fit\", \"cover\", or \"expand\".");
		this.layoutMode = mode;
		this.viewportCache.clear();
	}
	emergencyReset() {
		if (this.emergencyResetPromise) return this.emergencyResetPromise;
		if (this.lifecycle.current !== "faulted") return Promise.reject(new CoreRuntimeError(`[ImageEditor] emergencyReset() is available only while the editor is faulted.`, {
			code: "EMERGENCY_RESET_NOT_ALLOWED",
			behavior: "lifecycle"
		}));
		const reset = this.performEmergencyReset();
		this.emergencyResetPromise = reset;
		reset.then(() => {
			if (this.emergencyResetPromise === reset) this.emergencyResetPromise = null;
		}, () => {
			if (this.emergencyResetPromise === reset) this.emergencyResetPromise = null;
		});
		return reset;
	}
	async forceDispose() {
		if (this.lifecycle.current === "disposed") return;
		if (this.lifecycle.current !== "faulted") throw new CoreRuntimeError("[ImageEditor] forceDispose() is available only while the editor is faulted.", {
			code: "FORCE_DISPOSE_NOT_ALLOWED",
			behavior: "lifecycle"
		});
		try {
			await this.disposeAsync();
		} catch (error) {
			this.recordDiagnostic(error, "Forced disposal completed with cleanup failures.");
		}
	}
	dispose() {
		if (this.lifecycle.current === "disposed" || this.lifecycle.current === "disposing") return;
		if (this.geometry.isRunning || this.documentMutations.isRunning || this.plugins.hasRunningOperations()) {
			this.observeDetachedDisposal(this.disposeAsync());
			return;
		}
		if (!this.lifecycle.beginDisposal()) return;
		const errors = [];
		for (const cleanup of [
			() => this.plugins.disposeSync(),
			() => this.geometry.disposeSync(),
			() => this.documentMutations.disposeSync(),
			() => this.exportContributors.dispose(),
			() => this.snapshots.dispose(),
			() => this.mementos.dispose(),
			() => this.transientObjects.dispose(),
			() => this.externalObjects.dispose(),
			() => this.objectProperties.dispose(),
			() => this.slices.dispose()
		]) try {
			cleanup();
		} catch (error) {
			errors.push(error);
		}
		const canvas = this.canvas;
		try {
			this.clearRuntimeReferences();
		} catch (error) {
			errors.push(error);
		}
		let canvasDispose;
		if (canvas) try {
			canvasDispose = canvas.dispose();
		} catch (error) {
			errors.push(error);
		}
		if (canvasDispose && typeof canvasDispose.then === "function") {
			const disposal = Promise.resolve(canvasDispose).then(() => this.completeDisposal(errors, "Core disposal"), (error) => {
				errors.push(error);
				this.completeDisposal(errors, "Core disposal");
			});
			this.disposePromise = disposal;
			this.observeDetachedDisposal(disposal);
			return;
		}
		try {
			this.completeDisposal(errors, "Core disposal");
		} catch (error) {
			this.recordDiagnostic(error, "Synchronous Core disposal completed with failures.");
			this.reportError(error, "Synchronous Core disposal completed with failures.");
			throw error;
		}
	}
	disposeAsync() {
		var _a;
		if (this.disposePromise) return this.disposePromise;
		if (this.lifecycle.current === "disposed") return Promise.resolve();
		if (!this.lifecycle.beginDisposal()) return (_a = this.disposePromise) !== null && _a !== void 0 ? _a : Promise.resolve();
		this.disposePromise = this.performDisposeAsync();
		return this.disposePromise;
	}
	async performEmergencyReset() {
		const failures = [];
		const abortReason = new DOMException("Core emergency reset aborted active work.", "AbortError");
		await Promise.all([
			this.runEmergencyStep(failures, "Operation abort failed during emergency reset.", () => this.plugins.abortOperationsForHost(abortReason)),
			this.runEmergencyStep(failures, "Document mutation abort failed during emergency reset.", () => this.documentMutations.abortActive(abortReason)),
			this.runEmergencyStep(failures, "Geometry mutation abort failed during emergency reset.", () => this.geometry.abortActive(abortReason))
		]);
		await this.runEmergencyStep(failures, "Tool exit failed during emergency reset.", () => this.plugins.exitActiveToolForHost());
		const canvas = this.canvas;
		if (canvas) await this.runEmergencyStep(failures, "Canvas disposal failed during emergency reset.", () => canvas.dispose());
		this.clearRuntimeReferences();
		await this.runEmergencyStep(failures, "Plugin scope disposal failed during emergency reset.", () => this.plugins.dispose());
		await this.runEmergencyStep(failures, "Snapshot reset failed during emergency reset.", () => this.snapshots.reset());
		await this.runEmergencyStep(failures, "Memento reset failed during emergency reset.", () => this.mementos.reset());
		await this.runEmergencyStep(failures, "Document mutation reset failed during emergency reset.", () => this.documentMutations.reset());
		await this.runEmergencyStep(failures, "Geometry mutation reset failed during emergency reset.", () => this.geometry.reset());
		this.geometryRevision = 0;
		this.loadSequence = 0;
		this.latestLoadSequence = 0;
		this.stateLoadSequence = 0;
		this.layoutMode = this.options.layoutMode;
		this.disposePromise = null;
		if (failures.length > 0) {
			const failure = new CoreRuntimeError(`[ImageEditor] Emergency reset cleanup failed in ${failures.length} step(s).`, {
				code: "EMERGENCY_RESET_CLEANUP_ERROR",
				cause: Object.freeze([...failures]),
				behavior: "lifecycle"
			});
			await this.failEmergencyReset(failure);
		}
		try {
			await this.replayInstallationPlan();
		} catch (error) {
			this.recordDiagnostic(error, "Plugin replay failed during emergency reset.");
			await this.failEmergencyReset(error);
		}
		this.lifecycle.recoverFault();
	}
	async runEmergencyStep(failures, message, task) {
		try {
			await task();
		} catch (error) {
			failures.push(error);
			this.recordDiagnostic(error, message);
		}
	}
	async failEmergencyReset(cause) {
		await this.disposeAfterEmergencyFailure();
		throw new EmergencyResetError(this.getDiagnostics(), cause);
	}
	async disposeAfterEmergencyFailure() {
		if (!this.lifecycle.beginDisposal()) return;
		const cleanupSteps = [
			["Plugin cleanup failed after emergency reset.", () => this.plugins.dispose()],
			["Geometry cleanup failed after emergency reset.", () => this.geometry.dispose()],
			["Document mutation cleanup failed after emergency reset.", () => this.documentMutations.dispose()],
			["Snapshot cleanup failed after emergency reset.", () => this.snapshots.dispose()],
			["Export registry cleanup failed after emergency reset.", () => this.exportContributors.dispose()],
			["Memento cleanup failed after emergency reset.", () => this.mementos.dispose()],
			["Transient registry cleanup failed after emergency reset.", () => this.transientObjects.dispose()],
			["External object registry cleanup failed after emergency reset.", () => this.externalObjects.dispose()],
			["Object property registry cleanup failed after emergency reset.", () => this.objectProperties.dispose()],
			["State Slice cleanup failed after emergency reset.", () => this.slices.dispose()]
		];
		for (const [message, cleanup] of cleanupSteps) try {
			await cleanup();
		} catch (error) {
			this.recordDiagnostic(error, message);
		}
		this.clearRuntimeReferences();
		this.lifecycle.completeDisposal();
		this.clearPluginApiHandles();
	}
	createPluginManager() {
		const manager = new require_plugin_manager.PluginManager({
			warningSink: (warning) => this.reportWarning(warning.cause, warning.message),
			errorSink: (error) => this.reportError(error, "Plugin lifecycle failed."),
			hostCapabilities: [
				{
					token: CORE_ENVIRONMENT_CAPABILITY,
					implementation: this.createEnvironmentPort()
				},
				{
					token: require_core_capabilities.CORE_STATUS_CAPABILITY,
					implementation: this.createStatusPort()
				},
				{
					token: require_core_capabilities.CORE_DIAGNOSTICS_CAPABILITY,
					implementation: this.createDiagnosticsPort()
				},
				{
					token: require_core_capabilities.CORE_PRESENTATION_CAPABILITY,
					implementation: this.createPresentationPort()
				},
				{
					token: require_core_capabilities.FABRIC_RUNTIME_CAPABILITY,
					implementation: this.createFabricRuntimePort(),
					requiredPermission: "fabric:objects"
				},
				{
					token: require_core_capabilities.CANVAS_READ_CAPABILITY,
					implementation: this.createCanvasReadPort(),
					requiredPermission: "fabric:canvas-read"
				},
				{
					token: require_core_capabilities.BASE_IMAGE_READ_CAPABILITY,
					implementation: this.createBaseImageReadPort()
				},
				{
					token: require_core_capabilities.BASE_IMAGE_INFO_CAPABILITY,
					implementation: this.createBaseImageInfoPort()
				},
				{
					token: require_core_capabilities.IMAGE_RESOURCE_POLICY_CAPABILITY,
					implementation: this.createImageResourcePolicyPort()
				},
				{
					token: require_core_capabilities.RENDER_REQUEST_CAPABILITY,
					implementation: this.createRenderRequestPort()
				},
				{
					token: require_core_capabilities.CANVAS_RESIZE_CAPABILITY,
					implementation: this.createCanvasResizePort()
				},
				{
					token: require_core_capabilities.RASTER_MUTATION_CAPABILITY,
					implementation: this.createRasterMutationPort(),
					requiredPermission: "core:raster-mutation"
				},
				{
					token: require_core_capabilities.SNAPSHOT_REGISTRATION_CAPABILITY,
					implementation: this.createSnapshotRegistrationPort()
				},
				{
					token: require_core_capabilities.MEMENTO_HISTORY_CAPABILITY,
					implementation: this.createMementoHistoryPort()
				},
				{
					token: require_core_capabilities.GEOMETRY_MUTATION_CAPABILITY,
					implementation: this.geometry,
					requiredPermission: "core:geometry-participant"
				},
				{
					token: require_core_capabilities.DOCUMENT_MUTATION_CAPABILITY,
					implementation: this.documentMutations
				},
				{
					token: require_core_capabilities.EXPORT_CONTRIBUTION_CAPABILITY,
					implementation: this.exportContributors,
					requiredPermission: "core:export-contributor"
				}
			]
		});
		manager.registerHostOperation({
			id: "core:load-image",
			mode: "busy",
			conflictDomains: ["image-decode"],
			reentrancy: "replace"
		});
		manager.registerHostOperation({
			id: "core:commit-load-image",
			mode: "mutation",
			conflictDomains: require_internal_operation_conflict_domains.DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS,
			reentrancy: "queue"
		});
		manager.registerHostOperation({
			id: "core:load-state",
			mode: "mutation",
			conflictDomains: require_internal_operation_conflict_domains.DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS,
			reentrancy: "reject"
		});
		manager.registerHostOperation({
			id: "core:export",
			mode: "read",
			conflictDomains: [
				"document",
				"base-image",
				"overlay",
				"export",
				"state"
			],
			reentrancy: "queue"
		});
		return manager;
	}
	async rollbackInitialization(failure, pluginInitializationStarted, pluginInitializationCompleted) {
		const cleanupErrors = this.getInitializationCleanupErrors(failure);
		const canvas = this.canvas;
		if (pluginInitializationCompleted) try {
			await this.plugins.dispose();
		} catch (error) {
			cleanupErrors.push(error);
		}
		this.clearRuntimeReferences();
		if (canvas) try {
			await canvas.dispose();
		} catch (error) {
			cleanupErrors.push(error);
		}
		if (pluginInitializationStarted && cleanupErrors.length === 0) try {
			await this.replayInstallationPlan();
		} catch (error) {
			cleanupErrors.push(error);
		}
		return Object.freeze(cleanupErrors);
	}
	getInitializationCleanupErrors(failure) {
		return failure instanceof require_plugin_identifier.PluginLifecycleError ? [...failure.cleanupErrors] : [];
	}
	async replayInstallationPlan() {
		var _a, _b;
		const manager = this.createPluginManager();
		try {
			for (const planned of this.installationPlan) manager.installSync(planned.definition);
			const replayedApis = /* @__PURE__ */ new Map();
			for (const pluginId of this.pluginApiHandles.keys()) {
				const api = manager.getById(pluginId);
				if (!isProxyablePluginApi(api)) throw new CoreRuntimeError(`[ImageEditor] Replayed Plugin "${pluginId}" did not return a stable object API.`, {
					code: "PLUGIN_API_REPLAY_INCOMPATIBLE",
					behavior: "lifecycle"
				});
				replayedApis.set(pluginId, api);
			}
			for (const [pluginId, api] of replayedApis) (_a = this.pluginApiHandles.get(pluginId)) === null || _a === void 0 || _a.handle.assertCompatible(api);
			for (const [pluginId, api] of replayedApis) (_b = this.pluginApiHandles.get(pluginId)) === null || _b === void 0 || _b.handle.update(api);
		} catch (error) {
			await manager.dispose().catch(() => void 0);
			throw error;
		}
		this.plugins = manager;
	}
	publishPluginApi(pluginId, api) {
		if (!isProxyablePluginApi(api)) return api;
		const existing = this.pluginApiHandles.get(pluginId);
		if (existing) {
			existing.handle.update(api);
			return existing.handle.api;
		}
		const lifecycle = this.lifecycle;
		const handle = new StablePluginApiHandle(pluginId, api, (operation) => {
			if (lifecycle.current !== "disposing") lifecycle.assertAvailable(operation);
		});
		this.pluginApiHandles.set(pluginId, Object.freeze({ handle }));
		return handle.api;
	}
	clearPluginApiHandles() {
		for (const { handle } of this.pluginApiHandles.values()) handle.clear();
	}
	createEnvironmentPort() {
		return Object.freeze({
			options: this.options,
			isDisposed: () => this.isDisposingOrDisposed(),
			reportWarning: (error, message) => this.reportWarning(error, message),
			reportError: (error, message) => this.reportError(error, message)
		});
	}
	createStatusPort() {
		return Object.freeze({ isDisposed: () => this.isDisposingOrDisposed() });
	}
	createDiagnosticsPort() {
		return Object.freeze({
			reportWarning: (error, message) => this.reportWarning(error, message),
			reportError: (error, message) => this.reportError(error, message)
		});
	}
	createPresentationPort() {
		const resolveLayoutMode = () => this.layoutMode;
		return Object.freeze({
			backgroundColor: this.options.backgroundColor,
			get layoutMode() {
				return resolveLayoutMode();
			}
		});
	}
	createFabricRuntimePort() {
		return Object.freeze({ fabric: this.fabric });
	}
	createCanvasReadPort() {
		return Object.freeze({
			getCanvas: () => this.canvas,
			requireCanvas: (operation) => this.requireCanvasForPlugin(operation)
		});
	}
	createBaseImageReadPort() {
		return Object.freeze({
			getBaseImage: () => this.baseImage,
			...this.createBaseImageInfoPort()
		});
	}
	createBaseImageInfoPort() {
		return Object.freeze({
			getBaseImageScale: () => this.baseImageScale,
			getGeometryRevision: () => this.geometryRevision,
			getCanvasSize: () => {
				var _a, _b, _c, _d;
				return Object.freeze({
					width: (_b = (_a = this.canvas) === null || _a === void 0 ? void 0 : _a.getWidth()) !== null && _b !== void 0 ? _b : 0,
					height: (_d = (_c = this.canvas) === null || _c === void 0 ? void 0 : _c.getHeight()) !== null && _d !== void 0 ? _d : 0
				});
			},
			getImageInfo: () => this.getImageInfo(),
			isImageLoaded: () => this.isImageLoaded()
		});
	}
	createImageResourcePolicyPort() {
		return Object.freeze({ getImageResourcePolicy: () => Object.freeze({
			maxInputBytes: this.options.maxInputBytes,
			maxInputPixels: this.options.maxInputPixels,
			imageLoadTimeoutMs: this.options.imageLoadTimeoutMs,
			maxExportPixels: this.options.maxExportPixels,
			maxExportDimension: this.options.maxExportDimension
		}) });
	}
	createRenderRequestPort() {
		return Object.freeze({ requestRender: () => this.requestRender() });
	}
	createCanvasResizePort() {
		return Object.freeze({ resizeCanvas: (width, height) => this.setCanvasSize(width, height) });
	}
	createRasterMutationPort() {
		return Object.freeze({ replaceBaseImage: (context, image, replacementOptions) => {
			var _a;
			this.documentMutations.assertContextActive(context);
			const canvas = this.requireCanvasForPlugin("replace the base image");
			if (this.baseImage && this.baseImage !== image) canvas.remove(this.baseImage);
			markBaseImage(image);
			if (!canvas.getObjects().includes(image)) canvas.add(image);
			canvas.sendObjectToBack(image);
			this.baseImage = image;
			this.imageLoaded = true;
			this.baseImageScale = positiveFinite(replacementOptions === null || replacementOptions === void 0 ? void 0 : replacementOptions.baseScale, 1);
			this.imageMimeType = (_a = replacementOptions === null || replacementOptions === void 0 ? void 0 : replacementOptions.mimeType) !== null && _a !== void 0 ? _a : this.imageMimeType;
			this.geometryRevision += 1;
			this.updatePlaceholder();
		} });
	}
	createSnapshotRegistrationPort() {
		return Object.freeze({
			registerSlice: (definition) => this.slices.register(definition),
			registerObjectProperties: (registration) => this.objectProperties.register(registration),
			registerTransientObject: (owner, predicate) => this.transientObjects.register(owner, predicate),
			registerExternalObject: (owner, predicate) => this.externalObjects.register(owner, predicate)
		});
	}
	createMementoHistoryPort() {
		return Object.freeze({
			captureMemento: () => this.mementos.capture(),
			restoreMemento: (memento, options) => this.mementos.restore(memento, options),
			registerHistoryProvider: (owner, provider) => this.history.register(owner, provider),
			reportFatal: (error) => this.enterFaulted(error)
		});
	}
	computeLayout(image) {
		var _a, _b;
		const scrollbarSize = measureScrollbarSize((_b = (_a = this.containerElement) === null || _a === void 0 ? void 0 : _a.ownerDocument) !== null && _b !== void 0 ? _b : null);
		const viewport = this.viewportCache.measure(this.containerElement, {
			width: this.options.canvasWidth,
			height: this.options.canvasHeight
		}, scrollbarSize);
		const strategy = selectLayoutStrategy(this.layoutMode);
		const width = Number(image.width) || 0;
		const height = Number(image.height) || 0;
		if (strategy === "fit") return computeFitLayout(width, height, this.options.canvasWidth, this.options.canvasHeight, viewport);
		if (strategy === "cover") return computeCoverLayout(width, height, this.options.canvasWidth, this.options.canvasHeight, viewport, scrollbarSize);
		return computeExpandLayout(width, height, viewport);
	}
	captureGeometry() {
		const canvas = this.requireCanvas("capture base-image geometry");
		const image = this.baseImage;
		if (!image) return Object.freeze({
			matrix: IDENTITY_AFFINE_MATRIX,
			boundingBox: Object.freeze({
				left: 0,
				top: 0,
				width: 0,
				height: 0
			}),
			canvasWidth: canvas.getWidth(),
			canvasHeight: canvas.getHeight(),
			revision: this.geometryRevision
		});
		image.setCoords();
		const bounds = image.getBoundingRect();
		return Object.freeze({
			matrix: toAffineMatrix(image.calcTransformMatrix()),
			boundingBox: Object.freeze({
				left: bounds.left,
				top: bounds.top,
				width: bounds.width,
				height: bounds.height
			}),
			canvasWidth: canvas.getWidth(),
			canvasHeight: canvas.getHeight(),
			revision: this.geometryRevision
		});
	}
	finalizeBaseImageGeometry() {
		var _a, _b, _c, _d, _e, _f;
		const image = this.baseImage;
		const canvas = this.canvas;
		if (!image || !canvas) return;
		image.setCoords();
		const bounds = image.getBoundingRect();
		const scrollbarSize = measureScrollbarSize((_d = (_b = (_a = this.containerElement) === null || _a === void 0 ? void 0 : _a.ownerDocument) !== null && _b !== void 0 ? _b : (_c = this.canvasElement) === null || _c === void 0 ? void 0 : _c.ownerDocument) !== null && _d !== void 0 ? _d : null);
		const viewport = this.viewportCache.measure(this.containerElement, {
			width: this.options.canvasWidth,
			height: this.options.canvasHeight
		}, scrollbarSize);
		if (bounds.width <= viewport.width + .5 && bounds.height <= viewport.height + .5) this.setCanvasSize(Math.max(1, viewport.width - 1), Math.max(1, viewport.height - 1));
		else if (this.layoutMode === "fit" || this.layoutMode === "cover") {
			const size = computeScrollableCanvasSize(bounds.width, bounds.height, viewport, scrollbarSize);
			this.setCanvasSize(size.width, size.height);
		} else this.setCanvasSize(Math.max(viewport.width, Math.ceil(bounds.width)), Math.max(viewport.height, Math.ceil(bounds.height)));
		image.set({
			left: ((_e = image.left) !== null && _e !== void 0 ? _e : 0) - bounds.left,
			top: ((_f = image.top) !== null && _f !== void 0 ? _f : 0) - bounds.top
		});
		image.setCoords();
		canvas.sendObjectToBack(image);
	}
	setCanvasSize(width, height) {
		if (!this.canvas) return;
		const nextWidth = Math.max(1, Math.ceil(width));
		const nextHeight = Math.max(1, Math.ceil(height));
		this.assertRasterBudget(nextWidth, nextHeight);
		applyCanvasDimensions(this.canvas, nextWidth, nextHeight, this.containerElement);
	}
	isInputRasterWithinBudget(width, height) {
		return require_image_budget.isRasterAllocationWithinBudget(width, height, {
			maxDimension: this.options.maxExportDimension,
			maxPixels: Math.min(this.options.maxInputPixels, this.options.maxExportPixels)
		});
	}
	assertRasterBudget(width, height, multiplier = 1) {
		if (!require_image_budget.isRasterAllocationWithinBudget(width, height, {
			maxDimension: this.options.maxExportDimension,
			maxPixels: this.options.maxExportPixels
		}, multiplier)) throw new CoreRuntimeError("[ImageEditor] Dimensions exceed the configured budget.");
	}
	async runExport(options) {
		var _a, _b, _c, _d;
		this.assertReady("export an image");
		const operation = this.plugins.beginOperationForHost("core:export");
		try {
			const canvas = this.requireCanvas("exportImageBase64");
			const multiplier = positiveFinite(options.multiplier, this.options.exportMultiplier);
			const format = (_a = options.format) !== null && _a !== void 0 ? _a : "png";
			const quality = Math.max(0, Math.min(1, (_b = options.quality) !== null && _b !== void 0 ? _b : .92));
			let left = 0;
			let top = 0;
			let width = canvas.getWidth();
			let height = canvas.getHeight();
			if (((_c = options.area) !== null && _c !== void 0 ? _c : "image") === "image") {
				if (!this.baseImage) throw new CoreRuntimeError("[ImageEditor] No image is loaded.");
				this.baseImage.setCoords();
				const bounds = this.baseImage.getBoundingRect();
				left = bounds.left;
				top = bounds.top;
				width = bounds.width;
				height = bounds.height;
			}
			this.assertRasterBudget(width, height, multiplier);
			this.assertRasterBudget(canvas.getWidth(), canvas.getHeight());
			const exportElement = (_d = this.canvasElement) === null || _d === void 0 ? void 0 : _d.ownerDocument.createElement("canvas");
			if (!exportElement) throw new CoreRuntimeError("[ImageEditor] Export requires an initialized Canvas.");
			const exportCanvas = new this.fabric.StaticCanvas(exportElement, {
				width: canvas.getWidth(),
				height: canvas.getHeight(),
				backgroundColor: this.options.backgroundColor,
				renderOnAddRemove: false
			});
			try {
				if (this.baseImage) {
					const clonedBaseImage = await this.baseImage.clone();
					exportCanvas.add(clonedBaseImage);
					exportCanvas.sendObjectToBack(clonedBaseImage);
				}
				await this.exportContributors.render({
					canvas: exportCanvas,
					options
				});
				exportCanvas.renderAll();
				return exportCanvas.toDataURL({
					format,
					quality,
					multiplier,
					left,
					top,
					width,
					height
				});
			} finally {
				await exportCanvas.dispose();
			}
		} finally {
			await operation.dispose();
		}
	}
	async emitDocumentCommitted(descriptor) {
		var _a, _b, _c, _d;
		if (descriptor.kind === "geometry") {
			await ((_a = this.plugins) === null || _a === void 0 ? void 0 : _a.emitCommitted("geometry:committed", descriptor.result));
			return;
		}
		if (descriptor.operationId === "core:commit-load-image" && isCoreImageInfo(descriptor.result)) {
			await ((_b = this.plugins) === null || _b === void 0 ? void 0 : _b.emitCommitted("image:loaded", descriptor.result));
			return;
		}
		if (descriptor.operationId === "core:load-state") {
			await ((_c = this.plugins) === null || _c === void 0 ? void 0 : _c.emitCommitted("state:loaded", { schemaVersion: 3 }));
			return;
		}
		await ((_d = this.plugins) === null || _d === void 0 ? void 0 : _d.emitCommitted("document:committed", descriptor));
	}
	assertCurrentLoad(sequence, signal) {
		if (signal.aborted) throw loadAbortReason(signal, "Image load was aborted.");
		if (sequence !== this.latestLoadSequence) throw loadAbortError("Image load result is stale.");
	}
	requireCanvas(operation) {
		this.assertReady(operation);
		if (!this.canvas) throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} without Canvas.`);
		return this.canvas;
	}
	requireCanvasForImageLoad(operation) {
		if (!this.initialImageLoadActive || this.lifecycle.current !== "initializing") return this.requireCanvas(operation);
		if (!this.canvas) throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} without Canvas.`);
		return this.canvas;
	}
	requireCanvasForPlugin(operation) {
		if (this.lifecycle.current !== "initializing") this.lifecycle.assertOperational(operation);
		if (!this.canvas) throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} without Canvas.`);
		return this.canvas;
	}
	requestRender() {
		var _a;
		if (this.lifecycle.current !== "disposed") (_a = this.canvas) === null || _a === void 0 || _a.requestRenderAll();
	}
	updatePlaceholder() {
		if (this.placeholderElement) this.placeholderElement.hidden = this.baseImage !== null;
	}
	reportWarning(error, message) {
		reportSafely(this.options.onWarning, error, message, console.warn);
	}
	reportError(error, message) {
		reportSafely(this.options.onError, error, message, console.error);
	}
	enterFaulted(error) {
		const state = this.lifecycle.current;
		if (state === "disposed" || state === "disposing") return;
		if (state === "initialized") this.lifecycle.failRuntime();
		else if (state !== "faulted") {
			this.recordDiagnostic(error, `A fatal error occurred while Core was ${state}.`);
			return;
		}
		this.plugins.suspendOperationsForHost(new EditorFaultedError("run an operation")).catch((suspensionError) => {
			this.recordDiagnostic(suspensionError, "Faulted operation suspension failed.");
		});
		this.recordDiagnostic(error);
		this.reportError(error, "Core entered the faulted lifecycle state.");
	}
	recordDiagnostic(error, message) {
		const classification = classifyCoreError(error);
		let errorCode;
		if (error && typeof error === "object") try {
			errorCode = Reflect.get(error, "code");
		} catch {
			errorCode = void 0;
		}
		const code = typeof errorCode === "string" ? errorCode : "UNCLASSIFIED_CORE_ERROR";
		const diagnostic = Object.freeze({
			...classification,
			timestamp: Date.now(),
			code,
			message: message !== null && message !== void 0 ? message : error instanceof Error ? error.message : String(error),
			cause: error instanceof CoreRuntimeError && error.cause !== void 0 ? error.cause : error
		});
		this.diagnostics.push(diagnostic);
		if (this.diagnostics.length > MAX_RETAINED_DIAGNOSTICS) this.diagnostics.splice(0, this.diagnostics.length - MAX_RETAINED_DIAGNOSTICS);
		return diagnostic;
	}
	assertReady(operation) {
		this.lifecycle.assertOperational(operation);
		if (!this.canvas) throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} without Canvas.`);
	}
	assertDocumentMutationOperational(operation) {
		if (this.initialImageLoadActive && this.lifecycle.current === "initializing") return;
		this.lifecycle.assertOperational(operation);
	}
	assertNotDisposed(operation) {
		this.lifecycle.assertAvailable(operation);
	}
	isDisposingOrDisposed() {
		return this.lifecycle.current === "disposing" || this.lifecycle.current === "disposed";
	}
	clearRuntimeReferences() {
		this.canvas = null;
		this.canvasElement = null;
		this.containerElement = null;
		this.placeholderElement = null;
		this.baseImage = null;
		this.imageLoaded = false;
		this.imageMimeType = null;
		this.baseImageScale = 1;
		this.viewportCache.clear();
	}
	async performDisposeAsync() {
		const errors = [];
		for (const cleanup of [
			() => this.geometry.dispose(),
			() => this.documentMutations.dispose(),
			() => this.plugins.dispose(),
			() => this.snapshots.dispose(),
			() => this.exportContributors.dispose(),
			() => this.mementos.dispose(),
			() => this.transientObjects.dispose(),
			() => this.externalObjects.dispose(),
			() => this.objectProperties.dispose(),
			() => this.slices.dispose()
		]) try {
			await Promise.resolve(cleanup());
		} catch (error) {
			errors.push(error);
		}
		const canvas = this.canvas;
		try {
			this.clearRuntimeReferences();
		} catch (error) {
			errors.push(error);
		}
		if (canvas) try {
			await canvas.dispose();
		} catch (error) {
			errors.push(error);
		}
		this.completeDisposal(errors, "Async disposal");
	}
	completeDisposal(errors, label) {
		this.lifecycle.completeDisposal();
		this.clearPluginApiHandles();
		if (errors.length > 0) throw new CoreRuntimeError(`[ImageEditor] ${label} completed with ${errors.length} cleanup error(s).`, {
			code: "CORE_DISPOSE_ERROR",
			cause: Object.freeze(errors)
		});
	}
	observeDetachedDisposal(disposal) {
		disposal.catch((error) => {
			this.recordDiagnostic(error, "Detached Core disposal completed with cleanup failures.");
			this.reportError(error, "Detached Core disposal completed with cleanup failures.");
		});
	}
};

//#endregion
Object.defineProperty(exports, 'AFFINE_EPSILON', {
  enumerable: true,
  get: function () {
    return AFFINE_EPSILON;
  }
});
Object.defineProperty(exports, 'CoreRuntimeError', {
  enumerable: true,
  get: function () {
    return CoreRuntimeError;
  }
});
Object.defineProperty(exports, 'DEFAULT_SNAPSHOT_LIMITS', {
  enumerable: true,
  get: function () {
    return DEFAULT_SNAPSHOT_LIMITS;
  }
});
Object.defineProperty(exports, 'DocumentMutationInvariantError', {
  enumerable: true,
  get: function () {
    return DocumentMutationInvariantError;
  }
});
Object.defineProperty(exports, 'EditorAlreadyInitializedError', {
  enumerable: true,
  get: function () {
    return EditorAlreadyInitializedError;
  }
});
Object.defineProperty(exports, 'EditorDisposedError', {
  enumerable: true,
  get: function () {
    return EditorDisposedError;
  }
});
Object.defineProperty(exports, 'EditorDisposingError', {
  enumerable: true,
  get: function () {
    return EditorDisposingError;
  }
});
Object.defineProperty(exports, 'EditorFaultedError', {
  enumerable: true,
  get: function () {
    return EditorFaultedError;
  }
});
Object.defineProperty(exports, 'EditorInitializationInProgressError', {
  enumerable: true,
  get: function () {
    return EditorInitializationInProgressError;
  }
});
Object.defineProperty(exports, 'EmergencyResetError', {
  enumerable: true,
  get: function () {
    return EmergencyResetError;
  }
});
Object.defineProperty(exports, 'IDENTITY_AFFINE_MATRIX', {
  enumerable: true,
  get: function () {
    return IDENTITY_AFFINE_MATRIX;
  }
});
Object.defineProperty(exports, 'ImageEditorCore', {
  enumerable: true,
  get: function () {
    return ImageEditorCore;
  }
});
Object.defineProperty(exports, 'MementoService', {
  enumerable: true,
  get: function () {
    return MementoService;
  }
});
Object.defineProperty(exports, 'ObjectPropertyRegistry', {
  enumerable: true,
  get: function () {
    return ObjectPropertyRegistry;
  }
});
Object.defineProperty(exports, 'SnapshotService', {
  enumerable: true,
  get: function () {
    return SnapshotService;
  }
});
Object.defineProperty(exports, 'SnapshotValidationError', {
  enumerable: true,
  get: function () {
    return SnapshotValidationError;
  }
});
Object.defineProperty(exports, 'SnapshotVersionUnsupportedError', {
  enumerable: true,
  get: function () {
    return SnapshotVersionUnsupportedError;
  }
});
Object.defineProperty(exports, 'StateSliceRegistry', {
  enumerable: true,
  get: function () {
    return StateSliceRegistry;
  }
});
Object.defineProperty(exports, 'TransientObjectRegistry', {
  enumerable: true,
  get: function () {
    return TransientObjectRegistry;
  }
});
Object.defineProperty(exports, 'affineDeterminant', {
  enumerable: true,
  get: function () {
    return affineDeterminant;
  }
});
Object.defineProperty(exports, 'applyAffineToPoint', {
  enumerable: true,
  get: function () {
    return applyAffineToPoint;
  }
});
Object.defineProperty(exports, 'approximatelyEqualAffine', {
  enumerable: true,
  get: function () {
    return approximatelyEqualAffine;
  }
});
Object.defineProperty(exports, 'assertAffineMatrix', {
  enumerable: true,
  get: function () {
    return assertAffineMatrix;
  }
});
Object.defineProperty(exports, 'assertSafeImmutableReference', {
  enumerable: true,
  get: function () {
    return assertSafeImmutableReference;
  }
});
Object.defineProperty(exports, 'classifyCoreError', {
  enumerable: true,
  get: function () {
    return classifyCoreError;
  }
});
Object.defineProperty(exports, 'cloneStateValue', {
  enumerable: true,
  get: function () {
    return cloneStateValue;
  }
});
Object.defineProperty(exports, 'computeAffineDelta', {
  enumerable: true,
  get: function () {
    return computeAffineDelta;
  }
});
Object.defineProperty(exports, 'hasAffineReflection', {
  enumerable: true,
  get: function () {
    return hasAffineReflection;
  }
});
Object.defineProperty(exports, 'invertAffine', {
  enumerable: true,
  get: function () {
    return invertAffine;
  }
});
Object.defineProperty(exports, 'isFiniteAffineMatrix', {
  enumerable: true,
  get: function () {
    return isFiniteAffineMatrix;
  }
});
Object.defineProperty(exports, 'multiplyAffine', {
  enumerable: true,
  get: function () {
    return multiplyAffine;
  }
});
Object.defineProperty(exports, 'sanitizeAffineMatrix', {
  enumerable: true,
  get: function () {
    return sanitizeAffineMatrix;
  }
});
Object.defineProperty(exports, 'transformRectBounds', {
  enumerable: true,
  get: function () {
    return transformRectBounds;
  }
});
//# sourceMappingURL=core-D_s-hE8G.cjs.map