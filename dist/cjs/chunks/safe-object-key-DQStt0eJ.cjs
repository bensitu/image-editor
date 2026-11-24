// dist/esm/utils/safe-object-key.js
function isUnsafeObjectKey(key) {
	return key === "__proto__" || key === "constructor" || key === "prototype";
}

Object.defineProperty(exports, "isUnsafeObjectKey", {
  enumerable: true,
  get: function () {
    return isUnsafeObjectKey;
  }
});
//# sourceMappingURL=safe-object-key-DQStt0eJ.cjs.map