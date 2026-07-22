import assert from 'node:assert/strict';
import test from 'node:test';

import { isPixelAreaWithinBudget } from '../../src/utils/image-budget.js';

test('pixel budget validation avoids unsafe multiplication', () => {
    assert.equal(isPixelAreaWithinBudget(100, 50, 5_000), true);
    assert.equal(isPixelAreaWithinBudget(100, 51, 5_000), false);
    assert.equal(isPixelAreaWithinBudget(100_000_000, 100_000_000, Number.MAX_SAFE_INTEGER), false);
    assert.equal(isPixelAreaWithinBudget(1.5, 10, 100), false);
});
