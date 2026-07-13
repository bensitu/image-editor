import assert from 'node:assert/strict';
import test from 'node:test';

import {
    findUnclassifiedValues,
    validatePolicyCoverage,
} from '../scripts/check-full-facade-ownership.mjs';

test('ownership coverage accepts an exact one-to-one policy', () => {
    const generated = [{ id: 'alpha' }, { id: 'beta' }];
    const policy = [{ id: 'beta' }, { id: 'alpha' }];

    assert.deepEqual(validatePolicyCoverage(generated, policy, 'fixture'), []);
});

test('ownership coverage rejects missing, duplicate, and orphan entries', () => {
    const generated = [{ id: 'alpha' }, { id: 'alpha' }, { id: 'beta' }];
    const policy = [{ id: 'alpha' }, { id: 'orphan' }];
    const errors = validatePolicyCoverage(generated, policy, 'fixture');

    assert.ok(errors.some((error) => error.includes('generated ID alpha appears 2 times')));
    assert.ok(errors.some((error) => error.includes('must cover beta exactly once')));
    assert.ok(errors.some((error) => error.includes('orphan policy entry orphan')));
});

test('unclassified scanning reports nested policy gaps', () => {
    assert.deepEqual(findUnclassifiedValues({ entries: [{ owner: 'CORE' }] }), []);
    assert.deepEqual(findUnclassifiedValues({ entries: [{ owner: 'UNCLASSIFIED' }] }), [
        '$.entries[0].owner contains UNCLASSIFIED.',
    ]);
});
