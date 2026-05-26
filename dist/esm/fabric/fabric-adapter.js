function looksLikeFabricModule(value) {
    if (value === null || typeof value !== 'object')
        return false;
    const candidate = value.Canvas;
    return typeof candidate === 'function';
}
function readGlobalFabric(globalScope) {
    return globalScope.fabric;
}
export function detectFabric(fabricOrOptions, maybeOptions, globalScope = globalThis) {
    var _a;
    if (looksLikeFabricModule(fabricOrOptions)) {
        return {
            fabric: fabricOrOptions,
            _fabricLoaded: true,
            options: maybeOptions !== null && maybeOptions !== void 0 ? maybeOptions : {},
        };
    }
    const options = (_a = fabricOrOptions) !== null && _a !== void 0 ? _a : {};
    const globalFabric = readGlobalFabric(globalScope);
    if (looksLikeFabricModule(globalFabric)) {
        return {
            fabric: globalFabric,
            _fabricLoaded: true,
            options,
        };
    }
    console.error('[ImageEditor] fabric.js v7 is not available. ' +
        'Pass it as the first constructor argument (ESM) or ' +
        'load it as a global <script> before instantiation.');
    return {
        fabric: null,
        _fabricLoaded: false,
        options,
    };
}
//# sourceMappingURL=fabric-adapter.js.map