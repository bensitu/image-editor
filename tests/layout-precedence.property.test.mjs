// Property 5: Layout precedence determinism
//
// Property statement (design.md §"Property 5"):
//   For any combination of `fitImageToCanvas`, `coverImageToCanvas`, and
//   `expandCanvasToImage`, exactly one layout mode SHALL be selected
//   using the precedence `fit > cover > expand > fallback`. The selected
//   mode SHALL not depend on object-key order, previous loads, or prior
//   canvas state.
//
// Owner module: `src/image/layout-manager.ts` — pure function
// `selectLayoutStrategy(options)` consumes only the three boolean flags
// from `ResolvedOptions` and returns one of `'fit' | 'cover' | 'expand'`.
//
// Sub-properties exercised here:
//
//   5.1 `fit` wins (Req 9.1): when `fitImageToCanvas` is true, output
//       === 'fit' regardless of the other two flags.
//   5.2 `cover` wins next (Req 9.2): when `fitImageToCanvas` is false
//       and `coverImageToCanvas` is true, output === 'cover' regardless
//       of `expandCanvasToImage`.
//   5.3 `expand` selected (Req 9.3): when `fit` and `cover` are false
//       and `expandCanvasToImage` is true, output === 'expand'.
//   5.4 All-false fallback (Req 9.3): when every flag is false, output
//       === 'expand'. This matches the documented default-options
//       resolution and gives a deterministic answer if a consumer
//       disables every layout flag.
//   5.5 Determinism: selection depends only on the three boolean flag
//       values — not on object-key order and not on prior calls.
//
// Runtime note: Node 24+ strips TypeScript syntax natively, so the test
// imports the module under test directly from source — no separate build
// step is required. `selectLayoutStrategy` is a pure function with no
// DOM dependency, so the property test runs without jsdom.
//
// `layout-manager.ts` carries runtime `.js`-suffixed imports to sibling
// `.ts` modules (the project compiles for browsers under
// `moduleResolution: "bundler"`). Node's native type stripping does not
// rewrite those specifiers, so we register the shared resolve hook that
// maps relative `.js` requests to `.ts` when the sibling source file
// exists. The layout manager is pulled in via dynamic `import()` so the
// resolver is in place before its specifier is resolved.

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { selectLayoutStrategy } = await import(
    '../src/image/layout-manager.ts'
);

// ─── Arbitraries ───────────────────────────────────────────────────────────

// Each flag is an independent boolean. The arbitrary covers all eight
// combinations of (fit, cover, expand) uniformly when fast-check shrinks.
const flagsArb = fc.record({
    fitImageToCanvas: fc.boolean(),
    coverImageToCanvas: fc.boolean(),
    expandCanvasToImage: fc.boolean(),
});

// ─── Property 5.1: fit wins ────────────────────────────────────────────────

test("Property 5.1: fitImageToCanvas=true => 'fit' regardless of other flags (Req 9.1)", () => {
    fc.assert(
        fc.property(flagsArb, (flags) => {
            fc.pre(flags.fitImageToCanvas === true);

            const out = selectLayoutStrategy(flags);
            assert.equal(
                out,
                'fit',
                `expected 'fit' for ${JSON.stringify(flags)}`,
            );
            return true;
        }),
        { numRuns: 100 },
    );
});

// ─── Property 5.2: cover wins next ─────────────────────────────────────────

test("Property 5.2: fit=false, cover=true => 'cover' regardless of expand (Req 9.2)", () => {
    fc.assert(
        fc.property(flagsArb, (flags) => {
            fc.pre(flags.fitImageToCanvas === false);
            fc.pre(flags.coverImageToCanvas === true);

            const out = selectLayoutStrategy(flags);
            assert.equal(
                out,
                'cover',
                `expected 'cover' for ${JSON.stringify(flags)}`,
            );
            return true;
        }),
        { numRuns: 100 },
    );
});

// ─── Property 5.3: expand selected ─────────────────────────────────────────

test("Property 5.3: fit=false, cover=false, expand=true => 'expand' (Req 9.3)", () => {
    fc.assert(
        fc.property(flagsArb, (flags) => {
            fc.pre(flags.fitImageToCanvas === false);
            fc.pre(flags.coverImageToCanvas === false);
            fc.pre(flags.expandCanvasToImage === true);

            const out = selectLayoutStrategy(flags);
            assert.equal(
                out,
                'expand',
                `expected 'expand' for ${JSON.stringify(flags)}`,
            );
            return true;
        }),
        { numRuns: 100 },
    );
});

// ─── Property 5.4: all-false fallback ──────────────────────────────────────

test("Property 5.4: all flags false => 'expand' fallback (Req 9.3)", () => {
    const out = selectLayoutStrategy({
        fitImageToCanvas: false,
        coverImageToCanvas: false,
        expandCanvasToImage: false,
    });
    assert.equal(out, 'expand', "all-false must fall back to 'expand'");
});

// ─── Property 5.5: determinism (key order + repeat invocation) ─────────────

test('Property 5.5: selection is deterministic across key order and repeat calls', () => {
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
                `repeat call changed result for ${JSON.stringify(flags)}: ` +
                    `${a} -> ${c}`,
            );
            return true;
        }),
        { numRuns: 100 },
    );
});
