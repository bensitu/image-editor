/**
 * Creates typed Capability identities and validates their Runtime IDs and versions.
 *
 * @module
 */

import { InvalidCapabilityVersionError, InvalidPluginDefinitionError } from './errors.js';
import { isRuntimeIdentifier } from './plugin-identifier.js';
import { isValidSemVer, isValidSemVerRange } from './semver.js';

const capabilityTokenBrand: unique symbol = Symbol('ImageEditorCapabilityToken');

export interface CapabilityToken<TPort> {
    readonly id: string;
    readonly version: string;
    /** Phantom Port type. Runtime code never reads this field. */
    readonly __type?: TPort;
    readonly [capabilityTokenBrand]: true;
}

export interface CapabilityIdentity {
    readonly id: string;
    readonly version: string;
}

export interface CapabilityRequirementIdentity {
    readonly token: CapabilityIdentity;
    readonly range: string;
}

export interface CapabilityRequirement<TPort = unknown> extends CapabilityRequirementIdentity {
    readonly token: CapabilityToken<TPort>;
}

export function createCapabilityToken<TPort>(id: string, version: string): CapabilityToken<TPort> {
    if (!isRuntimeIdentifier(id)) {
        throw new InvalidPluginDefinitionError(
            'CapabilityToken id must use namespace:kebab-case and be at most 128 characters.',
        );
    }
    if (!isValidSemVer(version)) {
        throw new InvalidCapabilityVersionError(id, version, 'version');
    }
    const token: CapabilityToken<TPort> = {
        id,
        version,
        [capabilityTokenBrand]: true,
    };
    return Object.freeze(token);
}

export function isCapabilityToken(value: unknown): value is CapabilityToken<unknown> {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Partial<CapabilityToken<unknown>>;
    return candidate[capabilityTokenBrand] === true;
}

export function assertCapabilityRequirement(requirement: CapabilityRequirementIdentity): void {
    const token = requirement?.token;
    if (!isCapabilityToken(token)) {
        throw new InvalidCapabilityVersionError('unknown', requirement?.range ?? '', 'range');
    }
    if (!isValidSemVerRange(requirement.range)) {
        throw new InvalidCapabilityVersionError(token.id, requirement.range, 'range');
    }
}
