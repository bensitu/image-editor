const require_plugin_identifier = require('./plugin-identifier-DhlVh5SQ.cjs');
const require_core_capabilities = require('./core-capabilities-DPdoMgAf.cjs');
const require_core = require('./core-DoRtVRUM.cjs');
const require_image_budget = require('./image-budget-fYafUuFf.cjs');
const require_internal_operation_conflict_domains = require('./internal-operation-conflict-domains-Cx-QNq29.cjs');
const require_sdk = require('./sdk-CkdOSZDn.cjs');
const require_abortable_promise = require('./abortable-promise-Cd-vToiC.cjs');

//#region dist/esm/foundations/overlay/overlay-transform-delta.js
function isFiniteTransformMatrix(matrix) {
	return matrix.length === 6 && matrix.every((value) => Number.isFinite(value));
}
function isApproximatelyIdentityTransform(matrix, epsilon = 1e-10) {
	const identity = [
		1,
		0,
		0,
		1,
		0,
		0
	];
	return matrix.length === identity.length && matrix.every((value, index) => Math.abs(value - identity[index]) <= epsilon);
}
function deltaHasReflection(delta) {
	if (!isFiniteTransformMatrix(delta)) return false;
	const [a, b, c, d] = delta;
	return a * d - b * c < 0;
}
function transformPointByMatrix(point, matrix, fabricUtil) {
	const [a, b, c, d, e, f] = matrix;
	return new fabricUtil.Point(a * point.x + c * point.y + e, b * point.x + d * point.y + f);
}
function stripReflectionFromDelta(delta, fabricUtil) {
	if (!deltaHasReflection(delta)) return delta;
	const flipXCandidate = fabricUtil.multiplyTransformMatrices(delta, [
		-1,
		0,
		0,
		1,
		0,
		0
	]);
	const flipYCandidate = fabricUtil.multiplyTransformMatrices(delta, [
		1,
		0,
		0,
		-1,
		0,
		0
	]);
	const normalizedAngleMagnitude = (matrix) => {
		try {
			const angle = fabricUtil.qrDecompose(matrix).angle;
			return Number.isFinite(angle) ? Math.abs((angle % 360 + 540) % 360 - 180) : Number.POSITIVE_INFINITY;
		} catch {
			return Number.POSITIVE_INFINITY;
		}
	};
	return normalizedAngleMagnitude(flipYCandidate) < normalizedAngleMagnitude(flipXCandidate) ? flipYCandidate : flipXCandidate;
}
function applyDeltaToObject(object, fullDelta, context) {
	var _a;
	if (!isFiniteTransformMatrix(fullDelta) || isApproximatelyIdentityTransform(fullDelta)) return;
	const { fabricUtil } = context;
	object.setCoords();
	const previousTransform = {
		angle: object.angle,
		scaleX: object.scaleX,
		scaleY: object.scaleY,
		skewX: object.skewX,
		skewY: object.skewY,
		flipX: object.flipX,
		flipY: object.flipY
	};
	const originalCenter = object.getCenterPoint();
	const targetCenter = transformPointByMatrix(originalCenter, fullDelta, fabricUtil);
	const orientationDelta = context.preserveReadableText ? stripReflectionFromDelta(fullDelta, fabricUtil) : fullDelta;
	let restoreCenter = originalCenter;
	let committed = false;
	try {
		const nextMatrix = fabricUtil.multiplyTransformMatrices(orientationDelta, object.calcTransformMatrix());
		if (!isFiniteTransformMatrix(nextMatrix)) return;
		const decomposed = fabricUtil.qrDecompose(nextMatrix);
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
		committed = true;
	} finally {
		if (!committed) object.set(previousTransform);
		object.setPositionByOrigin(restoreCenter, "center", "center");
		object.setCoords();
	}
}

//#endregion
//#region dist/esm/foundations/overlay/overlay-errors.js
var OverlayRecoverableObjectError = class extends require_core.CoreRuntimeError {
	constructor(message, cause) {
		super(`[ImageEditor] Recoverable overlay object failure: ${message}`, {
			code: "OVERLAY_RECOVERABLE_OBJECT_ERROR",
			cause,
			behavior: "recoverable-object"
		});
	}
};

//#endregion
//#region dist/esm/foundations/overlay/overlay-foundation-controller.js
const INTERACTIVE_MUTATION_BOUNDARY = Symbol.for("@bensitu/image-editor/internal-interactive-mutation-boundary/v1");
function withInteractiveMutationBoundary(request, boundary) {
	return Object.assign(request, { [INTERACTIVE_MUTATION_BOUNDARY]: boundary });
}
function getActiveCanvasObjects(canvas) {
	var _a;
	const candidate = canvas;
	if (typeof candidate.getActiveObjects === "function") return candidate.getActiveObjects();
	const active = (_a = candidate.getActiveObject) === null || _a === void 0 ? void 0 : _a.call(candidate);
	return active ? [active] : [];
}
function isSessionCanvasObject(object) {
	const candidate = object;
	return candidate.editorObjectKind === "session" && typeof candidate.sessionObjectType === "string";
}
const EMPTY_SELECTION_STATE = Object.freeze({
	ids: Object.freeze([]),
	primaryId: null,
	kinds: Object.freeze([])
});
function isAbortError(error) {
	return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}
