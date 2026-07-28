
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
Object.defineProperty(exports, 'hasErrorName', {
  enumerable: true,
  get: function () {
    return hasErrorName;
  }
});
//# sourceMappingURL=error-DjRQe7I0.cjs.map