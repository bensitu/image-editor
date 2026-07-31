//#region dist/esm/utils/safe-object-key.js
function isUnsafeObjectKey(key) {
	return key === "__proto__" || key === "constructor" || key === "prototype";
}

//#endregion
Object.defineProperty(exports, 'isUnsafeObjectKey', {
  enumerable: true,
  get: function () {
    return isUnsafeObjectKey;
  }
});
//# sourceMappingURL=safe-object-key-SlUB_ab4.cjs.map