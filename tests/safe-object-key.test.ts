/** Verifies the shared prototype-pollution key policy. */

import assert from 'node:assert/strict';
import test from 'node:test';

import { isDangerousStateKey as isUnsafeObjectKey } from '../src/plugin-kernel/plugin-identifier.ts';

test('unsafe object key policy rejects prototype mutation keys only', () => {
    for (const key of ['__proto__', 'constructor', 'prototype']) {
        assert.equal(isUnsafeObjectKey(key), true, key);
    }
    for (const key of ['prototypeValue', 'safe', 'toString']) {
        assert.equal(isUnsafeObjectKey(key), false, key);
    }
});
