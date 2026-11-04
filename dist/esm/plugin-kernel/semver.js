const numericIdentifier = '(?:0|[1-9]\\d*)';
const prereleaseIdentifier = `(?:${numericIdentifier}|\\d*[A-Za-z-][0-9A-Za-z-]*)`;
const semVerPattern = new RegExp(`^(${numericIdentifier})\\.(${numericIdentifier})\\.(${numericIdentifier})(?:-(${prereleaseIdentifier}(?:\\.${prereleaseIdentifier})*))?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`, 'u');
const partialVersionPattern = new RegExp(`^(${numericIdentifier})(?:\\.(${numericIdentifier}|[xX*]))?(?:\\.(${numericIdentifier}|[xX*]))?$`, 'u');
const comparatorPattern = /^(<=|>=|<|>|=|~|\^)?(.+)$/u;
const MAX_SEMVER_INPUT_LENGTH = 256;
function parseRangeVersion(value) {
    const exact = semVerPattern.exec(value);
    if (exact) {
        return {
            major: exact[1],
            minor: exact[2],
            patch: exact[3],
            exact: value,
        };
    }
    const partial = partialVersionPattern.exec(value);
    if (!partial)
        return null;
    const minor = partial[2];
    const patch = partial[3];
    return {
        major: partial[1],
        minor: minor === undefined || /[xX*]/u.test(minor) ? null : minor,
        patch: patch === undefined || /[xX*]/u.test(patch) ? null : patch,
        exact: null,
    };
}
function incrementNumeric(value) {
    const digits = value.split('');
    for (let index = digits.length - 1; index >= 0; index -= 1) {
        if (digits[index] !== '9') {
            digits[index] = String(Number(digits[index]) + 1);
            return digits.join('');
        }
        digits[index] = '0';
    }
    return `1${digits.join('')}`;
}
function lowerBound(version) {
    var _a, _b;
    return `${version.major}.${(_a = version.minor) !== null && _a !== void 0 ? _a : 0}.${(_b = version.patch) !== null && _b !== void 0 ? _b : 0}`;
}
function exclusiveUpperBound(version) {
    return version.minor === null
        ? `${incrementNumeric(version.major)}.0.0`
        : `${version.major}.${incrementNumeric(version.minor)}.0`;
}
function caretUpperBound(version) {
    if (version.major !== '0' || version.minor === null)
        return `${incrementNumeric(version.major)}.0.0`;
    if (version.minor !== '0' || version.patch === null)
        return `0.${incrementNumeric(version.minor)}.0`;
    return `0.0.${incrementNumeric(version.patch)}`;
}
function normalizeComparator(token) {
    var _a, _b;
    if (/^[xX*]$/u.test(token))
        return ['>=0.0.0'];
    const match = comparatorPattern.exec(token);
    if (!match)
        return null;
    const operator = (_a = match[1]) !== null && _a !== void 0 ? _a : '';
    if (/^[xX*]$/u.test(match[2]))
        return ['<', '>'].includes(operator) ? ['<0.0.0-0'] : ['>=0.0.0'];
    const version = parseRangeVersion(match[2]);
    if (!version)
        return null;
    const lower = (_b = version.exact) !== null && _b !== void 0 ? _b : lowerBound(version);
    if (operator === '^')
        return [`>=${lower}`, `<${caretUpperBound(version)}-0`];
    if (operator === '~')
        return [`>=${lower}`, `<${exclusiveUpperBound(version)}-0`];
    if (version.exact !== null)
        return [`${operator}${version.exact}`];
    const upper = exclusiveUpperBound(version);
    if (operator === '>')
        return [`>=${upper}`];
    if (operator === '<=')
        return [`<${upper}-0`];
    if (operator === '<')
        return [`<${lower}-0`];
    if (operator === '>=')
        return [`>=${lower}`];
    return [`>=${lower}`, `<${upper}-0`];
}
function normalizeComparatorSet(value) {
    var _a;
    const hyphen = /^(\S+)\s+-\s+(\S+)$/u.exec(value);
    if (hyphen) {
        const lower = parseRangeVersion(hyphen[1]);
        const upper = parseRangeVersion(hyphen[2]);
        if (!lower || !upper)
            return null;
        return `>=${(_a = lower.exact) !== null && _a !== void 0 ? _a : lowerBound(lower)} ${upper.exact === null ? `<${exclusiveUpperBound(upper)}-0` : `<=${upper.exact}`}`;
    }
    const normalized = [];
    for (const token of value.split(/\s+/u).filter(Boolean)) {
        const comparators = normalizeComparator(token);
        if (!comparators)
            return null;
        normalized.push(...comparators);
    }
    return normalized.length === 0 ? null : normalized.join(' ');
}
function normalizeRange(range) {
    if (range.length === 0 || range.trim() !== range)
        return null;
    const sets = range
        .replace(/([><=~^]+)\s+/gu, '$1')
        .split('||')
        .map((entry) => entry.trim());
    if (sets.some((entry) => entry.length === 0))
        return null;
    const normalized = sets.map(normalizeComparatorSet);
    return normalized.some((entry) => entry === null) ? null : normalized.join(' || ');
}
function compareNumeric(left, right) {
    return left.length === right.length
        ? left === right
            ? 0
            : left < right
                ? -1
                : 1
        : left.length < right.length
            ? -1
            : 1;
}
function compareSemVer(left, right) {
    var _a, _b, _c, _d;
    for (let index = 1; index <= 3; index += 1) {
        const comparison = compareNumeric(left[index], right[index]);
        if (comparison !== 0)
            return comparison;
    }
    const leftPrerelease = (_b = (_a = left[4]) === null || _a === void 0 ? void 0 : _a.split('.')) !== null && _b !== void 0 ? _b : [];
    const rightPrerelease = (_d = (_c = right[4]) === null || _c === void 0 ? void 0 : _c.split('.')) !== null && _d !== void 0 ? _d : [];
    if (leftPrerelease.length === 0 || rightPrerelease.length === 0) {
        return leftPrerelease.length === rightPrerelease.length
            ? 0
            : leftPrerelease.length === 0
                ? 1
                : -1;
    }
    for (let index = 0; index < Math.max(leftPrerelease.length, rightPrerelease.length); index += 1) {
        const leftIdentifier = leftPrerelease[index];
        const rightIdentifier = rightPrerelease[index];
        if (leftIdentifier === undefined || rightIdentifier === undefined) {
            return leftIdentifier === rightIdentifier ? 0 : leftIdentifier === undefined ? -1 : 1;
        }
        if (leftIdentifier === rightIdentifier)
            continue;
        const leftIsNumeric = /^\d+$/u.test(leftIdentifier);
        const rightIsNumeric = /^\d+$/u.test(rightIdentifier);
        if (leftIsNumeric && rightIsNumeric) {
            return compareNumeric(leftIdentifier, rightIdentifier);
        }
        if (leftIsNumeric !== rightIsNumeric)
            return leftIsNumeric ? -1 : 1;
        return leftIdentifier < rightIdentifier ? -1 : 1;
    }
    return 0;
}
function satisfiesComparator(version, comparator) {
    var _a;
    const match = /^(<=|>=|<|>|=)?(.+)$/u.exec(comparator);
    const target = match && semVerPattern.exec(match[2]);
    if (!match || !target)
        return false;
    const comparison = compareSemVer(version, target);
    switch ((_a = match[1]) !== null && _a !== void 0 ? _a : '=') {
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
export function isValidSemVer(version) {
    return (version.length <= MAX_SEMVER_INPUT_LENGTH &&
        version.trim() === version &&
        semVerPattern.test(version));
}
export function isValidSemVerRange(range) {
    return range.length <= MAX_SEMVER_INPUT_LENGTH && normalizeRange(range) !== null;
}
export function satisfiesSemVer(version, range) {
    if (version.length > MAX_SEMVER_INPUT_LENGTH ||
        range.length > MAX_SEMVER_INPUT_LENGTH ||
        version.trim() !== version) {
        return false;
    }
    const parsedVersion = semVerPattern.exec(version);
    const normalized = normalizeRange(range);
    if (!parsedVersion || !normalized)
        return false;
    return normalized.split(' || ').some((comparatorSet) => {
        const comparators = comparatorSet.split(' ');
        if (!comparators.every((comparator) => satisfiesComparator(parsedVersion, comparator))) {
            return false;
        }
        if (parsedVersion[4] === undefined)
            return true;
        return comparators.some((comparator) => {
            const match = comparatorPattern.exec(comparator);
            const target = match && semVerPattern.exec(match[2]);
            return (target !== null &&
                target[4] !== undefined &&
                target[1] === parsedVersion[1] &&
                target[2] === parsedVersion[2] &&
                target[3] === parsedVersion[3]);
        });
    });
}
//# sourceMappingURL=semver.js.map