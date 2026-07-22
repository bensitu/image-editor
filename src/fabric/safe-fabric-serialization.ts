/**
 * Validates serialized Fabric object graphs before they reach Fabric class revival.
 *
 * @module
 */

import { isDangerousStateKey } from '../plugin-kernel/plugin-identifier.js';

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
const ROOT_TYPE_PROPERTIES: Readonly<Record<string, ReadonlySet<string>>> = Object.freeze({
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

export interface SerializedFabricValidationOptions {
    readonly rootTypes: readonly string[];
    readonly maxDepth?: number;
    readonly maxNodes?: number;
    readonly maxArrayLength?: number;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

/** Returns true only for bounded object graphs that cannot revive arbitrary Fabric classes. */
export function isSafeSerializedFabricObject(
    value: unknown,
    options: SerializedFabricValidationOptions,
): value is Readonly<Record<string, unknown>> {
    if (!isPlainRecord(value)) return false;
    const rootTypeDescriptor = Object.getOwnPropertyDescriptor(value, 'type');
    const rootType =
        rootTypeDescriptor && 'value' in rootTypeDescriptor ? rootTypeDescriptor.value : undefined;
    if (
        typeof rootType !== 'string' ||
        !options.rootTypes.some((type) => type.toLowerCase() === rootType.toLowerCase())
    ) {
        return false;
    }

    const maxDepth = options.maxDepth ?? 24;
    const maxNodes = options.maxNodes ?? 20_000;
    const maxArrayLength = options.maxArrayLength ?? 65_536;
    const ancestors = new WeakSet<object>();
    let nodes = 0;

    const inspect = (
        entry: unknown,
        depth: number,
        root: boolean,
        propertyName?: string,
    ): boolean => {
        if (
            entry === null ||
            entry === undefined ||
            typeof entry === 'string' ||
            typeof entry === 'boolean'
        ) {
            if (
                typeof entry === 'string' &&
                propertyName &&
                (RESOURCE_KEYS.has(propertyName.toLowerCase()) ||
                    propertyName.toLowerCase().endsWith('url'))
            ) {
                return DATA_IMAGE_PATTERN.test(entry);
            }
            return true;
        }
        if (typeof entry === 'number') return Number.isFinite(entry);
        if (typeof entry !== 'object' || depth > maxDepth || ancestors.has(entry)) return false;
        nodes += 1;
        if (nodes > maxNodes) return false;

        if (Array.isArray(entry)) {
            if (entry.length > maxArrayLength) return false;
            ancestors.add(entry);
            const enumerableSymbols = Object.getOwnPropertySymbols(entry).some(
                (key) => Object.getOwnPropertyDescriptor(entry, key)?.enumerable === true,
            );
            if (enumerableSymbols) return false;
            const keys = Object.keys(entry);
            if (keys.some((key) => !/^(?:0|[1-9]\d*)$/u.test(key) || Number(key) >= entry.length)) {
                return false;
            }
            for (let index = 0; index < entry.length; index += 1) {
                const descriptor = Object.getOwnPropertyDescriptor(entry, String(index));
                if (!descriptor || !('value' in descriptor)) return false;
                if (!inspect(descriptor.value, depth + 1, false)) return false;
            }
            ancestors.delete(entry);
            return true;
        }
        if (!isPlainRecord(entry)) return false;

        const typeDescriptor = Object.getOwnPropertyDescriptor(entry, 'type');
        const entryType =
            typeDescriptor && 'value' in typeDescriptor ? typeDescriptor.value : undefined;
        if (!root && typeof entryType === 'string') {
            const nestedType = entryType.toLowerCase();
            if (!SAFE_NESTED_FABRIC_TYPES.has(nestedType)) return false;
        }
        if (
            Object.getOwnPropertySymbols(entry).some(
                (key) => Object.getOwnPropertyDescriptor(entry, key)?.enumerable === true,
            )
        ) {
            return false;
        }
        ancestors.add(entry);
        for (const key of Object.keys(entry)) {
            if (isDangerousStateKey(key)) return false;
            if (
                root &&
                !COMMON_ROOT_PROPERTIES.has(key) &&
                !MASK_INTERACTION_PROPERTIES.has(key) &&
                !ROOT_TYPE_PROPERTIES[rootType.toLowerCase()]?.has(key)
            ) {
                return false;
            }
            const descriptor = Object.getOwnPropertyDescriptor(entry, key);
            if (!descriptor || !('value' in descriptor)) return false;
            if (key === 'clipPath' && descriptor.value !== null && descriptor.value !== undefined) {
                return false;
            }
            if (
                key === 'filters' &&
                (!Array.isArray(descriptor.value) || descriptor.value.length > 0)
            ) {
                return false;
            }
            if (!inspect(descriptor.value, depth + 1, false, key)) return false;
        }
        ancestors.delete(entry);
        return true;
    };

    if (!inspect(value, 0, true)) return false;
    if (rootType.toLowerCase() === 'path' && !Array.isArray(value.path)) return false;
    if (rootType.toLowerCase() === 'textbox' && value.path !== null && value.path !== undefined) {
        return false;
    }
    return true;
}
