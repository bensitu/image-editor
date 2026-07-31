import assert from 'node:assert/strict';
import test from 'node:test';

import { checkTestingIsolation } from '../../scripts/check-testing-isolation.mjs';

test('runtime entries cannot reach testing implementation modules', async () => {
    const result = await checkTestingIsolation();
    assert.ok(result.sourceModules > 0);
    assert.deepEqual(result.failures, []);
});
