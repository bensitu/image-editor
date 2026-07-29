
//#region dist/esm/core/public-types.js
function isBaseImageObject(object) {
	return !!object && typeof object === "object" && object.editorObjectKind === "baseImage";
}
function isMaskObject(object) {
	const candidate = object;
	return !!candidate && candidate.editorObjectKind === "mask" && typeof candidate.maskId === "number" && typeof candidate.maskUid === "string" && typeof candidate.maskName === "string";
}
function isSessionObject(object) {
	const candidate = object;
	return !!candidate && candidate.editorObjectKind === "session" && typeof candidate.sessionObjectType === "string";
}

//#endregion
//#region dist/esm/utils/internal-layer-placement.js
function isRasterVisualObject(object) {
	return object.editorLayerRole === "rasterVisual";
}
function isInternallyMarkedSessionObject(object) {
	return object.editorLayerRole === "session";
}
function isPropertyMarkedSessionObject(object) {
	const candidate = object;
	return candidate.isCropRect === true || candidate.maskLabel === true || candidate.isMosaicPreview === true;
}
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
function findFirstSessionIndex(objects) {
	return objects.findIndex((object) => isSessionObject(object) || isInternallyMarkedSessionObject(object) || isPropertyMarkedSessionObject(object));
}
function markRasterVisualObject(object) {
	const rasterVisual = object;
	rasterVisual.editorLayerRole = "rasterVisual";
	return rasterVisual;
}
function placeRasterVisualObject(canvas, rasterVisual) {
	const markedVisual = markRasterVisualObject(rasterVisual);
	ensureOnCanvas(canvas, markedVisual);
	const objects = withoutObject(canvas, markedVisual);
	moveObjectTo(canvas, markedVisual, objects.filter(isBaseImageObject).length + objects.filter(isRasterVisualObject).length);
}
function placeMaskObject(canvas, mask) {
	ensureOnCanvas(canvas, mask);
	const objects = withoutObject(canvas, mask);
	const firstSessionIndex = findFirstSessionIndex(objects);
	moveObjectTo(canvas, mask, firstSessionIndex === -1 ? objects.length : firstSessionIndex);
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
Object.defineProperty(exports, 'isMaskObject', {
  enumerable: true,
  get: function () {
    return isMaskObject;
  }
});
Object.defineProperty(exports, 'markSessionObject', {
  enumerable: true,
  get: function () {
    return markSessionObject;
  }
});
Object.defineProperty(exports, 'placeMaskObject', {
  enumerable: true,
  get: function () {
    return placeMaskObject;
  }
});
Object.defineProperty(exports, 'placeRasterVisualObject', {
  enumerable: true,
  get: function () {
    return placeRasterVisualObject;
  }
});
Object.defineProperty(exports, 'placeSessionObject', {
  enumerable: true,
  get: function () {
    return placeSessionObject;
  }
});
//# sourceMappingURL=internal-layer-placement-vE1rwXBj.cjs.map