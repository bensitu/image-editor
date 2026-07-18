import { InvalidPluginDefinitionError } from '../plugin-kernel/errors.js';
import { isPluginRef } from '../plugin-kernel/plugin-ref.js';
import { validatePluginManifest } from './plugin-manifest.js';
export function definePlugin(definition) {
    if (typeof definition !== 'object' || definition === null) {
        throw new InvalidPluginDefinitionError('Plugin definition must be an object.');
    }
    if (!isPluginRef(definition.ref)) {
        throw new InvalidPluginDefinitionError('Plugin definition must use a PluginRef created by definePluginRef().');
    }
    if (typeof definition.setup !== 'function') {
        throw new InvalidPluginDefinitionError(`Plugin "${definition.ref.id}" must define setup().`, definition.ref.id);
    }
    const manifest = validatePluginManifest(definition.ref, definition.manifest);
    return Object.freeze({ ...definition, manifest });
}
//# sourceMappingURL=plugin-definition.js.map