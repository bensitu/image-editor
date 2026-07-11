import { InvalidCapabilityVersionError, InvalidPluginDefinitionError } from './errors.js';
import { isValidSemVer, isValidSemVerRange } from './semver.js';

const capabilityTokenBrand: unique symbol = Symbol('ImageEditorCapabilityToken');

export interface CapabilityToken<TPort> {
    readonly id: string;
    readonly version: string;
    /** Phantom invariant type. Runtime code never reads this field. */
    // eslint-disable-next-line @typescript-eslint/naming-convention -- Proposal-compatible phantom field.
    readonly __portType?: (port: TPort) => TPort;
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
    if (id.trim().length === 0 || id.trim() !== id) {
        throw new InvalidPluginDefinitionError(
            'CapabilityToken id must be a non-empty trimmed string.',
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
