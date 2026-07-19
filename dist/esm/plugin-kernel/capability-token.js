import { InvalidCapabilityVersionError, InvalidPluginDefinitionError } from './errors.js';
import { isRuntimeIdentifier } from './runtime-identifier.js';
import { isValidSemVer, isValidSemVerRange } from './semver.js';
const capabilityTokenBrand = Symbol('ImageEditorCapabilityToken');
export function createCapabilityToken(id, version) {
    if (!isRuntimeIdentifier(id)) {
        throw new InvalidPluginDefinitionError('CapabilityToken id must match "namespace:kebab-case" and be no longer than 128 characters.');
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