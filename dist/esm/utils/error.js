export function hasErrorName(error, expectedName) {
    if ((typeof error !== 'object' && typeof error !== 'function') || error === null) {
        return false;
    }
    try {
        return Reflect.get(error, 'name') === expectedName;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=error.js.map