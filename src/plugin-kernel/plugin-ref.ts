/**
 * Creates immutable branded Plugin references with Runtime ID and API-version validation.
 *
 * @module
 */

import { InvalidPluginDefinitionError } from './errors.js';
import { assertPluginIdentifier } from './plugin-identifier.js';
import { isValidSemVer } from './semver.js';

const pluginRefBrand: unique symbol = Symbol('ImageEditorPluginRef');

export interface PluginIdentity {
    readonly id: string;
    readonly apiVersion: string;
}

export interface PluginRef<TApi> extends PluginIdentity {
    /** Phantom API type. Runtime code never reads this field. */
    readonly __apiType?: TApi;
    readonly [pluginRefBrand]: true;
}

export function definePluginRef<TApi>(id: string, apiVersion: string): PluginRef<TApi> {
    assertPluginIdentifier(id, 'PluginRef id');
    if (apiVersion.length > 64 || !isValidSemVer(apiVersion)) {
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
