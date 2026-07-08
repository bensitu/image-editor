/**
 * Type:
 *   Unit test
 *
 * Purpose:
 *   Verifies defensive validation for the public overlay-state wire format.
 *
 * Run:
 *   node --test tests/overlay-state-validation.test.mjs
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { validateOverlayState } = await import('../src/overlay/overlay-state-validator.ts');

function validState(overrides = {}) {
    return {
        schema: 'image-editor.overlay-state',
        version: 1,
        image: { naturalWidth: 100, naturalHeight: 80, mimeType: 'image/png' },
        coordinateSpace: 'image-normalized',
        overlays: [
            {
                kind: 'mask',
                id: 'mask-a',
                maskShape: 'rect',
                geometry: { type: 'rect', x: 0.1, y: 0.2, width: 0.3, height: 0.25 },
                style: { fill: 'rgba(255,0,0,0.5)', alpha: 0.5, stroke: '#0f0' },
            },
        ],
        ...overrides,
    };
}

test('validateOverlayState accepts valid overlay-state schema version 1 state and normalizes colors', () => {
    const result = validateOverlayState(validState());

    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
    assert.equal(result.state.overlays[0].style.fill, '#FF000080');
    assert.equal(result.state.overlays[0].style.stroke, '#00FF00');
});

test('validateOverlayState rejects unsupported future overlay-state schema versions clearly', () => {
    const result = validateOverlayState(validState({ version: 2 }));

    assert.equal(result.valid, false);
    assert.equal(result.errors[0].code, 'state.futureVersion');
});

test('validateOverlayState rejects oversized overlay arrays', () => {
    const result = validateOverlayState(
        validState({
            overlays: [validState().overlays[0], validState().overlays[0]],
        }),
        { maxOverlays: 1 },
    );

    assert.equal(result.valid, false);
    assert.equal(
        result.errors.some((error) => error.code === 'overlays.max'),
        true,
    );
});

test('unknown custom overlays are valid but warn that import will skip them', () => {
    const result = validateOverlayState(
        validState({
            overlays: [
                {
                    kind: 'custom',
                    id: 'custom-a',
                    customType: 'app.demo.widget',
                    data: { value: 1 },
                },
            ],
        }),
    );

    assert.equal(result.valid, true);
    assert.equal(
        result.warnings.some((warning) => warning.code === 'custom.unknownType'),
        true,
    );
});

test('cyclic input is rejected before JSON normalization', () => {
    const state = validState();
    state.metadata = { 'app.demo': {} };
    state.metadata['app.demo'].self = state.metadata;

    const result = validateOverlayState(state);

    assert.equal(result.valid, false);
    assert.equal(result.errors[0].code, 'state.cyclic');
});

test('draw total point limit counts only normalized valid points', () => {
    const result = validateOverlayState(
        validState({
            overlays: [
                {
                    kind: 'annotation',
                    annotationType: 'draw',
                    id: 'draw-a',
                    strokes: [
                        {
                            id: 'stroke-a',
                            points: [{ x: 0.1, y: 0.1 }, { x: 'bad', y: 0.2 }, { x: 0.3 }],
                            brush: { color: '#000000', width: 2 },
                        },
                    ],
                },
            ],
        }),
        { maxDrawTotalPoints: 1, maxDrawPointsPerStroke: 10 },
    );

    assert.equal(result.valid, false);
    assert.equal(
        result.errors.some((error) => error.code === 'number.invalid'),
        true,
    );
    assert.equal(
        result.errors.some((error) => error.code === 'number.required'),
        true,
    );
    assert.equal(
        result.errors.some((error) => error.code === 'draw.points.maxTotal'),
        false,
    );
});
