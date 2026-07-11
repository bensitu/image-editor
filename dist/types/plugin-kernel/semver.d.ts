export declare function isValidSemVer(version: string): boolean;
export declare function isValidSemVerRange(range: string): boolean;
/**
 * Uses node-semver's default prerelease policy: a prerelease only satisfies a
 * range that explicitly admits a prerelease with the same base tuple.
 */
export declare function satisfiesSemVer(version: string, range: string): boolean;