function abortError(message) {
	if (typeof DOMException === "function") return new DOMException(message, "AbortError");
	const error = new Error(message);
	error.name = "AbortError";
	return error;
}
function gestureAction(value) {
	if (value === "rotate" || (value === null || value === void 0 ? void 0 : value.includes("rotate"))) return "rotate";
	if (value === "scale" || (value === null || value === void 0 ? void 0 : value.includes("scale"))) return "scale";
	return "move";
}
var OverlayFlattenError = class extends require_core.CoreRuntimeError {
	constructor(message, cause) {
		super(`[ImageEditor] Overlay flatten failed: ${message}`, {
			code: "OVERLAY_FLATTEN_ERROR",
			cause
		});
	}
};
async function decodeFlattenImage(fabric, dataUrl, timeoutMs, parentSignal) {
	var _a, _b;
	const controller = new AbortController();
	const abort = () => controller.abort(parentSignal.reason);
	parentSignal.addEventListener("abort", abort, { once: true });
	if (parentSignal.aborted) abort();
	const timeout = setTimeout(() => {
		const cause = /* @__PURE__ */ new Error(`Overlay flatten decode exceeded ${timeoutMs}ms.`);
		cause.name = "TimeoutError";
		controller.abort(new OverlayFlattenError("replacement image decode timed out.", cause));
	}, timeoutMs);
	try {
		return await require_abortable_promise.settleAbortable(fabric.FabricImage.fromURL(dataUrl, {
			crossOrigin: "anonymous",
			signal: controller.signal
		}), controller.signal, (lateImage) => lateImage.dispose());
	} catch (error) {
		if (parentSignal.aborted) throw (_a = parentSignal.reason) !== null && _a !== void 0 ? _a : error;
		if (controller.signal.aborted) throw (_b = controller.signal.reason) !== null && _b !== void 0 ? _b : error;
		throw new OverlayFlattenError("replacement image decode failed.", error);
	} finally {
		clearTimeout(timeout);
		parentSignal.removeEventListener("abort", abort);
	}
}
const OVERLAY_STATE_ID = "foundation:overlay";
const OVERLAY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function freezePersistence(definition) {
	const persistence = definition.persistence;
	const failure = (message) => {
		throw new require_plugin_identifier.PluginManifestError(`Plugin "${definition.ownerPluginId}" Overlay Kind "${definition.id}" ${message}`, { pluginId: definition.ownerPluginId });
	};
	if (!isRecord(persistence)) return failure("must declare persistence.");
	if (persistence.mode === "transient") {
		if (Object.prototype.hasOwnProperty.call(persistence, "codec")) return failure("must not attach a Codec in transient mode.");
		return Object.freeze({ mode: "transient" });
	}
	if (persistence.mode !== "persistent") return failure("must use persistent or transient mode.");
	const codec = persistence.codec;
	if (!isRecord(codec) || typeof codec.type !== "string" || !require_plugin_identifier.isRuntimeIdentifier(codec.type) || typeof codec.version !== "string" || !require_core_capabilities.isValidSemVer(codec.version) || typeof codec.serialize !== "function" || typeof codec.validate !== "function" || typeof codec.deserialize !== "function") return failure("requires a valid Codec with type, SemVer version, serialize, validate, and deserialize.");
	const frozenCodec = Object.freeze({
		type: codec.type,
		version: codec.version,
		serialize: codec.serialize,
		validate: codec.validate,
		deserialize: codec.deserialize
	});
	return Object.freeze({
		mode: "persistent",
		codec: frozenCodec
	});
}
function isSerializedRecord(value) {
	return isRecord(value) && typeof value.kind === "string" && value.kind.trim().length > 0 && typeof value.persistentId === "string" && OVERLAY_ID_PATTERN.test(value.persistentId) && typeof value.hidden === "boolean" && typeof value.locked === "boolean" && isRecord(value.codec) && typeof value.codec.type === "string" && require_plugin_identifier.isRuntimeIdentifier(value.codec.type) && typeof value.codec.version === "string" && require_core_capabilities.isValidSemVer(value.codec.version) && Object.prototype.hasOwnProperty.call(value, "data");
}
function validateStateShape(value) {
	return isRecord(value) && value.version === 1 && Array.isArray(value.overlays) && value.overlays.length <= 1e5 && value.overlays.every(isSerializedRecord) && Array.isArray(value.selectionIds) && value.selectionIds.every((persistentId) => typeof persistentId === "string" && OVERLAY_ID_PATTERN.test(persistentId)) && new Set(value.selectionIds).size === value.selectionIds.length;
}
function getImageExportRegion(image, canvas) {
	image.setCoords();
	const bounds = image.getBoundingRect();
	const measuredCanvasWidth = canvas.getWidth();
	const measuredCanvasHeight = canvas.getHeight();
	const canvasWidth = Number.isFinite(measuredCanvasWidth) && measuredCanvasWidth > 0 ? Math.max(1, Math.round(measuredCanvasWidth)) : 1;
	const canvasHeight = Number.isFinite(measuredCanvasHeight) && measuredCanvasHeight > 0 ? Math.max(1, Math.round(measuredCanvasHeight)) : 1;
	if (!Number.isFinite(bounds.left) || !Number.isFinite(bounds.top) || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height) || bounds.width <= 0 || bounds.height <= 0) return Object.freeze({
		left: 0,
		top: 0,
		width: canvasWidth,
		height: canvasHeight
	});
	const left = Math.min(canvasWidth - 1, Math.max(0, Math.floor(bounds.left)));
	const top = Math.min(canvasHeight - 1, Math.max(0, Math.floor(bounds.top)));
	const right = Math.min(canvasWidth, Math.max(left + 1, Math.ceil(bounds.left + bounds.width)));
	const bottom = Math.min(canvasHeight, Math.max(top + 1, Math.ceil(bounds.top + bounds.height)));
	return Object.freeze({
		left,
		top,
		width: Math.max(1, right - left),
		height: Math.max(1, bottom - top)
	});
}
function captureTransform(object) {
	var _a, _b;
	return Object.freeze({
		left: Number(object.left) || 0,
		top: Number(object.top) || 0,
		scaleX: Number(object.scaleX) || 1,
		scaleY: Number(object.scaleY) || 1,
		angle: Number(object.angle) || 0,
		skewX: Number(object.skewX) || 0,
		skewY: Number(object.skewY) || 0,
		flipX: object.flipX === true,
		flipY: object.flipY === true,
		originX: (_a = object.originX) !== null && _a !== void 0 ? _a : "left",
		originY: (_b = object.originY) !== null && _b !== void 0 ? _b : "top",
		visible: object.visible !== false,
		selectable: object.selectable !== false,
		evented: object.evented !== false
	});
}
function parseExportOptions(value) {
	if (!isRecord(value)) return {};
	const includeKinds = Array.isArray(value.includeKinds) ? value.includeKinds.filter((kind) => typeof kind === "string") : void 0;
	const excludeKinds = Array.isArray(value.excludeKinds) ? value.excludeKinds.filter((kind) => typeof kind === "string") : void 0;
	return Object.freeze({
		...includeKinds ? { includeKinds: Object.freeze(includeKinds) } : {},
		...excludeKinds ? { excludeKinds: Object.freeze(excludeKinds) } : {},
		includeHidden: value.includeHidden === true
	});
}
var OverlayFoundationController = class {
	constructor(host, state, mementos, geometry, mutations, exportPort) {
		Object.defineProperty(this, "host", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: host
		});
		Object.defineProperty(this, "mementos", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: mementos
		});
		Object.defineProperty(this, "geometry", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: geometry
		});
		Object.defineProperty(this, "mutations", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: mutations
		});
		Object.defineProperty(this, "kinds", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Map()
		});
		Object.defineProperty(this, "policies", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Map()
		});
		Object.defineProperty(this, "interactionPolicies", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Map()
		});
		Object.defineProperty(this, "serializers", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Map()
		});
		Object.defineProperty(this, "renderers", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Map()
		});
		Object.defineProperty(this, "byId", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Map()
		});
		Object.defineProperty(this, "byObject", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new WeakMap()
		});
		Object.defineProperty(this, "selectionListeners", {
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
		Object.defineProperty(this, "retainedSelection", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: EMPTY_SELECTION_STATE
		});
		Object.defineProperty(this, "preservedRecords", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: []
		});
		Object.defineProperty(this, "registrationSequence", {
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
		Object.defineProperty(this, "activeGesture", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: null
		});
		Object.defineProperty(this, "gestureCommitTail", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: null
		});
		Object.defineProperty(this, "lastGestureTransaction", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: null
		});
		Object.defineProperty(this, "attached", {
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
		Object.defineProperty(this, "onObjectAdded", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: (event) => {
				if (event.target) this.indexObject(event.target);
			}
		});
		Object.defineProperty(this, "onObjectRemoved", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: (event) => {
				if (event.target) this.unindexObject(event.target);
			}
		});
		Object.defineProperty(this, "onSelectionChanged", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: () => this.emitSelection()
		});
		Object.defineProperty(this, "onBeforeTransform", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: (event) => {
				var _a, _b, _c;
				const target = (_a = event.target) !== null && _a !== void 0 ? _a : (_b = event.transform) === null || _b === void 0 ? void 0 : _b.target;
				if (!target) return;
				this.beginGesture(target, gestureAction((_c = event.transform) === null || _c === void 0 ? void 0 : _c.action));
			}
		});
		Object.defineProperty(this, "onObjectMoving", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: (event) => {
				this.previewGesture(event.target, "move");
			}
		});
		Object.defineProperty(this, "onObjectScaling", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: (event) => {
				this.previewGesture(event.target, "scale");
			}
		});
		Object.defineProperty(this, "onObjectRotating", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: (event) => {
				this.previewGesture(event.target, "rotate");
			}
		});
		Object.defineProperty(this, "onObjectModified", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: (event) => {
				if (!event.target || !this.activeGesture) return;
				const eventIds = new Set(this.resolveOverlayTargets(event.target).map((entry) => entry.persistentId));
				if (eventIds.size > 0 && this.activeGesture.targets.some((entry) => !eventIds.has(entry.persistentId))) {
					this.failGesture(this.activeGesture, new require_core.CoreRuntimeError("[ImageEditor] Overlay gesture target changed before commit."));
					return;
				}
				this.resolveGesture(this.activeGesture);
			}
		});
		Object.defineProperty(this, "onMouseUp", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: () => {
				const gesture = this.activeGesture;
				if (!gesture || gesture.completionSettled) return;
				const reason = abortError("Overlay gesture ended without modifying its target.");
				gesture.quietCancellationReason = reason;
				this.failGesture(gesture, reason);
			}
		});
		try {
			this.registrations.push(state.registerObjectProperties({
				owner: OVERLAY_STATE_ID,
				keys: [
					"editorOverlayKind",
					"editorOverlayId",
					"editorOverlayHidden",
					"editorOverlayLocked"
				]
			}));
			this.registrations.push(state.registerExternalObject(OVERLAY_STATE_ID, (object) => typeof object.editorOverlayKind === "string"));
			this.registrations.push(state.registerSlice({
				id: OVERLAY_STATE_ID,
				version: 1,
				capturePolicy: "always",
				capture: () => this.captureState(),
				validate: (value) => this.validateSnapshotState(value),
				restore: (value) => this.restoreState(value),
				clearState: () => this.resetState()
			}));
			this.registrations.push(geometry.registerParticipant({
				id: OVERLAY_STATE_ID,
				order: 100,
				supports: () => true,
				prepare: (mutation) => this.prepareGeometry(mutation),
				apply: (mutation, prepared, context) => this.applyGeometry(mutation, prepared, context),
				synchronize: (mutation) => this.synchronizeGeometry(mutation),
				rollback: (mutation, prepared) => {
					this.rollbackGeometry(prepared);
				}
			}));
			this.registrations.push(exportPort.register(OVERLAY_STATE_ID, {
				id: OVERLAY_STATE_ID,
				order: 100,
				isEnabled: () => this.byId.size > 0,
				render: (context) => this.renderExport(context.canvas, context.options)
			}));
		} catch (error) {
			require_core_capabilities.disposeInReverseSync(this.registrations, { pluginId: OVERLAY_STATE_ID });
			this.registrations.length = 0;
			throw error;
		}
		if (host.getCanvas()) this.attach();
	}
	attach() {
		this.assertActive("attach Overlay Foundation");
		if (this.attached) return;
		const canvas = this.host.requireCanvas("attach Overlay Foundation");
		if (typeof canvas.on === "function") {
			canvas.on("object:added", this.onObjectAdded);
			canvas.on("object:removed", this.onObjectRemoved);
			canvas.on("before:transform", this.onBeforeTransform);
			canvas.on("object:moving", this.onObjectMoving);
			canvas.on("object:scaling", this.onObjectScaling);
			canvas.on("object:rotating", this.onObjectRotating);
			canvas.on("object:modified", this.onObjectModified);
			canvas.on("mouse:up", this.onMouseUp);
			canvas.on("selection:created", this.onSelectionChanged);
			canvas.on("selection:updated", this.onSelectionChanged);
			canvas.on("selection:cleared", this.onSelectionChanged);
		}
		this.attached = true;
		this.rebuildIndex();
	}
	registerKind(definition) {
		this.assertActive("register an overlay kind");
		if (!isRecord(definition) || typeof definition.classify !== "function" || typeof definition.getPersistentId !== "function" || definition.setPersistentId !== void 0 && typeof definition.setPersistentId !== "function") throw new require_plugin_identifier.PluginManifestError("Overlay Kind registration requires callable classify and persistent identity members.", isRecord(definition) && typeof definition.ownerPluginId === "string" ? { pluginId: definition.ownerPluginId } : {});
		this.assertRuntimeIdentifier(definition.id, "Overlay kind id");
		this.assertRuntimeIdentifier(definition.ownerPluginId, "Overlay kind owner");
		const persistence = freezePersistence(definition);
		const existing = this.kinds.get(definition.id);
		if (existing) throw new require_core.CoreRuntimeError(`[ImageEditor] Overlay kind "${definition.id}" is already registered by "${existing.definition.ownerPluginId}".`);
		const record = {
			definition: Object.freeze({
				...definition,
				persistence
			}),
			registrationOrder: this.registrationSequence++
		};
		this.kinds.set(definition.id, record);
		if (persistence.mode === "persistent") this.serializers.set(definition.id, persistence.codec);
		this.rebuildIndex();
		return require_core_capabilities.createDisposable(() => {
			if (this.kinds.get(definition.id) !== record) return;
			this.kinds.delete(definition.id);
			this.serializers.delete(definition.id);
			const canvas = this.host.getCanvas();
			for (const indexed of [...this.byId.values()]) {
				if (indexed.kind !== record) continue;
				if (persistence.mode === "transient" && canvas) canvas.remove(indexed.object);
				else this.unindexObject(indexed.object);
			}
			this.rebuildIndex();
		});
	}
	registerGeometryPolicy(policy) {
		this.assertActive("register an overlay geometry policy");
		this.assertRuntimeIdentifier(policy.id, "Overlay geometry policy id");
		this.requireKindOwner(policy.kind, policy.ownerPluginId);
		if (this.policies.has(policy.kind)) throw new require_core.CoreRuntimeError(`[ImageEditor] Overlay kind "${policy.kind}" already has a geometry policy.`);
		const frozen = Object.freeze({ ...policy });
		this.policies.set(policy.kind, frozen);
		return require_core_capabilities.createDisposable(() => {
			if (this.policies.get(policy.kind) === frozen) this.policies.delete(policy.kind);
		});
	}
	registerInteractionPolicy(policy) {
		this.assertActive("register an overlay interaction policy");
		this.assertRuntimeIdentifier(policy.id, "Overlay interaction policy id");
		this.requireKindOwner(policy.kind, policy.ownerPluginId);
		if (this.interactionPolicies.has(policy.kind)) throw new require_core.CoreRuntimeError(`[ImageEditor] Overlay kind "${policy.kind}" already has an interaction policy.`);
		const frozen = Object.freeze({ ...policy });
		this.interactionPolicies.set(policy.kind, frozen);
		return require_core_capabilities.createDisposable(() => {
			if (this.interactionPolicies.get(policy.kind) === frozen) this.interactionPolicies.delete(policy.kind);
		});
	}
	registerExportRenderer(renderer) {
		this.assertActive("register an overlay export renderer");
		this.assertRuntimeIdentifier(renderer.id, "Overlay export renderer id");
		this.requireKindOwner(renderer.kind, renderer.ownerPluginId);
		if (!Number.isFinite(renderer.order)) throw new require_core.CoreRuntimeError("[ImageEditor] Overlay export renderer order must be finite.");
		if (this.renderers.has(renderer.kind)) throw new require_core.CoreRuntimeError(`[ImageEditor] Overlay kind "${renderer.kind}" already has an export renderer.`);
		const frozen = Object.freeze({ ...renderer });
		this.renderers.set(renderer.kind, frozen);
		return require_core_capabilities.createDisposable(() => {
			if (this.renderers.get(renderer.kind) === frozen) this.renderers.delete(renderer.kind);
		});
	}
	list(query = {}) {
		this.assertActive("list overlays");
		const kinds = query.kinds ? new Set(query.kinds) : null;
		const ids = query.ids ? new Set(query.ids) : null;
		const canvas = this.host.requireCanvas("list overlays");
		return Object.freeze(canvas.getObjects().filter((object) => {
			const indexed = this.byObject.get(object);
			if (!indexed) return false;
			const classification = this.classificationFor(indexed);
			return (!kinds || kinds.has(classification.kind)) && (!ids || ids.has(classification.persistentId)) && (query.includeHidden === true || !classification.hidden) && (query.includeLocked === true || !classification.locked);
		}));
	}
	getByPersistentId(id) {
		var _a, _b;
		this.assertActive("get an overlay");
		return (_b = (_a = this.byId.get(id)) === null || _a === void 0 ? void 0 : _a.object) !== null && _b !== void 0 ? _b : null;
	}
	classify(object) {
		this.assertActive("classify an overlay");
		const indexed = this.byObject.get(object);
		return indexed ? this.classificationFor(indexed) : null;
	}
	getStateKind(kind) {
		var _a, _b;
		return (_b = (_a = this.kinds.get(kind)) === null || _a === void 0 ? void 0 : _a.definition) !== null && _b !== void 0 ? _b : null;
	}
	getSelection() {
		var _a, _b;
		this.assertActive("read overlay selection");
		const canvas = this.host.requireCanvas("read overlay selection");
		const classifications = getActiveCanvasObjects(canvas).map((object) => this.byObject.get(object)).filter((entry) => entry !== void 0).map((entry) => this.classificationFor(entry));
		if (classifications.length === 0 && canvas.getObjects().some((object) => isSessionCanvasObject(object))) return this.retainedSelection;
		this.retainedSelection = Object.freeze({
			ids: Object.freeze(classifications.map((entry) => entry.persistentId)),
			primaryId: (_b = (_a = classifications[0]) === null || _a === void 0 ? void 0 : _a.persistentId) !== null && _b !== void 0 ? _b : null,
			kinds: Object.freeze([...new Set(classifications.map((entry) => entry.kind))])
		});
		return this.retainedSelection;
	}
	select(ids) {
		this.assertActive("select overlays");
		this.applySelection(ids);
	}
	applySelection(ids) {
		var _a, _b;
		const canvas = this.host.getCanvas();
		if (!canvas) throw new require_core.CoreRuntimeError("[ImageEditor] Overlay selection requires Canvas.");
		const objects = ids.map((id) => this.requireIndexed(id).object);
		const classifications = objects.map((object) => this.classificationFor(this.byObject.get(object)));
		this.retainedSelection = Object.freeze({
			ids: Object.freeze(classifications.map((entry) => entry.persistentId)),
			primaryId: (_b = (_a = classifications[0]) === null || _a === void 0 ? void 0 : _a.persistentId) !== null && _b !== void 0 ? _b : null,
			kinds: Object.freeze([...new Set(classifications.map((entry) => entry.kind))])
		});
		if (objects.length === 0) canvas.discardActiveObject();
		else if (objects.length === 1) canvas.setActiveObject(objects[0]);
		else canvas.setActiveObject(new this.host.fabric.ActiveSelection(objects, { canvas }));
		this.host.requestRender();
		this.emitSelection();
	}
	discardSelection() {
		this.assertActive("discard overlay selection");
		this.retainedSelection = EMPTY_SELECTION_STATE;
		this.host.requireCanvas("discard overlay selection").discardActiveObject();
		this.host.requestRender();
		this.emitSelection();
	}
	onSelectionChange(listener) {
		this.assertActive("subscribe to overlay selection");
		this.selectionListeners.add(listener);
		return require_core_capabilities.createDisposable(() => {
			this.selectionListeners.delete(listener);
		});
	}
	hideForPreview(ids) {
		this.assertActive("hide overlays");
		const targets = this.resolveOverlayIds(ids);
		for (const target of targets) {
			const existing = target.preview;
			if (existing) {
				existing[2] += 1;
				continue;
			}
			target.preview = [
				target.object.visible !== false,
				this.classificationFor(target).hidden,
				1
			];
			target.object.visible = false;
		}
		if (targets.length) this.host.requestRender();
		return require_core_capabilities.createDisposable(() => {
			let restored = false;
			for (const target of targets) {
				const record = target.preview;
				if (!record) continue;
				if (--record[2]) continue;
				delete target.preview;
				target.object.visible = record[0];
				restored = true;
			}
			if (restored && !this.disposed) this.host.requestRender();
		});
	}
	setHidden(id, hidden) {
		return this.mutate({
			id: this.nextMutationId("visibility"),
			operationId: "overlay:set-hidden",
			action: "visibility",
			objectIds: [id],
			metadata: Object.freeze({ hidden }),
			mutate: () => this.applyHidden(id, hidden)
		});
	}
	setLocked(id, locked) {
		return this.mutate({
			id: this.nextMutationId("locking"),
			operationId: "overlay:set-locked",
			action: "locking",
			objectIds: [id],
			metadata: Object.freeze({ locked }),
			mutate: () => this.applyLocked(id, locked)
		});
	}
	bringForward(id) {
		return this.mutateLayer(id, "forward", () => this.moveRelative(id, 1));
	}
	sendBackward(id) {
		return this.mutateLayer(id, "backward", () => this.moveRelative(id, -1));
	}
	bringToFront(id) {
		return this.mutateLayer(id, "front", () => {
			const overlays = this.indexedCanvasObjects();
			this.moveToOverlayIndex(id, overlays.length - 1, overlays);
		});
	}
	sendToBack(id) {
		return this.mutateLayer(id, "back", () => this.moveToOverlayIndex(id, 0, this.indexedCanvasObjects()));
	}
	async mutate(request) {
		var _a;
		this.assertActive("run an overlay mutation");
		this.assertOpaqueIdentifier(request.id, "Overlay mutation id");
		this.assertRuntimeIdentifier(request.operationId, "Overlay mutation operation id");
		this.assertOpaqueIdentifier(request.action, "Overlay mutation action");
		const initialTargets = this.resolveOverlayIds((_a = request.objectIds) !== null && _a !== void 0 ? _a : []);
		let affectedTargets = initialTargets;
		let descriptor = null;
		return this.mutations.run({
			id: request.id,
			kind: "overlay",
			operationId: request.operationId,
			conflictDomains: require_internal_operation_conflict_domains.PERSISTENT_OVERLAY_MUTATION_CONFLICT_DOMAINS,
			...request.parent ? { parent: request.parent } : {},
			...request.metadata ? { metadata: request.metadata } : {},
			mutate: async (transaction) => {
				const context = this.createMutationContext(transaction, request.action, initialTargets);
				return request.mutate(context);
			},
			synchronize: async (result, transaction) => {
				var _a;
				this.rebuildIndex();
				const context = this.createMutationContext(transaction, request.action, initialTargets);
				const additional = request.affectedObjects ? await request.affectedObjects(result, context) : [];
				affectedTargets = this.mergeTargets(initialTargets, this.resolveOverlayObjects(additional));
				descriptor = this.createMutationDescriptor(request.id, request.operationId, request.action, affectedTargets, transaction.metadata);
				await this.runInteractionPolicies(affectedTargets, descriptor, transaction, "synchronize");
				await ((_a = request.synchronize) === null || _a === void 0 ? void 0 : _a.call(request, result, context));
			},
			validate: async (result, transaction) => {
				var _a;
				const currentDescriptor = descriptor;
				if (!currentDescriptor) throw new require_core.CoreRuntimeError("[ImageEditor] Overlay mutation synchronization did not produce a descriptor.");
				await this.validateMutation(affectedTargets, currentDescriptor, transaction);
				await ((_a = request.validate) === null || _a === void 0 ? void 0 : _a.call(request, result, this.createMutationContext(transaction, request.action, affectedTargets)));
			},
			describeCommit: () => {
				if (!descriptor) throw new require_core.CoreRuntimeError("[ImageEditor] Overlay mutation descriptor is unavailable at commit.");
				return descriptor;
			}
		});
	}
	add(objects) {
		if (objects.length === 0) return Promise.resolve();
		const uniqueObjects = Object.freeze([...new Set(objects)]);
		return this.mutate({
			id: this.nextMutationId("create"),
			operationId: "overlay:add",
			action: "create",
			metadata: Object.freeze({ objectCount: uniqueObjects.length }),
			mutate: () => {
				const canvas = this.host.requireCanvas("add overlays");
				for (const object of uniqueObjects) canvas.add(object);
			},
			affectedObjects: () => {
				const indexed = this.resolveOverlayObjects(uniqueObjects);
				if (indexed.length !== uniqueObjects.length || indexed.some((entry) => entry.kind.definition.persistence.mode !== "persistent")) throw new require_core.CoreRuntimeError("[ImageEditor] Overlay insertion accepts only registered persistent kinds.");
				return uniqueObjects;
			}
		});
	}
	addTransient(objects) {
		if (objects.length === 0) return Promise.resolve();
		const uniqueObjects = Object.freeze([...new Set(objects)]);
		return this.host.runOperation("overlay:transient", async () => {
			const canvas = this.host.requireCanvas("add transient overlays");
			try {
				for (const object of uniqueObjects) canvas.add(object);
				this.rebuildIndex();
				const indexed = this.resolveOverlayObjects(uniqueObjects);
				if (indexed.length !== uniqueObjects.length || indexed.some((entry) => entry.kind.definition.persistence.mode !== "transient")) throw new require_core.CoreRuntimeError("[ImageEditor] Transient overlay insertion accepts only registered transient kinds.");
				this.host.requestRender();
			} catch (error) {
				for (const object of uniqueObjects) canvas.remove(object);
				this.rebuildIndex();
				throw error;
			}
		});
	}
	replaceTransient(ids, objects) {
		const uniqueIds = Object.freeze([...new Set(ids)]);
		const uniqueObjects = Object.freeze([...new Set(objects)]);
		if (uniqueIds.length === 0) return this.addTransient(uniqueObjects);
		if (uniqueObjects.length === 0) return this.removeTransient(uniqueIds);
		return this.host.runOperation("overlay:transient", async () => {
			const canvas = this.host.requireCanvas("replace transient overlays");
			const removed = uniqueIds.map((id) => this.requireIndexed(id));
			if (removed.some((entry) => entry.kind.definition.persistence.mode !== "transient")) throw new require_core.CoreRuntimeError("[ImageEditor] Transient overlay replacement accepts only transient kinds.");
			try {
				for (const entry of removed) canvas.remove(entry.object);
				for (const object of uniqueObjects) canvas.add(object);
				this.rebuildIndex();
				const inserted = this.resolveOverlayObjects(uniqueObjects);
				if (inserted.length !== uniqueObjects.length || inserted.some((entry) => entry.kind.definition.persistence.mode !== "transient")) throw new require_core.CoreRuntimeError("[ImageEditor] Transient overlay replacement produced an invalid kind.");
				this.host.requestRender();
			} catch (error) {
				for (const object of uniqueObjects) canvas.remove(object);
				for (const entry of removed) if (!canvas.getObjects().includes(entry.object)) canvas.add(entry.object);
				this.rebuildIndex();
				throw error;
			}
		});
	}
	remove(ids) {
		if (ids.length === 0) return Promise.resolve();
		const uniqueIds = Object.freeze([...new Set(ids)]);
		return this.mutate({
			id: this.nextMutationId("delete"),
			operationId: "overlay:remove",
			action: "delete",
			objectIds: uniqueIds,
			metadata: Object.freeze({ objectCount: uniqueIds.length }),
			mutate: () => {
				const canvas = this.host.requireCanvas("remove overlays");
				const objects = uniqueIds.map((id) => this.requireIndexed(id).object);
				if (getActiveCanvasObjects(canvas).some((object) => objects.includes(object))) canvas.discardActiveObject();
				for (const object of objects) canvas.remove(object);
			}
		});
	}
	removeTransient(ids) {
		if (ids.length === 0) return Promise.resolve();
		const uniqueIds = Object.freeze([...new Set(ids)]);
		return this.host.runOperation("overlay:transient", async () => {
			const entries = uniqueIds.map((id) => this.requireIndexed(id));
			if (entries.some((entry) => entry.kind.definition.persistence.mode !== "transient")) throw new require_core.CoreRuntimeError("[ImageEditor] Transient overlay removal accepts only transient kinds.");
			const canvas = this.host.requireCanvas("remove transient overlays");
			if (getActiveCanvasObjects(canvas).some((object) => entries.some((entry) => entry.object === object))) canvas.discardActiveObject();
			for (const entry of entries) canvas.remove(entry.object);
			this.rebuildIndex();
			this.host.requestRender();
		});
	}
	async cancelActiveGesture(reason = abortError("Overlay gesture was cancelled.")) {
		const gesture = this.activeGesture;
		if (!(gesture === null || gesture === void 0 ? void 0 : gesture.transaction)) return;
		this.failGesture(gesture, reason);
		try {
			await gesture.transaction;
		} catch (error) {
			if (!isAbortError(error) && error !== reason) throw error;
		}
	}
	waitForIdle() {
		var _a, _b, _c;
		return (_c = (_b = (_a = this.activeGesture) === null || _a === void 0 ? void 0 : _a.transaction) !== null && _b !== void 0 ? _b : this.lastGestureTransaction) !== null && _c !== void 0 ? _c : Promise.resolve();
	}
	async flatten(query = {}, options = {}) {
		this.assertActive("flatten overlays");
		const selected = this.list({
			...query,
			includeHidden: query.includeHidden === true,
			includeLocked: true
		});
		if (selected.length === 0) return;
		this.assertFlattenBudget();
		await this.geometry.run({
			id: `overlay:flatten:${Date.now()}:${++this.generatedIdSequence}`,
			kind: "flatten",
			operationId: "overlay:flatten",
			metadata: Object.freeze({ overlayCount: selected.length }),
			mutateBase: async ({ signal, transaction }) => {
				var _a, _b;
				const canvas = this.host.requireCanvas("flatten overlays");
				const baseImage = this.host.getBaseImage();
				if (!baseImage) throw new require_core.CoreRuntimeError("[ImageEditor] Cannot flatten without a base image.");
				this.assertFlattenBudget(canvas, baseImage);
				const exportElement = canvas.lowerCanvasEl.ownerDocument.createElement("canvas");
				const exportCanvas = new this.host.fabric.StaticCanvas(exportElement, {
					width: canvas.getWidth(),
					height: canvas.getHeight(),
					backgroundColor: this.host.backgroundColor,
					renderOnAddRemove: false
				});
				try {
					const format = (_a = options.format) !== null && _a !== void 0 ? _a : "png";
					const quality = Math.max(0, Math.min(1, (_b = options.quality) !== null && _b !== void 0 ? _b : .92));
					const exportOptions = Object.freeze({
						area: "image",
						format,
						quality,
						multiplier: 1
					});
					const baseClone = await baseImage.clone();
					exportCanvas.add(baseClone);
					exportCanvas.sendObjectToBack(baseClone);
					await this.renderObjects(exportCanvas, selected, exportOptions);
					exportCanvas.renderAll();
					const dataUrl = exportCanvas.toDataURL({
						format,
						quality,
						multiplier: 1,
						...getImageExportRegion(baseImage, canvas)
					});
					let replacement = null;
					let replacementTransferred = false;
					try {
						replacement = await decodeFlattenImage(this.host.fabric, dataUrl, this.host.getImageResourcePolicy().imageLoadTimeoutMs, signal);
						replacement.set({
							left: 0,
							top: 0,
							originX: "left",
							originY: "top",
							scaleX: 1,
							scaleY: 1,
							selectable: false,
							evented: false
						});
						replacement.setCoords();
						this.host.replaceBaseImage(transaction, replacement, {
							baseScale: 1,
							mimeType: format === "jpeg" ? "image/jpeg" : `image/${format}`
						});
						replacementTransferred = true;
						for (const object of selected) canvas.remove(object);
					} catch (error) {
						if (replacement && !replacementTransferred) try {
							replacement.dispose();
						} catch (cleanupError) {
							throw new OverlayFlattenError("rejected replacement cleanup failed.", Object.freeze([error, cleanupError]));
						}
						throw error;
					}
				} finally {
					await exportCanvas.dispose();
				}
			}
		});
	}
	assertFlattenBudget(canvas = this.host.requireCanvas("validate flatten dimensions"), baseImage = this.host.getBaseImage()) {
		if (!baseImage) throw new require_core.CoreRuntimeError("[ImageEditor] Cannot flatten without a base image.");
		const policy = this.host.getImageResourcePolicy();
		const budget = {
			maxDimension: policy.maxExportDimension,
			maxPixels: policy.maxExportPixels
		};
		const region = getImageExportRegion(baseImage, canvas);
		if (!require_image_budget.isRasterAllocationWithinBudget(canvas.getWidth(), canvas.getHeight(), budget) || !require_image_budget.isRasterAllocationWithinBudget(region.width, region.height, budget)) throw new require_core.CoreRuntimeError("[ImageEditor] Flatten dimensions exceed the configured budget.");
	}
	dispose() {
		if (this.disposed) return;
		if (this.activeGesture) this.failGesture(this.activeGesture, abortError("Overlay Foundation was disposed during an active gesture."));
		const canvas = this.host.getCanvas();
		if (canvas) {
			for (const indexed of [...this.byId.values()]) if (indexed.kind.definition.persistence.mode === "transient") canvas.remove(indexed.object);
		}
		if (canvas && typeof canvas.off === "function") {
			canvas.off("object:added", this.onObjectAdded);
			canvas.off("object:removed", this.onObjectRemoved);
			canvas.off("before:transform", this.onBeforeTransform);
			canvas.off("object:moving", this.onObjectMoving);
			canvas.off("object:scaling", this.onObjectScaling);
			canvas.off("object:rotating", this.onObjectRotating);
			canvas.off("object:modified", this.onObjectModified);
			canvas.off("mouse:up", this.onMouseUp);
			canvas.off("selection:created", this.onSelectionChanged);
			canvas.off("selection:updated", this.onSelectionChanged);
			canvas.off("selection:cleared", this.onSelectionChanged);
		}
		const registrationErrors = require_core_capabilities.disposeInReverseSync(this.registrations, { pluginId: OVERLAY_STATE_ID });
		this.registrations.length = 0;
		this.selectionListeners.clear();
		this.setPreviewObjectsHidden(false);
		this.byId.clear();
		this.kinds.clear();
		this.policies.clear();
		this.interactionPolicies.clear();
		this.serializers.clear();
		this.renderers.clear();
		this.preservedRecords = [];
		this.attached = false;
		this.disposed = true;
		if (registrationErrors.length > 0) throw new require_core.CoreRuntimeError(`[ImageEditor] Overlay Foundation disposal had ${registrationErrors.length} registration cleanup error(s).`);
	}
	captureState() {
		var _a;
		this.setPreviewObjectsHidden(false);
		try {
			const canvas = this.host.getCanvas();
			for (const object of (_a = canvas === null || canvas === void 0 ? void 0 : canvas.getObjects()) !== null && _a !== void 0 ? _a : []) {
				const marked = object;
				if (typeof marked.editorOverlayKind === "string" && !this.byObject.has(object)) throw new require_core.CoreRuntimeError(`[ImageEditor] Persistent overlay kind "${marked.editorOverlayKind}" is not registered.`);
			}
			const overlays = [];
			for (const object of this.indexedCanvasObjects()) {
				const indexed = this.byObject.get(object);
				if (indexed.kind.definition.persistence.mode === "transient") continue;
				const serializer = this.serializers.get(indexed.kind.definition.id);
				if (!serializer) throw new require_core.CoreRuntimeError(`[ImageEditor] Overlay kind "${indexed.kind.definition.id}" has no serializer.`);
				const classification = this.classificationFor(indexed);
				overlays.push(Object.freeze({
					kind: classification.kind,
					persistentId: classification.persistentId,
					hidden: classification.hidden,
					locked: classification.locked,
					codec: Object.freeze({
						type: serializer.type,
						version: serializer.version
					}),
					data: serializer.serialize(object)
				}));
			}
			overlays.push(...this.preservedRecords);
			return Object.freeze({
				version: 1,
				overlays: Object.freeze(overlays),
				selectionIds: this.getSelection().ids
			});
		} finally {
			this.setPreviewObjectsHidden(true);
		}
	}
	validateSnapshotState(value) {
		if (!validateStateShape(value)) return {
			valid: false,
			message: "Overlay Foundation state is malformed."
		};
		const persistentIds = value.overlays.map((record) => record.persistentId);
		if (new Set(persistentIds).size !== persistentIds.length) return {
			valid: false,
			message: "Overlay Foundation state is malformed: duplicate persistent ID detected."
		};
		for (const record of value.overlays) {
			const kind = this.kinds.get(record.kind);
			const serializer = this.serializers.get(record.kind);
			if (!kind || !serializer) return {
				valid: false,
				message: `Overlay kind "${record.kind}" has no installed Object Codec.`
			};
			if (kind.definition.persistence.mode !== "persistent" || record.codec.type !== serializer.type || record.codec.version !== serializer.version) return {
				valid: false,
				message: `Overlay kind "${record.kind}" Object Codec identity is incompatible.`
			};
			if (!serializer.validate(record.data)) return {
				valid: false,
				message: `Overlay "${record.persistentId}" failed Object Codec validation.`
			};
		}
		return {
			valid: true,
			value
		};
	}
	async restoreState(value) {
		var _a, _b;
		const canvas = this.host.getCanvas();
		if (!canvas) throw new require_core.CoreRuntimeError("[ImageEditor] Overlay state restore requires Canvas.");
		canvas.discardActiveObject();
		for (const indexed of [...this.byId.values()]) canvas.remove(indexed.object);
		this.byId.clear();
		this.preservedRecords = [];
		for (const record of value.overlays) {
			const serializer = this.serializers.get(record.kind);
			const kind = this.kinds.get(record.kind);
			if (!serializer || !kind || kind.definition.persistence.mode !== "persistent" || record.codec.type !== serializer.type || record.codec.version !== serializer.version) {
				this.preservedRecords.push(record);
				continue;
			}
			if (!serializer.validate(record.data)) throw new require_core.CoreRuntimeError(`[ImageEditor] Serialized overlay "${record.persistentId}" is invalid.`);
			const object = await serializer.deserialize(record.data, { fabric: this.host.fabric });
			const marked = object;
			marked.editorOverlayKind = record.kind;
			marked.editorOverlayId = record.persistentId;
			marked.editorOverlayHidden = record.hidden;
			marked.editorOverlayLocked = record.locked;
			(_b = (_a = kind.definition).setPersistentId) === null || _b === void 0 || _b.call(_a, object, record.persistentId);
			canvas.add(object);
			this.applyHidden(record.persistentId, record.hidden);
			this.applyLocked(record.persistentId, record.locked);
		}
		this.rebuildIndex();
		const restoredSelection = value.selectionIds.filter((persistentId) => this.byId.has(persistentId));
		if (restoredSelection.length > 0) this.applySelection(restoredSelection);
		this.host.requestRender();
	}
	resetState() {
		const canvas = this.host.getCanvas();
		if (canvas) {
			canvas.discardActiveObject();
			for (const indexed of [...this.byId.values()]) canvas.remove(indexed.object);
		}
		this.byId.clear();
		this.preservedRecords = [];
	}
	beginGesture(target, action) {
		if (this.disposed) return;
		const targets = this.resolveOverlayTargets(target);
		if (targets.length === 0) return;
		let supersededTransaction = null;
		let supersessionReason = null;
		if (this.activeGesture) {
			const currentTargets = this.activeGesture.targets;
			if (currentTargets.length === targets.length && currentTargets.every((entry, index) => {
				var _a;
				return entry.persistentId === ((_a = targets[index]) === null || _a === void 0 ? void 0 : _a.persistentId);
			})) return;
			supersededTransaction = this.activeGesture.transaction;
			supersessionReason = abortError("Overlay gesture was superseded by another target.");
			this.failGesture(this.activeGesture, supersessionReason);
		}
		let resolveCompletion;
		let rejectCompletion;
		const completion = new Promise((resolve, reject) => {
			resolveCompletion = resolve;
			rejectCompletion = reject;
		});
		const id = this.nextMutationId("gesture");
		const objectIds = Object.freeze(targets.map((entry) => entry.persistentId));
		const metadata = Object.freeze({
			interactive: true,
			objectIds
		});
		const previewController = new AbortController();
		let before;
		try {
			before = this.mementos.captureMemento();
		} catch (error) {
			this.host.reportError(error, "Overlay gesture boundary capture failed.");
			return;
		}
		const boundary = {
			before,
			after: null
		};
		const gesture = {
			id,
			action,
			targets,
			rollbackTargets: this.captureGestureTargets(targets),
			sealedTargets: null,
			selectionIds: Object.freeze([...this.getSelection().ids]),
			completion,
			resolve: resolveCompletion,
			reject: rejectCompletion,
			boundary,
			previewController,
			completionSettled: false,
			quietCancellationReason: null,
			previewWork: Promise.resolve(),
			transaction: null,
			context: Object.freeze({
				transactionId: id,
				parentTransactionId: null,
				operationId: "overlay:gesture",
				conflictDomains: require_internal_operation_conflict_domains.PERSISTENT_OVERLAY_MUTATION_CONFLICT_DOMAINS,
				historyOwner: "self",
				eventOwner: "self",
				signal: previewController.signal,
				participantIds: Object.freeze([]),
				metadata
			})
		};
		this.activeGesture = gesture;
		const request = withInteractiveMutationBoundary({
			id,
			kind: "overlay",
			operationId: "overlay:gesture",
			conflictDomains: require_internal_operation_conflict_domains.PERSISTENT_OVERLAY_MUTATION_CONFLICT_DOMAINS,
			metadata,
			mutate: async (context) => {
				gesture.context = context;
				await this.waitForGestureCompletion(gesture, context.signal);
				await gesture.previewWork;
				return this.createMutationDescriptor(id, "overlay:gesture", gesture.action, gesture.targets, context.metadata);
			},
			rollback: (context) => this.rollbackGesture(gesture, context),
			synchronize: (descriptor, context) => this.runInteractionPolicies(gesture.targets, descriptor, context, "synchronize"),
			validate: (descriptor, context) => this.validateMutation(gesture.targets, descriptor, context),
			describeCommit: (descriptor) => descriptor
		}, boundary);
		let commitStarted = false;
		const commit = async () => {
			commitStarted = true;
			if (supersededTransaction) await this.rebaseSupersedingGesture(gesture);
			await this.mutations.run(request);
		};
		const previousCommit = this.gestureCommitTail;
		const predecessor = previousCommit && previousCommit === supersededTransaction ? previousCommit.catch((error) => {
			if (error !== supersessionReason) throw error;
		}) : previousCommit;
		const transaction = (predecessor ? predecessor.then(commit) : commit()).catch((error) => {
			if (error === gesture.quietCancellationReason) return;
			throw error;
		});
		gesture.transaction = transaction;
		this.gestureCommitTail = transaction;
		this.lastGestureTransaction = transaction;
		transaction.then(() => {
			this.clearGesture(gesture);
			if (this.gestureCommitTail === transaction) this.gestureCommitTail = null;
		}, () => {
			this.clearGesture(gesture);
			if (this.gestureCommitTail === transaction) this.gestureCommitTail = null;
		});
		transaction.catch((error) => {
			if (commitStarted && !isAbortError(error)) this.host.reportError(error, "Overlay gesture transaction failed.");
		});
	}
	previewGesture(target, action) {
		const gesture = this.activeGesture;
		if (!target || !gesture || gesture.completionSettled) return;
		const previewIds = new Set(this.resolveOverlayTargets(target).map((entry) => entry.persistentId));
		if (gesture.targets.some((entry) => !previewIds.has(entry.persistentId))) {
			this.failGesture(gesture, new require_core.CoreRuntimeError("[ImageEditor] Overlay preview target changed mid-gesture."));
			return;
		}
		gesture.action = action;
		const descriptor = this.createMutationDescriptor(gesture.id, "overlay:gesture", action, gesture.targets, gesture.context.metadata);
		gesture.previewWork = gesture.previewWork.then(() => this.runInteractionPolicies(gesture.targets, descriptor, gesture.context, "preview")).catch((error) => {
			this.failGesture(gesture, error);
		});
	}
	resolveGesture(gesture) {
		if (gesture.completionSettled) return;
		try {
			gesture.sealedTargets = this.captureGestureTargets(gesture.targets);
			gesture.boundary.after = this.mementos.captureMemento();
		} catch (error) {
			this.failGesture(gesture, error);
			return;
		}
		gesture.completionSettled = true;
		gesture.resolve();
		this.clearGesture(gesture);
	}
	failGesture(gesture, error) {
		if (gesture.completionSettled) return;
		gesture.completionSettled = true;
		gesture.previewController.abort(error);
		gesture.reject(error);
		this.clearGesture(gesture);
	}
	captureGestureTargets(targets) {
		return Object.freeze(targets.map((entry) => Object.freeze({
			object: entry.object,
			persistentId: entry.persistentId,
			kind: entry.kind.definition.id,
			transform: captureTransform(entry.object)
		})));
	}
	async rebaseSupersedingGesture(gesture) {
		this.rebuildIndex();
		gesture.targets = this.resolveOverlayIds(gesture.targets.map((entry) => entry.persistentId));
		const liveSelection = gesture.selectionIds.filter((persistentId) => this.byId.has(persistentId));
		this.applySelection(liveSelection);
		gesture.boundary.before = this.mementos.captureMemento();
		gesture.rollbackTargets = this.captureGestureTargets(gesture.targets);
		if (!gesture.completionSettled || !gesture.sealedTargets) return;
		const sealedById = new Map(gesture.sealedTargets.map((entry) => [entry.persistentId, entry.transform]));
		for (const target of gesture.targets) {
			const transform = sealedById.get(target.persistentId);
			if (!transform) throw new require_core.CoreRuntimeError(`[ImageEditor] Superseding Overlay gesture lost target "${target.persistentId}".`);
			target.object.set(transform);
			target.object.setCoords();
		}
		const descriptor = this.createMutationDescriptor(gesture.id, "overlay:gesture", gesture.action, gesture.targets, gesture.context.metadata);
		await this.runInteractionPolicies(gesture.targets, descriptor, gesture.context, "preview");
		this.host.requestRender();
		gesture.boundary.after = this.mementos.captureMemento();
	}
	async rollbackGesture(gesture, context) {
		await gesture.previewWork;
		if (this.disposed) return;
		const canvas = this.host.getCanvas();
		if (!canvas) return;
		for (let index = gesture.rollbackTargets.length - 1; index >= 0; index -= 1) {
			const entry = gesture.rollbackTargets[index];
			if (!canvas.getObjects().includes(entry.object)) canvas.add(entry.object);
			entry.object.set(entry.transform);
			entry.object.setCoords();
		}
		this.rebuildIndex();
		const selectionIds = gesture.selectionIds.filter((persistentId) => this.byId.has(persistentId));
		this.applySelection(selectionIds);
		const descriptor = this.createMutationDescriptor(gesture.id, "overlay:gesture", gesture.action, gesture.targets, context.metadata);
		await this.runInteractionPolicies(gesture.targets, descriptor, context, "preview");
	}
	clearGesture(gesture) {
		if (this.activeGesture === gesture) this.activeGesture = null;
	}
	async waitForGestureCompletion(gesture, signal) {
		var _a;
		if (signal.aborted) throw (_a = signal.reason) !== null && _a !== void 0 ? _a : abortError("Overlay gesture was aborted.");
		let abort;
		const aborted = new Promise((resolve, reject) => {
			abort = () => {
				var _a;
				return reject((_a = signal.reason) !== null && _a !== void 0 ? _a : abortError("Overlay gesture was aborted."));
			};
			signal.addEventListener("abort", abort, { once: true });
		});
		try {
			await Promise.race([gesture.completion, aborted]);
		} finally {
			signal.removeEventListener("abort", abort);
		}
	}
	createMutationContext(transaction, action, targets) {
		return Object.freeze({
			transaction,
			action,
			objectIds: Object.freeze(targets.map((entry) => entry.persistentId))
		});
	}
	createMutationDescriptor(id, operationId, action, targets, metadata) {
		return Object.freeze({
			id,
			operationId,
			action,
			objectIds: Object.freeze(targets.map((entry) => entry.persistentId)),
			objectKinds: Object.freeze(targets.map((entry) => entry.kind.definition.id)),
			metadata
		});
	}
	async runInteractionPolicies(targets, descriptor, transaction, phase) {
		var _a, _b, _c;
		for (const target of targets) {
			const policy = this.interactionPolicies.get(target.kind.definition.id);
			if (!policy) continue;
			const context = Object.freeze({
				...this.createMutationContext(transaction, descriptor.action, targets),
				descriptor,
				phase
			});
			try {
				if (phase === "preview") await ((_a = policy.preview) === null || _a === void 0 ? void 0 : _a.call(policy, target.object, context));
				else if (phase === "synchronize") await ((_b = policy.synchronize) === null || _b === void 0 ? void 0 : _b.call(policy, target.object, context));
				else await ((_c = policy.validate) === null || _c === void 0 ? void 0 : _c.call(policy, target.object, context));
			} catch (error) {
				if (error instanceof OverlayRecoverableObjectError) {
					this.host.reportWarning(error, `A recoverable overlay ${phase} failure was isolated for "${target.persistentId}".`);
					continue;
				}
				throw error;
			}
		}
	}
	async validateMutation(targets, descriptor, transaction) {
		var _a;
		this.rebuildIndex();
		const canvas = this.host.requireCanvas("validate an overlay mutation");
		const liveObjects = new Set(canvas.getObjects());
		if (new Set(descriptor.objectIds).size !== descriptor.objectIds.length) throw new require_core.CoreRuntimeError("[ImageEditor] Overlay mutation contains duplicate ids.");
		for (const target of targets) {
			if (target.kind.definition.getPersistentId(target.object) !== target.persistentId) throw new require_core.CoreRuntimeError(`[ImageEditor] Overlay "${target.persistentId}" changed persistent identity.`);
			if (descriptor.action !== "delete" && (!liveObjects.has(target.object) || ((_a = this.byId.get(target.persistentId)) === null || _a === void 0 ? void 0 : _a.object) !== target.object)) throw new require_core.CoreRuntimeError(`[ImageEditor] Overlay "${target.persistentId}" is missing from the committed index.`);
		}
		if (this.getSelection().ids.some((id) => !this.byId.has(id))) {
			canvas.discardActiveObject();
			this.emitSelection();
		}
		await this.runInteractionPolicies(targets, descriptor, transaction, "validate");
	}
	resolveOverlayTargets(target) {
		const direct = this.byObject.get(target);
		if (direct) return Object.freeze([direct]);
		const grouped = target;
		if (typeof grouped.getObjects !== "function") return Object.freeze([]);
		return this.resolveOverlayObjects(grouped.getObjects());
	}
	resolveOverlayObjects(objects) {
		const targets = [];
		const ids = /* @__PURE__ */ new Set();
		for (const object of objects) {
			const indexed = this.byObject.get(object);
			if (!indexed || ids.has(indexed.persistentId)) continue;
			ids.add(indexed.persistentId);
			targets.push(indexed);
		}
		return Object.freeze(targets);
	}
	resolveOverlayIds(ids) {
		return Object.freeze([...new Set(ids)].map((id) => this.requireIndexed(id)));
	}
	mergeTargets(first, second) {
		const merged = /* @__PURE__ */ new Map();
		for (const target of [...first, ...second]) merged.set(target.persistentId, target);
		return Object.freeze([...merged.values()]);
	}
	applyHidden(id, hidden) {
		const indexed = this.requireIndexed(id);
		const object = indexed.object;
		const preview = indexed.preview;
		const marked = object;
		marked.editorOverlayHidden = hidden;
		if (indexed.kind.definition.setHidden) indexed.kind.definition.setHidden(object, hidden);
		else object.set({ visible: !hidden });
		if (preview) {
			preview[0] = !hidden;
			preview[1] = hidden;
			object.visible = false;
		}
		if (hidden && getActiveCanvasObjects(this.host.requireCanvas("hide an overlay")).includes(object)) this.discardSelection();
	}
	applyLocked(id, locked) {
		const indexed = this.requireIndexed(id);
		const marked = indexed.object;
		marked.editorOverlayLocked = locked;
		if (indexed.kind.definition.setLocked) indexed.kind.definition.setLocked(indexed.object, locked);
		else indexed.object.set({
			selectable: !locked,
			evented: !locked
		});
		if (locked && getActiveCanvasObjects(this.host.requireCanvas("lock an overlay")).includes(indexed.object)) this.discardSelection();
	}
	mutateLayer(id, direction, mutate) {
		return this.mutate({
			id: this.nextMutationId("layer"),
			operationId: "overlay:layer",
			action: "layer",
			objectIds: [id],
			metadata: Object.freeze({ direction }),
			mutate
		});
	}
	nextMutationId(action) {
		return `overlay:${action}:${Date.now()}:${++this.generatedIdSequence}`;
	}
	async prepareGeometry(mutation) {
		var _a;
		const canvas = this.host.requireCanvas("prepare overlay geometry");
		for (const policy of this.policies.values()) if (!policy.supports || policy.supports(mutation)) await ((_a = policy.prepare) === null || _a === void 0 ? void 0 : _a.call(policy, mutation));
		const selectionIds = this.getSelection().ids;
		canvas.discardActiveObject();
		const entries = this.indexedCanvasObjects().map((object) => {
			const indexed = this.byObject.get(object);
			return Object.freeze({
				object,
				persistentId: indexed.persistentId,
				kind: indexed.kind.definition.id,
				transform: captureTransform(object)
			});
		});
		return Object.freeze({
			entries: Object.freeze(entries),
			selectionIds
		});
	}
	async applyGeometry(mutation, prepared, context) {
		if (mutation.kind === "flatten") return;
		const delta = mutation.kind === "crop" ? null : mutation.affineDelta;
		for (const entry of prepared.entries) {
			const policy = this.policies.get(entry.kind);
			if ((policy === null || policy === void 0 ? void 0 : policy.supports) && !policy.supports(mutation)) continue;
			try {
				if (policy === null || policy === void 0 ? void 0 : policy.apply) await policy.apply(entry.object, mutation);
				else if (delta) applyDeltaToObject(entry.object, delta, {
					fabricUtil: this.createFabricUtilAccess(),
					preserveReadableText: (policy === null || policy === void 0 ? void 0 : policy.preserveReadable) === true
				});
			} catch (error) {
				context.warnRecoverable(error, entry.persistentId, entry.kind);
			}
		}
	}
	async synchronizeGeometry(mutation) {
		var _a;
		for (const policy of this.policies.values()) if (!policy.supports || policy.supports(mutation)) await ((_a = policy.synchronize) === null || _a === void 0 ? void 0 : _a.call(policy, mutation));
		this.rebuildIndex();
	}
	rollbackGeometry(prepared) {
		const canvas = this.host.getCanvas();
		if (!canvas) return;
		for (let index = prepared.entries.length - 1; index >= 0; index -= 1) {
			const entry = prepared.entries[index];
			if (!canvas.getObjects().includes(entry.object)) canvas.add(entry.object);
			entry.object.set(entry.transform);
			entry.object.setCoords();
		}
		this.rebuildIndex();
		this.applySelection(prepared.selectionIds);
	}
	async renderExport(targetCanvas, options) {
		var _a;
		this.setPreviewObjectsHidden(false);
		try {
			const overlayOptions = parseExportOptions((_a = options.contributors) === null || _a === void 0 ? void 0 : _a[OVERLAY_STATE_ID]);
			const included = overlayOptions.includeKinds ? new Set(overlayOptions.includeKinds) : null;
			const excluded = overlayOptions.excludeKinds ? new Set(overlayOptions.excludeKinds) : null;
			const objects = this.indexedCanvasObjects().filter((object) => {
				const indexed = this.byObject.get(object);
				const classification = this.classificationFor(indexed);
				if (included && !included.has(classification.kind)) return false;
				if (!included && indexed.kind.definition.exportByDefault === false) return false;
				if (excluded === null || excluded === void 0 ? void 0 : excluded.has(classification.kind)) return false;
				return !classification.hidden || overlayOptions.includeHidden;
			});
			await this.renderObjects(targetCanvas, objects, options);
		} finally {
			this.setPreviewObjectsHidden(true);
		}
	}
	async renderObjects(targetCanvas, objects, options) {
		for (const object of objects) {
			const indexed = this.byObject.get(object);
			if (!indexed) continue;
			const classification = this.classificationFor(indexed);
			const renderer = this.renderers.get(classification.kind);
			if (renderer) await renderer.render({
				source: object,
				targetCanvas,
				options
			});
			else {
				const clone = await object.clone();
				clone.set({ visible: true });
				targetCanvas.add(clone);
			}
		}
	}
	indexObject(object) {
		if (this.byObject.has(object)) return;
		const records = [...this.kinds.values()].sort((left, right) => left.registrationOrder - right.registrationOrder);
		for (const kind of records) {
			let matches = false;
			try {
				matches = kind.definition.classify(object);
			} catch (error) {
				this.host.reportWarning(error, `Overlay kind predicate "${kind.definition.id}" failed.`);
			}
			if (!matches) continue;
			let persistentId = kind.definition.getPersistentId(object);
			if (!persistentId && kind.definition.setPersistentId) {
				persistentId = this.generatePersistentId(kind.definition.id);
				kind.definition.setPersistentId(object, persistentId);
			}
			if (!persistentId || !OVERLAY_ID_PATTERN.test(persistentId)) {
				this.host.reportWarning(/* @__PURE__ */ new Error("Malformed persistent overlay id."), `Overlay kind "${kind.definition.id}" produced an invalid persistent id.`);
				return;
			}
			const duplicate = this.byId.get(persistentId);
			if (duplicate && duplicate.object !== object) {
				this.host.reportWarning(/* @__PURE__ */ new Error(`Duplicate overlay id: ${persistentId}`), `Overlay "${persistentId}" was not indexed because its id is already in use.`);
				return;
			}
			const indexed = {
				object,
				kind,
				persistentId
			};
			this.byId.set(persistentId, indexed);
			this.byObject.set(object, indexed);
			const marked = object;
			marked.editorOverlayKind = kind.definition.id;
			marked.editorOverlayId = persistentId;
			return;
		}
	}
	unindexObject(object) {
		const indexed = this.byObject.get(object);
		if (!indexed) return;
		if (this.byId.get(indexed.persistentId) === indexed) this.byId.delete(indexed.persistentId);
		this.byObject.delete(object);
	}
	rebuildIndex() {
		const canvas = this.host.getCanvas();
		if (!canvas) return;
		const live = new Set(canvas.getObjects());
		for (const indexed of [...this.byId.values()]) if (!live.has(indexed.object)) this.unindexObject(indexed.object);
		for (const object of canvas.getObjects()) this.indexObject(object);
	}
	classificationFor(indexed) {
		const definition = indexed.kind.definition;
		const marked = indexed.object;
		const preview = indexed.preview;
		const hidden = preview ? preview[1] : definition.isHidden ? definition.isHidden(indexed.object) : marked.editorOverlayHidden === true || indexed.object.visible === false;
		return Object.freeze({
			kind: definition.id,
			persistentId: indexed.persistentId,
			ownerPluginId: definition.ownerPluginId,
			hidden,
			locked: definition.isLocked ? definition.isLocked(indexed.object) : marked.editorOverlayLocked === true
		});
	}
	indexedCanvasObjects() {
		return this.host.requireCanvas("inspect overlay order").getObjects().filter((object) => this.byObject.has(object));
	}
	setPreviewObjectsHidden(hidden) {
		for (const target of this.byId.values()) if (target.preview) target.object.visible = hidden ? false : target.preview[0];
	}
	moveRelative(id, delta) {
		const overlays = this.indexedCanvasObjects();
		const current = overlays.indexOf(this.requireIndexed(id).object);
		this.moveToOverlayIndex(id, Math.max(0, Math.min(overlays.length - 1, current + delta)), overlays);
	}
	moveToOverlayIndex(id, target, overlays) {
		if (overlays.length === 0) return;
		const canvas = this.host.requireCanvas("change overlay layer");
		const object = this.requireIndexed(id).object;
		const targetObject = overlays[Math.max(0, Math.min(overlays.length - 1, target))];
		const targetCanvasIndex = canvas.getObjects().indexOf(targetObject);
		const movableCanvas = canvas;
		if (movableCanvas.moveObjectTo) movableCanvas.moveObjectTo(object, targetCanvasIndex);
		else {
			canvas.remove(object);
			canvas.insertAt(targetCanvasIndex, object);
		}
		this.host.requestRender();
	}
	requireIndexed(id) {
		this.assertActive("access an overlay");
		const indexed = this.byId.get(id);
		if (!indexed) throw new require_core.CoreRuntimeError(`[ImageEditor] Overlay "${id}" was not found.`);
		return indexed;
	}
	requireKindOwner(kindId, ownerPluginId) {
		const kind = this.kinds.get(kindId);
		if (!kind) throw new require_core.CoreRuntimeError(`[ImageEditor] Overlay kind "${kindId}" is not registered.`);
		if (kind.definition.ownerPluginId !== ownerPluginId) throw new require_core.CoreRuntimeError(`[ImageEditor] Overlay kind "${kindId}" belongs to "${kind.definition.ownerPluginId}", not "${ownerPluginId}".`);
	}
	emitSelection() {
		if (this.disposed) return;
		const selection = this.getSelection();
		for (const listener of [...this.selectionListeners]) try {
			listener(selection);
		} catch (error) {
			this.host.reportWarning(error, "Overlay selection listener failed.");
		}
	}
	generatePersistentId(kind) {
		var _a, _b;
		const randomId = (_b = (_a = globalThis.crypto) === null || _a === void 0 ? void 0 : _a.randomUUID) === null || _b === void 0 ? void 0 : _b.call(_a);
		return randomId ? `${kind}:${randomId}` : `${kind}:${Date.now().toString(36)}:${++this.generatedIdSequence}`;
	}
	createFabricUtilAccess() {
		return {
			multiplyTransformMatrices: (left, right) => this.host.fabric.util.multiplyTransformMatrices(left, right),
			invertTransform: (matrix) => this.host.fabric.util.invertTransform(matrix),
			qrDecompose: (matrix) => this.host.fabric.util.qrDecompose(matrix),
			Point: this.host.fabric.Point
		};
	}
	assertRuntimeIdentifier(value, label) {
		if (!require_plugin_identifier.isRuntimeIdentifier(value)) throw new require_core.CoreRuntimeError(`[ImageEditor] Invalid ${label} Runtime ID.`);
	}
	assertOpaqueIdentifier(value, label) {
		if (!OVERLAY_ID_PATTERN.test(value)) throw new require_core.CoreRuntimeError(`[ImageEditor] ${label} must be a safe identifier no longer than 128 characters.`);
	}
	assertActive(operation) {
		if (this.disposed) throw new require_core.CoreRuntimeError(`[ImageEditor] Cannot ${operation} after disposal.`);
	}
};

