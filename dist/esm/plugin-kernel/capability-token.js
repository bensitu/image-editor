import { InvalidCapabilityVersionError, InvalidPluginDefinitionError } from './errors.js';
import { isValidSemVer, isValidSemVerRange } from './semver.js';
const capabilityTokenBrand = Symbol('ImageEditorCapabilityToken');
const MAX_CAPABILITY_ID_LENGTH = 128;
const CAPABILITY_ID_PATTERN = /^[A-Za-z0-9@][A-Za-z0-9@._:/-]*$/u;
const prohibitedCapabilitySegments = new Set(['__proto__', 'constructor', 'prototype']);
export function createCapabilityToken(id, version) {
    if (typeof id !== 'string' ||
        id.length === 0 ||
        id.length > MAX_CAPABILITY_ID_LENGTH ||
        id.trim() !== id ||
        !CAPABILITY_ID_PATTERN.test(id) ||
        id.split(/[.:/]/u).some((segment) => prohibitedCapabilitySegments.has(segment))) {
        throw new InvalidPluginDefinitionError(`CapabilityToken id must be a safe, trimmed identifier no longer than ${MAX_CAPABILITY_ID_LENGTH} characters.`);
    }
    if (!isValidSemVer(version)) {
        throw new InvalidCapabilityVersionError(id, version, 'version');
    }
    const token = {
        id,
        version,
        [capabilityTokenBrand]: true,
    };
    return Object.freeze(token);
}
export function isCapabilityToken(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const candidate = value;
    return candidate[capabilityTokenBrand] === true;
}
export function assertCapabilityRequirement(requirement) {
    var _a;
    const token = requirement === null || requirement === void 0 ? void 0 : requirement.token;
    if (!isCapabilityToken(token)) {
        throw new InvalidCapabilityVersionError('unknown', (_a = requirement === null || requirement === void 0 ? void 0 : requirement.range) !== null && _a !== void 0 ? _a : '', 'range');
    }
    if (!isValidSemVerRange(requirement.range)) {
        throw new InvalidCapabilityVersionError(token.id, requirement.range, 'range');
    }
}
//# sourceMappingURL=capability-token.js.map