const MAX_RUNTIME_IDENTIFIER_LENGTH = 128;
const RUNTIME_IDENTIFIER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const prohibitedRuntimeIdentifierSegments = new Set(['__proto__', 'constructor', 'prototype']);
export function isRuntimeIdentifier(value) {
    return (typeof value === 'string' &&
        value.length <= MAX_RUNTIME_IDENTIFIER_LENGTH &&
        RUNTIME_IDENTIFIER_PATTERN.test(value) &&
        !value.split(':').some((segment) => prohibitedRuntimeIdentifierSegments.has(segment)));
}
//# sourceMappingURL=runtime-identifier.js.map