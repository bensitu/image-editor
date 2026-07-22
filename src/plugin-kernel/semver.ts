/**
 * Validates and evaluates the SemVer versions and range forms supported by Plugin contracts.
 *
 * @module
 */

interface ParsedRangeVersion {
    readonly major: number;
    readonly minor: number | null;
    readonly patch: number | null;
    readonly exact: string | null;
}

const numericIdentifier = '(?:0|[1-9]\\d*)';
const prereleaseIdentifier = `(?:${numericIdentifier}|\\d*[A-Za-z-][0-9A-Za-z-]*)`;
const semVerPattern = new RegExp(
    `^(${numericIdentifier})\\.(${numericIdentifier})\\.(${numericIdentifier})(?:-(${prereleaseIdentifier}(?:\\.${prereleaseIdentifier})*))?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`,
    'u',
);
const partialVersionPattern = new RegExp(
    `^(${numericIdentifier})(?:\\.(${numericIdentifier}|[xX*]))?(?:\\.(${numericIdentifier}|[xX*]))?$`,
    'u',
);
const comparatorPattern = /^(<=|>=|<|>|=|~|\^)?(.+)$/u;
const MAX_SEMVER_INPUT_LENGTH = 256;

function parseRangeVersion(value: string): ParsedRangeVersion | null {
    const exact = semVerPattern.exec(value);
    if (exact) {
        return {
            major: Number(exact[1]),
            minor: Number(exact[2]),
            patch: Number(exact[3]),
            exact: value,
        };
    }
    const partial = partialVersionPattern.exec(value);
    if (!partial) return null;
    const minor = partial[2];
    const patch = partial[3];
    return {
        major: Number(partial[1]),
        minor: minor === undefined || /[xX*]/u.test(minor) ? null : Number(minor),
        patch: patch === undefined || /[xX*]/u.test(patch) ? null : Number(patch),
        exact: null,
    };
}

function lowerBound(version: ParsedRangeVersion): string {
    return `${version.major}.${version.minor ?? 0}.${version.patch ?? 0}`;
}

function exclusiveUpperBound(version: ParsedRangeVersion): string {
    return version.minor === null
        ? `${version.major + 1}.0.0`
        : `${version.major}.${version.minor + 1}.0`;
}

function caretUpperBound(version: ParsedRangeVersion): string {
    if (version.major > 0 || version.minor === null) return `${version.major + 1}.0.0`;
    if (version.minor > 0 || version.patch === null) return `0.${version.minor + 1}.0`;
    return `0.0.${version.patch + 1}`;
}

function normalizeComparator(token: string): readonly string[] | null {
    if (/^[xX*]$/u.test(token)) return ['>=0.0.0'];
    const match = comparatorPattern.exec(token);
    if (!match) return null;
    const operator = match[1] ?? '';
    const version = parseRangeVersion(match[2]!);
    if (!version) return null;
    const lower = version.exact ?? lowerBound(version);
    if (operator === '^') return [`>=${lower}`, `<${caretUpperBound(version)}`];
    if (operator === '~') return [`>=${lower}`, `<${exclusiveUpperBound(version)}`];
    if (version.exact !== null) return [`${operator}${version.exact}`];
    const upper = exclusiveUpperBound(version);
    if (operator === '>') return [`>=${upper}`];
    if (operator === '<=') return [`<${upper}`];
    if (operator === '<') return [`<${lower}`];
    if (operator === '>=') return [`>=${lower}`];
    return [`>=${lower}`, `<${upper}`];
}

function normalizeComparatorSet(value: string): string | null {
    const hyphen = /^(\S+)\s+-\s+(\S+)$/u.exec(value);
    if (hyphen) {
        const lower = parseRangeVersion(hyphen[1]!);
        const upper = parseRangeVersion(hyphen[2]!);
        if (!lower || !upper) return null;
        return `>=${lowerBound(lower)} ${
            upper.exact === null ? `<${exclusiveUpperBound(upper)}` : `<=${upper.exact}`
        }`;
    }
    const normalized: string[] = [];
    for (const token of value.split(/\s+/u).filter(Boolean)) {
        const comparators = normalizeComparator(token);
        if (!comparators) return null;
        normalized.push(...comparators);
    }
    return normalized.length === 0 ? null : normalized.join(' ');
}

