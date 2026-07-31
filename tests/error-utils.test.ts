import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeThrownError } from '../src/plugin-kernel/thrown-error.js';

test('thrown-value normalization preserves Errors and retains non-Error causes', () => {
    const existing = new Error('existing');
    assert.equal(normalizeThrownError(existing, 'fallback'), existing);

    const primitive = normalizeThrownError('failure', 'Non-Error failure.');
    assert.ok(primitive instanceof Error);
    assert.equal(primitive.message, 'Non-Error failure.');
    assert.equal(primitive.cause, 'failure');
    assert.equal(Object.keys(primitive).includes('cause'), false);
});