//#endregion
//#region dist/esm/foundations/overlay/overlay-state-geometry.js
function isFinitePoint(value) {
	if (typeof value !== "object" || value === null) return false;
	const point = value;
	return Number.isFinite(point.x) && Number.isFinite(point.y);
}
function isOverlayStateBoundsGeometry(value) {
	if (typeof value !== "object" || value === null) return false;
	const geometry = value;
	return geometry.type === "bounds" && Array.isArray(geometry.corners) && geometry.corners.length === 4 && geometry.corners.every(isFinitePoint);
}
function captureOverlayStateBounds(object, context) {
	object.setCoords();
	const corners = object.getCoords();
	if (corners.length !== 4) throw new TypeError("Overlay State bounds require four object corners.");
	return Object.freeze({
		type: "bounds",
		corners: Object.freeze(corners.map((point) => Object.freeze(context.toImageNormalized(point))))
	});
}
function frameFromCorners(corners) {
	const [topLeft, topRight, , bottomLeft] = corners;
	return [
		topRight.x - topLeft.x,
		topRight.y - topLeft.y,
		bottomLeft.x - topLeft.x,
		bottomLeft.y - topLeft.y,
		topLeft.x,
		topLeft.y
	];
}
function cornersMatch(actual, expected, epsilon = 1e-6) {
	const coordinateScale = Math.max(1, ...actual.flatMap(({ x, y }) => [Math.abs(x), Math.abs(y)]), ...expected.flatMap(({ x, y }) => [Math.abs(x), Math.abs(y)]));
	const tolerance = Math.max(epsilon, coordinateScale * 1e-9);
	return actual.every((point, index) => Math.abs(point.x - expected[index].x) <= tolerance && Math.abs(point.y - expected[index].y) <= tolerance);
}
var OverlayStateRestoreError = class extends TypeError {
	constructor(cause, rollbackError) {
		super("Overlay State bounds failed and the original transform could not be restored.");
		Object.defineProperty(this, "cause", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: cause
		});
		Object.defineProperty(this, "rollbackError", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: rollbackError
		});
		Object.defineProperty(this, "name", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: "OverlayStateRestoreError"
		});
	}
};
function restoreOverlayStateBounds(object, geometry, context, fabric) {
	if (!isOverlayStateBoundsGeometry(geometry)) throw new TypeError("Overlay State bounds are malformed.");
	const targetCorners = geometry.corners.map((point) => context.toCanvasPoint(point));
	const fabricUtil = {
		multiplyTransformMatrices: (left, right) => fabric.util.multiplyTransformMatrices(left, right),
		invertTransform: (matrix) => fabric.util.invertTransform(matrix),
		qrDecompose: (matrix) => fabric.util.qrDecompose(matrix),
		Point: fabric.Point
	};
	const originalTransform = {
		left: object.left,
		top: object.top,
		angle: object.angle,
		scaleX: object.scaleX,
		scaleY: object.scaleY,
		skewX: object.skewX,
		skewY: object.skewY,
		flipX: object.flipX,
		flipY: object.flipY
	};
	try {
		for (let attempt = 0; attempt < 8; attempt += 1) {
			object.setCoords();
			const sourceCorners = object.getCoords();
			if (sourceCorners.length !== 4) throw new TypeError("Overlay State bounds require four object corners.");
			if (cornersMatch(sourceCorners, targetCorners)) return;
			const delta = fabricUtil.multiplyTransformMatrices(frameFromCorners(targetCorners), fabricUtil.invertTransform(frameFromCorners(sourceCorners)));
			applyDeltaToObject(object, delta, { fabricUtil });
		}
		object.setCoords();
		if (!cornersMatch(object.getCoords(), targetCorners)) throw new TypeError("Overlay State bounds could not be restored precisely.");
	} catch (error) {
		try {
			object.set(originalTransform);
			object.setCoords();
		} catch (rollbackError) {
			throw new OverlayStateRestoreError(error, rollbackError);
		}
		throw error;
	}
}
function objectPointToCanvas(object, point) {
	var _a, _b;
	const offset = object.pathOffset;
	const x = point.x - ((_a = offset === null || offset === void 0 ? void 0 : offset.x) !== null && _a !== void 0 ? _a : 0);
	const y = point.y - ((_b = offset === null || offset === void 0 ? void 0 : offset.y) !== null && _b !== void 0 ? _b : 0);
	const [a, b, c, d, e, f] = object.calcTransformMatrix();
	return Object.freeze({
		x: a * x + c * y + e,
		y: b * x + d * y + f
	});
}

