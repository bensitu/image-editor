import assert from 'node:assert/strict';
import test from 'node:test';

import {
    FilterDefinitionError,
    normalizeFilterDefinitions,
} from '../../../src/plugins/filters/index.js';

test('supported definitions normalize into one deterministic immutable order', () => {
    const input = [
        { type: 'sharpen', value: 0.4 },
        { type: 'vintage' },
        { type: 'sepia' },
        { type: 'grayscale' },
        { type: 'blur', value: 0.25 },
        { type: 'saturation', value: -0.3 },
        { type: 'contrast', value: 0.2 },
        { type: 'brightness', value: 0.1 },
    ];
    const before = structuredClone(input);

    const normalized = normalizeFilterDefinitions(input);

    assert.deepEqual(
        normalized.map((definition) => definition.type),
        [
            'brightness',
            'contrast',
            'saturation',
            'grayscale',
            'sepia',
            'vintage',
            'blur',
            'sharpen',
        ],
    );
    assert.deepEqual(input, before);
    assert.equal(Object.isFrozen(normalized), true);
    assert.equal(normalized.every(Object.isFrozen), true);
});

test('neutral numeric definitions are removed without mutating caller input', () => {
    const input = [
        { type: 'brightness', value: -0 },
        { type: 'contrast', value: 0 },
        { type: 'blur', value: 0 },
        { type: 'sharpen', value: 0 },
    ];

    assert.deepEqual(normalizeFilterDefinitions(input), []);
    assert.equal(Object.is(input[0].value, -0), true);
});

test('definition validation rejects unknown types, invalid ranges, and non-finite values', () => {
    for (const definitions of [
        [{ type: 'pixelate', value: 4 }],
        [{ type: 'brightness', value: -1.01 }],
        [{ type: 'contrast', value: 1.01 }],
        [{ type: 'saturation', value: Number.NaN }],
        [{ type: 'blur', value: -0.01 }],
        [{ type: 'sharpen', value: Number.POSITIVE_INFINITY }],
    ]) {
        assert.throws(
            () => normalizeFilterDefinitions(definitions),
            (error) => error instanceof FilterDefinitionError,
        );
    }
});

test('strict validation rejects unknown keys, arbitrary matrices, and kernels', () => {
    for (const definition of [
        { type: 'brightness', value: 0.2, extra: true },
        { type: 'grayscale', value: true },
        { type: 'sharpen', value: 0.5, matrix: new Array(81).fill(1) },
        { type: 'blur', value: 0.2, kernel: new Array(81).fill(1) },
    ]) {
        assert.throws(() => normalizeFilterDefinitions([definition]), /unknown key/i);
    }
});

test('validation rejects prototype-pollution keys and non-plain definitions', () => {
    const dangerous = JSON.parse(
        '[{"type":"brightness","value":0.2,"__proto__":{"polluted":true}}]',
    );
    assert.throws(() => normalizeFilterDefinitions(dangerous), /dangerous key/i);

    const inherited = Object.create({ type: 'brightness' });
    inherited.value = 0.2;
    assert.throws(() => normalizeFilterDefinitions([inherited]), /plain object/i);

    const accessor = { type: 'brightness' };
    Object.defineProperty(accessor, 'value', {
        enumerable: true,
        get: () => {
            throw new Error('accessor must not execute');
        },
    });
    assert.throws(() => normalizeFilterDefinitions([accessor]), /must be a data property/i);

    const hidden = { type: 'brightness', value: 0.2 };
    Object.defineProperty(hidden, 'extra', { value: true });
    assert.throws(() => normalizeFilterDefinitions([hidden]), /unknown key/i);

    const symbolKey = { type: 'brightness', value: 0.2, [Symbol('extra')]: true };
    assert.throws(() => normalizeFilterDefinitions([symbolKey]), /symbol key/i);
});

test('validation enforces the configured count and rejects duplicate types', () => {
    assert.throws(
        () =>
            normalizeFilterDefinitions(
                [
                    { type: 'brightness', value: 0.2 },
                    { type: 'contrast', value: 0.2 },
                ],
                { maxFilterCount: 1 },
            ),
        /count exceeds 1/i,
    );
    assert.throws(
        () =>
            normalizeFilterDefinitions([
                { type: 'brightness', value: 0.2 },
                { type: 'brightness', value: 0.3 },
            ]),
        /duplicate filter type/i,
    );
    assert.throws(
        () =>
            normalizeFilterDefinitions([
                { type: 'brightness', value: 0 },
                { type: 'brightness', value: 0.3 },
            ]),
        /duplicate filter type/i,
    );
});
