import { InvalidPluginDefinitionError } from './errors.js';
import { assertPluginIdentifier } from './plugin-identifier.js';
import { isValidSemVer } from './semver.js';
const pluginRefBrand = Symbol('ImageEditorPluginRef');
export function definePluginRef(id, apiVersion) {
    assertPluginIdentifier(id, 'PluginRef id');
    if (apiVersion.length > 64 || !isValidSemVer(apiVersion)) {
        throw new InvalidPluginDefinitionError(`PluginRef "${id}" has invalid API SemVer "${apiVersion}".`, id);
    }
    const ref = {
        id,
        apiVersion,
        [pluginRefBrand]: true,
    };
    return Object.freeze(ref);
}
export function isPluginRef(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const candidate = value;
    return candidate[pluginRefBrand] === true;
}
//# sourceMappingURL=plugin-ref.js.map