function normalizeRange(range: string): string | null {
    if (range.length === 0 || range.trim() !== range) return null;
    const sets = range
        .replace(/([><=~^]+)\s+/gu, '$1')
        .split('||')
        .map((entry) => entry.trim());
    if (sets.some((entry) => entry.length === 0)) return null;
    const normalized = sets.map(normalizeComparatorSet);
    return normalized.some((entry) => entry === null) ? null : normalized.join(' || ');
}

function compareNumeric(left: string, right: string): number {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    return leftNumber === rightNumber ? 0 : leftNumber < rightNumber ? -1 : 1;
}

function compareSemVer(left: RegExpExecArray, right: RegExpExecArray): number {
    for (let index = 1; index <= 3; index += 1) {
        const comparison = compareNumeric(left[index]!, right[index]!);
        if (comparison !== 0) return comparison;
    }
    const leftPrerelease = left[4]?.split('.') ?? [];
    const rightPrerelease = right[4]?.split('.') ?? [];
    if (leftPrerelease.length === 0 || rightPrerelease.length === 0) {
        return leftPrerelease.length === rightPrerelease.length
            ? 0
            : leftPrerelease.length === 0
              ? 1
              : -1;
    }
    for (
        let index = 0;
        index < Math.max(leftPrerelease.length, rightPrerelease.length);
        index += 1
    ) {
        const leftIdentifier = leftPrerelease[index];
        const rightIdentifier = rightPrerelease[index];
        if (leftIdentifier === undefined || rightIdentifier === undefined) {
            return leftIdentifier === rightIdentifier ? 0 : leftIdentifier === undefined ? -1 : 1;
        }
        if (leftIdentifier === rightIdentifier) continue;
        const leftIsNumeric = /^\d+$/u.test(leftIdentifier);
        const rightIsNumeric = /^\d+$/u.test(rightIdentifier);
        if (leftIsNumeric && rightIsNumeric) {
            return compareNumeric(leftIdentifier, rightIdentifier);
        }
        if (leftIsNumeric !== rightIsNumeric) return leftIsNumeric ? -1 : 1;
        return leftIdentifier < rightIdentifier ? -1 : 1;
    }
    return 0;
}

function satisfiesComparator(version: RegExpExecArray, comparator: string): boolean {
    const match = /^(<=|>=|<|>|=)?(.+)$/u.exec(comparator);
    const target = match && semVerPattern.exec(match[2]!);
    if (!match || !target) return false;
    const comparison = compareSemVer(version, target);
    switch (match[1] ?? '=') {
        case '<':
            return comparison < 0;
        case '<=':
            return comparison <= 0;
        case '>':
            return comparison > 0;
        case '>=':
            return comparison >= 0;
        default:
            return comparison === 0;
    }
}

export function isValidSemVer(version: string): boolean {
    return (
        version.length <= MAX_SEMVER_INPUT_LENGTH &&
        version.trim() === version &&
        semVerPattern.test(version)
    );
}

export function isValidSemVerRange(range: string): boolean {
    return range.length <= MAX_SEMVER_INPUT_LENGTH && normalizeRange(range) !== null;
}

/**
 * Applies the standard prerelease policy: a prerelease is admitted only by a
 * matching comparator set that names a prerelease with the same base tuple.
 */
export function satisfiesSemVer(version: string, range: string): boolean {
    if (
        version.length > MAX_SEMVER_INPUT_LENGTH ||
        range.length > MAX_SEMVER_INPUT_LENGTH ||
        version.trim() !== version
    ) {
        return false;
    }
    const parsedVersion = semVerPattern.exec(version);
    const normalized = normalizeRange(range);
    if (!parsedVersion || !normalized) return false;
    const prereleaseTuple = parsedVersion[4]
        ? `${parsedVersion[1]}.${parsedVersion[2]}.${parsedVersion[3]}`
        : null;
    return normalized.split(' || ').some((comparatorSet) => {
        if (
            !comparatorSet
                .split(' ')
                .every((comparator) => satisfiesComparator(parsedVersion, comparator))
        ) {
            return false;
        }
        if (prereleaseTuple === null) return true;
        return new RegExp(
            `(?:^|[<>=])${prereleaseTuple.replace(/\./gu, '\\.')}-[0-9A-Za-z-]`,
            'u',
        ).test(comparatorSet);
    });
}
