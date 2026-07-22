import assert from 'node:assert/strict';
import test from 'node:test';

import { StateCloneError } from '../../src/core-runtime/errors.js';
import { cloneStateValue } from '../../src/core-runtime/state/clone-state-value.js';

test('state cloning rejects dangerous keys even when structuredClone is available', () => {
    for (const key of ['__proto__', 'constructor', 'prototype']) {
        const value = JSON.parse(`{"nested":{"${key}":{"polluted":true}}}`);
        assert.throws(() => cloneStateValue(value), StateCloneError, key);
    }
    assert.equal(Object.prototype.polluted, undefined);
});

test('state cloning rejects accessors without invoking them', () => {
    let getterCalls = 0;
    const value = {};
    Object.defineProperty(value, 'secret', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return 'unexpected';
        },
    });

    assert.throws(() => cloneStateValue(value), /accessor property/i);
    assert.equal(getterCalls, 0);
});

test('state cloning preserves valid shared data while removing external aliases', () => {
    const shared = { count: 1 };
    const source = { first: shared, second: shared };
    const cloned = cloneStateValue(source);

    shared.count = 2;
    assert.equal(cloned.first.count, 1);
    assert.equal(cloned.first, cloned.second);
    assert.equal(Object.isFrozen(cloned), true);
    assert.equal(Object.isFrozen(cloned.first), true);
});
