/**
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies src/image/layout-manager.ts selectLayoutStrategy maps the
 *   canonical layout mode directly to the load strategy.
 *
 * Scope:
 *   - fit maps to fit.
 *   - cover maps to cover.
 *   - expand maps to expand.
 *   - selection is deterministic across repeat calls.
 *
 * Out of scope:
 *   - browser layout engine differences
 *   - visual rendering quality
 *   - unrelated editor workflows
 *
 * Environment:
 *   - Node.js ESM
 *   - fast-check generated cases where applicable
 *
 * Run:
 *   node --test tests/layout-precedence.property.test.mjs
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { selectLayoutStrategy } = await import('../src/image/layout-manager.ts');

const layoutModeArb = fc.constantFrom('fit', 'cover', 'expand');

test('layout mode maps directly to the selected strategy', () => {
    fc.assert(
        fc.property(layoutModeArb, (mode) => {
            assert.equal(selectLayoutStrategy(mode), mode);
        }),
        { numRuns: 30 },
    );
});

test('selection is deterministic across repeat calls', () => {
    fc.assert(
        fc.property(layoutModeArb, (mode) => {
            const first = selectLayoutStrategy(mode);
            const second = selectLayoutStrategy(mode);
            const third = selectLayoutStrategy(mode);

            assert.equal(first, second);
            assert.equal(first, third);
        }),
        { numRuns: 30 },
    );
});
