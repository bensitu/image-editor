/**
 * Validates and evaluates the SemVer versions and range forms supported by Plugin contracts.
 *
 * @module
 */
export declare function isValidSemVer(version: string): boolean;
export declare function isValidSemVerRange(range: string): boolean;
/**
 * Applies the standard prerelease policy: a prerelease is admitted only by a
 * matching comparator set that names a prerelease with the same base tuple.
 */
export declare function satisfiesSemVer(version: string, range: string): boolean;
