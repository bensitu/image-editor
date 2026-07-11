import { satisfies, valid, validRange } from 'semver';

export function isValidSemVer(version: string): boolean {
    return version.trim() === version && valid(version, { loose: false }) !== null;
}

export function isValidSemVerRange(range: string): boolean {
    return range.trim().length > 0 && range.trim() === range && validRange(range) !== null;
}

/**
 * Uses node-semver's default prerelease policy: a prerelease only satisfies a
 * range that explicitly admits a prerelease with the same base tuple.
 */
export function satisfiesSemVer(version: string, range: string): boolean {
    return satisfies(version, range, { includePrerelease: false });
}