//#endregion
//#region dist/esm/foundations/overlay/index.js
const OVERLAY_CAPABILITY = require_core_capabilities.createCapabilityToken("foundation:overlay", "1.0.0");
const OVERLAY_REGISTRATION_CAPABILITY = require_core_capabilities.createCapabilityToken("foundation:overlay-registration", "1.0.0");
const overlayFoundationRef = require_core_capabilities.definePluginRef("foundation:overlay", "1.0.0");
function createRuntimeApi(controller) {
	const bind = (method) => method.bind(controller);
	const api = {
		list: bind(controller.list),
		getByPersistentId: bind(controller.getByPersistentId),
		classify: bind(controller.classify),
		getStateKind: bind(controller.getStateKind),
		flatten: bind(controller.flatten),
		mutate: bind(controller.mutate),
		add: bind(controller.add),
		addTransient: bind(controller.addTransient),
		replaceTransient: bind(controller.replaceTransient),
		remove: bind(controller.remove),
		removeTransient: bind(controller.removeTransient),
		cancelActiveGesture: bind(controller.cancelActiveGesture),
		waitForIdle: bind(controller.waitForIdle),
		getSelection: bind(controller.getSelection),
		select: bind(controller.select),
		discardSelection: bind(controller.discardSelection),
		onSelectionChange: bind(controller.onSelectionChange),
		hideForPreview: bind(controller.hideForPreview),
		setHidden: bind(controller.setHidden),
		setLocked: bind(controller.setLocked),
		bringForward: bind(controller.bringForward),
		sendBackward: bind(controller.sendBackward),
		bringToFront: bind(controller.bringToFront),
		sendToBack: bind(controller.sendToBack)
	};
	return Object.freeze(api);
}
function createRegistrationApi(controller) {
	const bind = (method) => method.bind(controller);
	const registration = {
		registerKind: bind(controller.registerKind),
		registerGeometryPolicy: bind(controller.registerGeometryPolicy),
		registerInteractionPolicy: bind(controller.registerInteractionPolicy),
		registerExportRenderer: bind(controller.registerExportRenderer)
	};
	return Object.freeze(registration);
}
function overlayFoundationPlugin() {
	let controller = null;
	return require_sdk.definePlugin({
		ref: overlayFoundationRef,
		manifest: {
			id: overlayFoundationRef.id,
			version: "1.0.0",
			apiVersion: overlayFoundationRef.apiVersion,
			engine: "^3.0.0",
			requires: [
				{
					token: require_core_capabilities.CORE_DIAGNOSTICS_CAPABILITY,
					range: "^1.0.0"
				},
				{
					token: require_core_capabilities.CORE_PRESENTATION_CAPABILITY,
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
					token: require_core_capabilities.MEMENTO_HISTORY_CAPABILITY,
					range: "^1.0.0"
				},
				{
					token: require_core_capabilities.GEOMETRY_MUTATION_CAPABILITY,
					range: "^1.0.0"
				},
				{
					token: require_core_capabilities.IMAGE_RESOURCE_POLICY_CAPABILITY,
					range: "^1.0.0"
				},
				{
					token: require_core_capabilities.EXPORT_CONTRIBUTION_CAPABILITY,
					range: "^1.0.0"
				},
				{
					token: require_core_capabilities.DOCUMENT_MUTATION_CAPABILITY,
					range: "^1.0.0"
				}
			],
			permissions: [
				"fabric:objects",
				"fabric:canvas-read",
				"core:raster-mutation",
				"core:geometry-participant",
				"core:export-contributor"
			]
		},
		setupMode: "sync",
		setup(context) {
			const diagnostics = context.capabilities.require(require_core_capabilities.CORE_DIAGNOSTICS_CAPABILITY);
			const presentation = context.capabilities.require(require_core_capabilities.CORE_PRESENTATION_CAPABILITY);
			const fabricRuntime = context.capabilities.require(require_core_capabilities.FABRIC_RUNTIME_CAPABILITY);
			const canvas = context.capabilities.require(require_core_capabilities.CANVAS_READ_CAPABILITY);
			const baseImage = context.capabilities.require(require_core_capabilities.BASE_IMAGE_READ_CAPABILITY);
			const render = context.capabilities.require(require_core_capabilities.RENDER_REQUEST_CAPABILITY);
			const raster = context.capabilities.require(require_core_capabilities.RASTER_MUTATION_CAPABILITY);
			const state = context.capabilities.require(require_core_capabilities.SNAPSHOT_REGISTRATION_CAPABILITY);
			const mementos = context.capabilities.require(require_core_capabilities.MEMENTO_HISTORY_CAPABILITY);
			const geometry = context.capabilities.require(require_core_capabilities.GEOMETRY_MUTATION_CAPABILITY);
			const imageResources = context.capabilities.require(require_core_capabilities.IMAGE_RESOURCE_POLICY_CAPABILITY);
			const exportPort = context.capabilities.require(require_core_capabilities.EXPORT_CONTRIBUTION_CAPABILITY);
			const mutations = context.capabilities.require(require_core_capabilities.DOCUMENT_MUTATION_CAPABILITY);
			const host = Object.freeze({
				...diagnostics,
				...presentation,
				...fabricRuntime,
				...canvas,
				...baseImage,
				...render,
				...raster,
				...imageResources,
				runOperation: (operationId, task) => context.operations.run(operationId, null, () => task())
			});
			context.operations.register({
				id: "overlay:gesture",
				mode: "mutation",
				conflictDomains: require_internal_operation_conflict_domains.PERSISTENT_OVERLAY_MUTATION_CONFLICT_DOMAINS,
				reentrancy: "queue"
			});
			for (const operationId of [
				"overlay:add",
				"overlay:remove",
				"overlay:set-hidden",
				"overlay:set-locked",
				"overlay:layer"
			]) context.operations.register({
				id: operationId,
				mode: "mutation",
				conflictDomains: require_internal_operation_conflict_domains.PERSISTENT_OVERLAY_MUTATION_CONFLICT_DOMAINS,
				reentrancy: "reject"
			});
			context.operations.register({
				id: "overlay:transient",
				mode: "busy",
				conflictDomains: ["overlay", "selection"],
				reentrancy: "queue"
			});
			context.operations.register({
				id: "overlay:flatten",
				mode: "mutation",
				conflictDomains: require_internal_operation_conflict_domains.DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS,
				reentrancy: "reject"
			});
			controller = new OverlayFoundationController(host, state, mementos, geometry, mutations, exportPort);
			context.capabilities.provide(OVERLAY_CAPABILITY, createRuntimeApi(controller), { version: OVERLAY_CAPABILITY.version });
			context.capabilities.provide(OVERLAY_REGISTRATION_CAPABILITY, createRegistrationApi(controller), {
				version: OVERLAY_REGISTRATION_CAPABILITY.version,
				requiredPermission: "fabric:custom-class"
			});
			return controller;
		},
		onInit() {
			controller === null || controller === void 0 || controller.attach();
		},
		onDispose() {
			controller === null || controller === void 0 || controller.dispose();
			controller = null;
		}
	});
}

