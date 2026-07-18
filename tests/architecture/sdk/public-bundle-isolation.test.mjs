import assert from 'node:assert/strict';
import test from 'node:test';

import { inspectPublicBundleIsolation } from '../../../scripts/check-public-bundle-isolation.mjs';

test('public bundle fixtures preserve attributed entry isolation', async () => {
    const result = await inspectPublicBundleIsolation();

    assert.equal(result.result, 'PASS');
    assert.deepEqual(result.summary, {
        fixturesMeasured: 30,
        featureCoreLeakage: 0,
        testingRuntimeLeakage: 0,
        conformancePluginRuntimeLeakage: 0,
        fabricBundledModules: 0,
        unattributedDuplicateHelpers: 0,
        unknownModules: 0,
    });
});
