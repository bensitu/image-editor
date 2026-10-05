import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { validatePlatformBudget } from '../../scripts/check-platform-budget.mjs';

const policy = JSON.parse(
    await readFile(new URL('../../config/bundle/platform-budget.json', import.meta.url), 'utf8'),
);

function measurement(gzipBytes, extraModules = []) {
    return {
        fixtures: {
            'platform-anchor': {
                gzipBytes,
                modules: [
                    'tests/bundle/fixtures/platform-anchor/index.mjs',
                    'dist/esm/core/index.js',
                    ...extraModules,
                ],
            },
        },
    };
}

test('platform budget accepts the Rolldown 1.2.12 gzip measurement', async () => {
    const result = await validatePlatformBudget(measurement(61453));
    assert.equal(result.gzipBytes, 61453);
});

test('platform budget accepts its boundary and rejects one byte above it', async () => {
    await validatePlatformBudget(measurement(policy.maximumGzipBytes));
    await assert.rejects(
        validatePlatformBudget(measurement(policy.maximumGzipBytes + 1)),
        /Platform anchor gzip size .* exceeds/,
    );
});

test('platform budget still rejects forbidden modules below the size limit', async () => {
    const forbiddenModules = [
        ['node_modules/fabric/index.js', 'fabricModules'],
        ['dist/esm/testing/index.js', 'testingModules'],
        ['examples/reference-plugins/watermark/index.js', 'referencePluginModules'],
        ['dist/esm/plugins/crop/index.js', 'optionalFeatureModules'],
        ['dist/esm/presets/full/index.js', 'presetModules'],
        ['node_modules/unexpected/index.js', 'unknownModules'],
    ];
    for (const [moduleId, countName] of forbiddenModules) {
        await assert.rejects(
            validatePlatformBudget(measurement(61453, [moduleId])),
            new RegExp(`${countName} is 1; at most 0 is allowed`),
        );
    }
});