//#endregion
Object.defineProperty(exports, 'OVERLAY_CAPABILITY', {
  enumerable: true,
  get: function () {
    return OVERLAY_CAPABILITY;
  }
});
Object.defineProperty(exports, 'OVERLAY_REGISTRATION_CAPABILITY', {
  enumerable: true,
  get: function () {
    return OVERLAY_REGISTRATION_CAPABILITY;
  }
});
Object.defineProperty(exports, 'OverlayRecoverableObjectError', {
  enumerable: true,
  get: function () {
    return OverlayRecoverableObjectError;
  }
});
Object.defineProperty(exports, 'captureOverlayStateBounds', {
  enumerable: true,
  get: function () {
    return captureOverlayStateBounds;
  }
});
Object.defineProperty(exports, 'isOverlayStateBoundsGeometry', {
  enumerable: true,
  get: function () {
    return isOverlayStateBoundsGeometry;
  }
});
Object.defineProperty(exports, 'objectPointToCanvas', {
  enumerable: true,
  get: function () {
    return objectPointToCanvas;
  }
});
Object.defineProperty(exports, 'overlayFoundationPlugin', {
  enumerable: true,
  get: function () {
    return overlayFoundationPlugin;
  }
});
Object.defineProperty(exports, 'overlayFoundationRef', {
  enumerable: true,
  get: function () {
    return overlayFoundationRef;
  }
});
Object.defineProperty(exports, 'restoreOverlayStateBounds', {
  enumerable: true,
  get: function () {
    return restoreOverlayStateBounds;
  }
});
//# sourceMappingURL=overlay-CWkZqwNK.cjs.map