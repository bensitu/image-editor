import { InvalidPluginDefinitionError } from './errors.js';
import { isValidSemVer } from './semver.js';

const pluginRefBrand: unique symbol = Symbol('ImageEditorPluginRef');

export interface PluginIdentity {
    readonly id: string;
    readonly apiVersion: string;
}

export interface PluginRef<TApi> extends PluginIdentity {
    /** Phantom invariant type. Runtime code never reads this field. */
    // eslint-disable-next-line @typescript-eslint/naming-convention -- Proposal-compatible phantom field.
    readonly __apiType?: (api: TApi) => TApi;
    readonly [pluginRefBrand]: true;
}

export function definePluginRef<TApi>(id: string, apiVersion: string): PluginRef<TApi> {
    if (id.trim().length === 0 || id.trim() !== id) {
        throw new InvalidPluginDefinitionError('PluginRef id must be a non-empty trimmed string.');
    }
    if (!isValidSemVer(apiVersion)) {
        throw new InvalidPluginDefinitionError(
            `PluginRef "${id}" has invalid API SemVer "${apiVersion}".`,
            id,
        );
    }
    const ref: PluginRef<TApi> = {
        id,
        apiVersion,
        [pluginRefBrand]: true,
    };
    return Object.freeze(ref);
}

export function isPluginRef(value: unknown): value is PluginRef<unknown> {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Partial<PluginRef<unknown>>;
    return candidate[pluginRefBrand] === true;
}
