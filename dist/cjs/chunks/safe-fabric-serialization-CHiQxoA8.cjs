'use strict';

var pluginIdentifier = require('./plugin-identifier-CjVVyVRY.cjs');

const SAFE_NESTED_FABRIC_TYPES = new Set(['linear', 'pattern', 'radial', 'shadow']);
const RESOURCE_KEYS = new Set(['href', 'source', 'src', 'url']);
const DATA_IMAGE_PATTERN = /^data:image\/(?:jpeg|png|webp);base64,[a-z\d+/]+={0,2}$/iu;
const COMMON_ROOT_PROPERTIES = new Set([
    'angle',
    'backgroundColor',
    'fill',
    'fillRule',
    'flipX',
    'flipY',
    'globalCompositeOperation',
    'height',
    'left',
    'opacity',
    'originX',
    'originY',
    'paintFirst',
    'scaleX',
    'scaleY',
    'shadow',
    'skewX',
    'skewY',
    'stroke',
    'strokeDashArray',
    'strokeDashOffset',
    'strokeLineCap',
    'strokeLineJoin',
    'strokeMiterLimit',
    'strokeUniform',
    'strokeWidth',
    'top',
    'type',
    'version',
    'visible',
    'width',
]);
const MASK_INTERACTION_PROPERTIES = new Set([
    'borderColor',
    'cornerColor',
    'cornerSize',
    'evented',
    'hasControls',
    'lockRotation',
    'selectable',
    'transparentCorners',
]);
const ROOT_TYPE_PROPERTIES = Object.freeze({
    rect: new Set(['rx', 'ry']),
    circle: new Set(['counterClockwise', 'endAngle', 'radius', 'startAngle']),
    ellipse: new Set(['rx', 'ry']),
    line: new Set(['x1', 'x2', 'y1', 'y2']),
    path: new Set(['path']),
    polygon: new Set(['points']),
    textbox: new Set([
        'charSpacing',
        'direction',
        'editable',
        'fontFamily',
        'fontSize',
        'fontStyle',
        'fontWeight',
        'lineHeight',
        'linethrough',
        'minWidth',
        'overline',
        'path',
        'pathAlign',
        'pathSide',
        'pathStartOffset',
        'splitByGrapheme',
        'styles',
        'text',
        'textAlign',
        'textBackgroundColor',
        'textDecorationThickness',
        'underline',
    ]),
});
function isPlainRecord(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
function isSafeSerializedFabricObject(value, options) {
    var _a, _b, _c;
    if (!isPlainRecord(value))
        return false;
    const rootTypeDescriptor = Object.getOwnPropertyDescriptor(value, 'type');
    const rootType = rootTypeDescriptor && 'value' in rootTypeDescriptor ? rootTypeDescriptor.value : undefined;
    if (typeof rootType !== 'string' ||
        !options.rootTypes.some((type) => type.toLowerCase() === rootType.toLowerCase())) {
        return false;
    }
    const maxDepth = (_a = options.maxDepth) !== null && _a !== void 0 ? _a : 24;
    const maxNodes = (_b = options.maxNodes) !== null && _b !== void 0 ? _b : 20000;
    const maxArrayLength = (_c = options.maxArrayLength) !== null && _c !== void 0 ? _c : 65536;
    const ancestors = new WeakSet();
    let nodes = 0;
    const inspect = (entry, depth, root, propertyName) => {
        var _a;
        if (entry === null ||
            entry === undefined ||
            typeof entry === 'string' ||
            typeof entry === 'boolean') {
            if (typeof entry === 'string' &&
                propertyName &&
                (RESOURCE_KEYS.has(propertyName.toLowerCase()) ||
                    propertyName.toLowerCase().endsWith('url'))) {
                return DATA_IMAGE_PATTERN.test(entry);
            }
            return true;
        }
        if (typeof entry === 'number')
            return Number.isFinite(entry);
        if (typeof entry !== 'object' || depth > maxDepth || ancestors.has(entry))
            return false;
        nodes += 1;
        if (nodes > maxNodes)
            return false;
        if (Array.isArray(entry)) {
            if (entry.length > maxArrayLength)
                return false;
            ancestors.add(entry);
            const enumerableSymbols = Object.getOwnPropertySymbols(entry).some((key) => { var _a; return ((_a = Object.getOwnPropertyDescriptor(entry, key)) === null || _a === void 0 ? void 0 : _a.enumerable) === true; });
            if (enumerableSymbols)
                return false;
            const keys = Object.keys(entry);
            if (keys.some((key) => !/^(?:0|[1-9]\d*)$/u.test(key) || Number(key) >= entry.length)) {
                return false;
            }
            for (let index = 0; index < entry.length; index += 1) {
                const descriptor = Object.getOwnPropertyDescriptor(entry, String(index));
                if (!descriptor || !('value' in descriptor))
                    return false;
                if (!inspect(descriptor.value, depth + 1, false))
                    return false;
            }
            ancestors.delete(entry);
            return true;
        }
        if (!isPlainRecord(entry))
            return false;
        const typeDescriptor = Object.getOwnPropertyDescriptor(entry, 'type');
        const entryType = typeDescriptor && 'value' in typeDescriptor ? typeDescriptor.value : undefined;
        if (!root && typeof entryType === 'string') {
            const nestedType = entryType.toLowerCase();
            if (!SAFE_NESTED_FABRIC_TYPES.has(nestedType))
                return false;
        }
        if (Object.getOwnPropertySymbols(entry).some((key) => { var _a; return ((_a = Object.getOwnPropertyDescriptor(entry, key)) === null || _a === void 0 ? void 0 : _a.enumerable) === true; })) {
            return false;
        }
        ancestors.add(entry);
        for (const key of Object.keys(entry)) {
            if (pluginIdentifier.isDangerousStateKey(key))
                return false;
            if (root &&
                !COMMON_ROOT_PROPERTIES.has(key) &&
                !MASK_INTERACTION_PROPERTIES.has(key) &&
                !((_a = ROOT_TYPE_PROPERTIES[rootType.toLowerCase()]) === null || _a === void 0 ? void 0 : _a.has(key))) {
                return false;
            }
            const descriptor = Object.getOwnPropertyDescriptor(entry, key);
            if (!descriptor || !('value' in descriptor))
                return false;
            if (key === 'clipPath' && descriptor.value !== null && descriptor.value !== undefined) {
                return false;
            }
            if (key === 'filters' &&
                (!Array.isArray(descriptor.value) || descriptor.value.length > 0)) {
                return false;
            }
            if (!inspect(descriptor.value, depth + 1, false, key))
                return false;
        }
        ancestors.delete(entry);
        return true;
    };
    if (!inspect(value, 0, true))
        return false;
    if (rootType.toLowerCase() === 'path' && !Array.isArray(value.path))
        return false;
    if (rootType.toLowerCase() === 'textbox' && value.path !== null && value.path !== undefined) {
        return false;
    }
    return true;
}

exports.isSafeSerializedFabricObject = isSafeSerializedFabricObject;
//# sourceMappingURL=safe-fabric-serialization-CHiQxoA8.cjs.map
