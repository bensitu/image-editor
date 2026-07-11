import { satisfies, valid, validRange } from 'semver';
export function isValidSemVer(version) {
    return version.trim() === version && valid(version, { loose: false }) !== null;
}
export function isValidSemVerRange(range) {
    return range.trim().length > 0 && range.trim() === range && validRange(range) !== null;
}
export function satisfiesSemVer(version, range) {
    return satisfies(version, range, { includePrerelease: false });
}
//# sourceMappingURL=semver.js.map