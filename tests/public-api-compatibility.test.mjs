import assert from 'node:assert/strict';
import test from 'node:test';

import { compareNamedSets } from '../scripts/check-public-api-compatibility.mjs';

test('public API set comparison accepts an exact contract', () => {
    assert.deepEqual(
        compareNamedSets('fixture', new Set(['alpha', 'beta']), new Set(['beta', 'alpha'])),
        [],
    );
});

test('public API set comparison reports additions and removals', () => {
    assert.deepEqual(
        compareNamedSets('fixture', new Set(['alpha', 'added']), new Set(['alpha', 'missing'])),
        ['fixture missing: missing', 'fixture added: added'],
    );
});
