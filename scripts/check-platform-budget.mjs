/**
 * Validates the live platform bundle against stable size and isolation limits.
 *
 * @module
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsRoot, '..');
const policyPath = path.join(repositoryRoot, 'config', 'bundle', 'platform-budget.json');
const optionalFeaturePrefixes = Object.freeze([
    'dist/esm/foundations/annotation/',
    'dist/esm/mask/',
    'dist/esm/plugins/annotation-draw/',
    'dist/esm/plugins/annotation-shape/',
    'dist/esm/plugins/annotation-text/',
    'dist/esm/plugins/crop/',
    'dist/esm/plugins/dom-controls/',
    'dist/esm/plugins/filters/',
    'dist/esm/plugins/mask/',
    'dist/esm/plugins/mosaic/',
    'dist/esm/plugins/overlay-state/',
]);

function assertCondition(condition, message) {
    if (!condition) throw new Error(message);
}

function countMatching(modules, predicate) {
    return modules.filter(predicate).length;
}

/** Validates a measurement produced by the live bundle harness. */
export async function validatePlatformBudget(measurement) {
    const policy = JSON.parse(await readFile(policyPath, 'utf8'));
    const anchor = measurement.fixtures?.['platform-anchor'];
    assertCondition(anchor, 'Live measurement is missing the platform-anchor fixture.');
    assertCondition(policy.schemaVersion === 1, 'Platform budget schema is invalid.');
    assertCondition(
        anchor.gzipBytes <= policy.maximumGzipBytes,
        `Platform anchor gzip size ${anchor.gzipBytes} exceeds ${policy.maximumGzipBytes}.`,
    );

    const modules = anchor.modules.map((moduleId) => moduleId.replaceAll('\\', '/'));
    const counts = Object.freeze({
        fabricModules: countMatching(modules, (moduleId) =>
            /(?:^|\/)node_modules\/fabric(?:\/|$)/u.test(moduleId),
        ),
        testingModules: countMatching(
            modules,
            (moduleId) =>
                moduleId.includes('/testing/') ||
                moduleId.includes('plugin-conformance') ||
                moduleId.includes('responsibility-assertions'),
        ),
        referencePluginModules: countMatching(modules, (moduleId) =>
            moduleId.startsWith('examples/reference-plugins/'),
        ),
        optionalFeatureModules: countMatching(modules, (moduleId) =>
            optionalFeaturePrefixes.some((prefix) => moduleId.startsWith(prefix)),
        ),
        presetModules: countMatching(modules, (moduleId) =>
            moduleId.startsWith('dist/esm/presets/'),
        ),
        unknownModules: countMatching(
            modules,
            (moduleId) =>
                !moduleId.startsWith('dist/esm/') &&
                moduleId !== 'tests/bundle/fixtures/platform-anchor/index.mjs',
        ),
    });

    for (const [name, count] of Object.entries(counts)) {
        const allowed = policy[`${name}Allowed`];
        assertCondition(Number.isInteger(allowed) && allowed >= 0, `${name} limit is invalid.`);
        assertCondition(count <= allowed, `${name} is ${count}; at most ${allowed} is allowed.`);
    }
    return Object.freeze({ gzipBytes: anchor.gzipBytes, ...counts });
}
