/**
 * @file layout-precedence.property.test.mjs
 *
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies src/image/layout-manager.ts selectLayoutStrategy for every combination
 *   of fit, cover, and expand flags. The test locks down deterministic precedence
 *   independent of option key order.
 *
 * Scope:
 *   - fit wins over cover and expand.
 *   - cover wins when fit is disabled.
 *   - expand is the fallback when fit and cover are both disabled, including when all
 *     flags are false.
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
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on layout strategy precedence only.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { selectLayoutStrategy } = await import('../src/image/layout-manager.ts');

// ─── Arbitraries ───────────────────────────────────────────────────────────

// Each flag is an independent boolean. The arbitrary covers all eight
// combinations of (fit, cover, expand) uniformly when fast-check shrinks.
const flagsArb = fc.record({
    fitImageToCanvas: fc.boolean(),
    coverImageToCanvas: fc.boolean(),
    expandCanvasToImage: fc.boolean(),
});

// ─── fit wins ────────────────────────────────────────────────

test("fitImageToCanvas=true => 'fit' regardless of other flags", () => {
    fc.assert(
        fc.property(flagsArb, (flags) => {
            fc.pre(flags.fitImageToCanvas === true);

            const out = selectLayoutStrategy(flags);
            assert.equal(out, 'fit', `expected 'fit' for ${JSON.stringify(flags)}`);
            return true;
        }),
        { numRuns: 100 },
    );
});

// ─── cover wins next ─────────────────────────────────────────

test("fit=false, cover=true => 'cover' regardless of expand", () => {
    fc.assert(
        fc.property(flagsArb, (flags) => {
            fc.pre(flags.fitImageToCanvas === false);
            fc.pre(flags.coverImageToCanvas === true);

            const out = selectLayoutStrategy(flags);
            assert.equal(out, 'cover', `expected 'cover' for ${JSON.stringify(flags)}`);
            return true;
        }),
        { numRuns: 100 },
    );
});

// ─── expand selected ─────────────────────────────────────────

test("fit=false, cover=false, expand=true => 'expand'", () => {
    fc.assert(
        fc.property(flagsArb, (flags) => {
            fc.pre(flags.fitImageToCanvas === false);
            fc.pre(flags.coverImageToCanvas === false);
            fc.pre(flags.expandCanvasToImage === true);

            const out = selectLayoutStrategy(flags);
            assert.equal(out, 'expand', `expected 'expand' for ${JSON.stringify(flags)}`);
            return true;
        }),
        { numRuns: 100 },
    );
});

// ─── all-false fallback ──────────────────────────────────────

test("all flags false => 'expand' fallback", () => {
    const out = selectLayoutStrategy({
        fitImageToCanvas: false,
        coverImageToCanvas: false,
        expandCanvasToImage: false,
    });
    assert.equal(out, 'expand', "all-false must fall back to 'expand'");
});

// ─── determinism (key order + repeat invocation) ─────────────

test('selection is deterministic across key order and repeat calls', () => {
    fc.assert(
        fc.property(flagsArb, (flags) => {
            // Build a permuted copy with reversed property declaration order.
            const reordered = {
                expandCanvasToImage: flags.expandCanvasToImage,
                coverImageToCanvas: flags.coverImageToCanvas,
                fitImageToCanvas: flags.fitImageToCanvas,
            };

            const a = selectLayoutStrategy(flags);
            const b = selectLayoutStrategy(reordered);
            const c = selectLayoutStrategy(flags);

            assert.equal(
                a,
                b,
                `key order changed result: ${JSON.stringify(flags)} -> ${a} ` +
                    `vs reordered -> ${b}`,
            );
            assert.equal(
                a,
                c,
                `repeat call changed result for ${JSON.stringify(flags)}: ` + `${a} -> ${c}`,
            );
            return true;
        }),
        { numRuns: 100 },
    );
});
