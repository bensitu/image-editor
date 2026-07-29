import assert from 'node:assert/strict';
import test from 'node:test';

import { base64PayloadByteLength } from '../src/utils/base64-payload.js';

test('Base64 payload byte length handles empty, unpadded, and padded values', () => {
    assert.equal(base64PayloadByteLength(''), 0);
    assert.equal(base64PayloadByteLength('QUJD'), 3);
    assert.equal(base64PayloadByteLength('QUI'), 2);
    assert.equal(base64PayloadByteLength('QUI='), 2);
    assert.equal(base64PayloadByteLength('QQ=='), 1);
});

test('Base64 payload byte length rejects malformed lengths, padding, and URL-safe input', () => {
    for (const payload of ['A', 'QQ=', 'QQ===', '=AAA', 'QQ==A', 'AA-A', 'AA_A', 'Q Q = =']) {
        assert.throws(() => base64PayloadByteLength(payload), payload);
    }
});
