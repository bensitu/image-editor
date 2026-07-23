/**
 * Validates package source maps without retaining bundled source text.
 *
 * @module
 */

import path from 'node:path';

/**
 * Inspect one parsed source map according to the package artifact policy.
 *
 * @param {unknown} value
 * @param {string} fileName
 * @returns {string[]}
 */
export function inspectPackagedSourceMap(value, fileName) {
    const failures = [];
    if (!value || typeof value !== 'object') {
        return [`npm pack source map ${fileName} is not a JSON object.`];
    }

    const sourceMap = /** @type {Record<string, unknown>} */ (value);
    if (!Array.isArray(sourceMap.sources)) {
        return [`npm pack source map ${fileName} has no sources array.`];
    }

    const mappedPaths = [
        ...sourceMap.sources,
        ...(typeof sourceMap.sourceRoot === 'string' && sourceMap.sourceRoot.length > 0
            ? [sourceMap.sourceRoot]
            : []),
    ];
    for (const sourcePath of mappedPaths) {
        if (
            typeof sourcePath !== 'string' ||
            path.isAbsolute(sourcePath) ||
            /^[A-Za-z]:[\\/]/u.test(sourcePath) ||
            sourcePath.startsWith('file:')
        ) {
            failures.push(`npm pack source map ${fileName} contains a local absolute source.`);
            break;
        }
    }

    if (
        sourceMap.sourcesContent !== undefined &&
        sourceMap.sourcesContent !== null &&
        !Array.isArray(sourceMap.sourcesContent)
    ) {
        failures.push(`npm pack source map ${fileName} has invalid sourcesContent metadata.`);
    } else if (
        Array.isArray(sourceMap.sourcesContent) &&
        sourceMap.sourcesContent.some(
            (content) => typeof content === 'string' && content.length > 0,
        )
    ) {
        failures.push(`npm pack source map ${fileName} embeds source content.`);
    }

    return failures;
}
