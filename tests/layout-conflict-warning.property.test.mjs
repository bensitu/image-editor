// Layout conflict warning: when an integrator enables both
// `fitImageToCanvas` and `coverImageToCanvas` simultaneously, the editor
// emits a single `onWarning` callback with a clear message describing
// which strategy was actually selected.
//
// Owner module: `src/image/layout-manager.ts` — pure function
// `detectLayoutConflict(options)`. The facade calls it during option
// resolution and routes the result through `core/callback-reporter.ts`
// so the warning honors the documented `(error, message)` argument
// order on `onWarning`.
//
// Behaviors under test:
//
//   1. Conflict pair (fit + cover) — `detectLayoutConflict` returns a
//      structured result whose `selected` matches the precedence
//      `fit > cover > expand`.
//   2. Non-conflict combinations — `expand + fit`, `expand + cover`,
//      and any single-flag combination return `null`. `expandCanvasToImage`
//      defaults to `true` in `resolveOptions`, so combining it with one
//      of the other strategies is normal usage and is NOT flagged.
//   3. Warning routing — when the constructed editor sees the conflict,
//      it invokes `onWarning(null, message)` exactly once where
//      `message` mentions both `fit` and `cover`.

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { detectLayoutConflict, selectLayoutStrategy } = await import(
    '../src/image/layout-manager.ts'
);
const { ImageEditor } = await import('../src/image-editor.ts');

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeFakeFabric() {
    return { Canvas: function FakeCanvas() {} };
}

function withSilencedConsoleError(body) {
    const original = console.error;
    console.error = () => {};
    try {
        return body();
    } finally {
        console.error = original;
    }
}

// ─── 1. detectLayoutConflict — pair returns structured result ─────────────

const flagsArb = fc.record({
    fitImageToCanvas: fc.boolean(),
    coverImageToCanvas: fc.boolean(),
    expandCanvasToImage: fc.boolean(),
});

test('detectLayoutConflict flags fit + cover and reports the selected strategy', () => {
    fc.assert(
        fc.property(flagsArb, (flags) => {
            fc.pre(flags.fitImageToCanvas === true);
            fc.pre(flags.coverImageToCanvas === true);
            const conflict = detectLayoutConflict(flags);
            assert.ok(conflict, 'expected a conflict object for fit+cover');
            assert.equal(conflict.selected, selectLayoutStrategy(flags));
            assert.ok(conflict.enabled.includes('fit'));
            assert.ok(conflict.enabled.includes('cover'));
            assert.match(conflict.message, /fit/);
            assert.match(conflict.message, /cover/);
            return true;
        }),
        { numRuns: 50 },
    );
});

// ─── 2. detectLayoutConflict — non-conflict cases return null ─────────────

test('detectLayoutConflict returns null when at most one of fit/cover is enabled', () => {
    fc.assert(
        fc.property(flagsArb, (flags) => {
            fc.pre(!(flags.fitImageToCanvas && flags.coverImageToCanvas));
            assert.equal(detectLayoutConflict(flags), null);
            return true;
        }),
        { numRuns: 50 },
    );
});

// ─── 3. ImageEditor wires the warning through onWarning ──────────────────

test('ImageEditor reports the conflict via onWarning when fit and cover are both enabled', () => {
    const calls = [];
    const onWarning = (error, message) => { calls.push({ error, message }); };
    withSilencedConsoleError(() => {
        new ImageEditor(makeFakeFabric(), {
            fitImageToCanvas: true,
            coverImageToCanvas: true,
            onWarning,
        });
    });
    assert.equal(calls.length, 1);
    const [{ error, message }] = calls;
    assert.equal(error, null);
    assert.match(message, /fit/);
    assert.match(message, /cover/);
});

test('ImageEditor does not warn when only one layout flag is enabled', () => {
    const calls = [];
    const onWarning = (error, message) => { calls.push({ error, message }); };
    withSilencedConsoleError(() => {
        new ImageEditor(makeFakeFabric(), {
            fitImageToCanvas: true,
            coverImageToCanvas: false,
            onWarning,
        });
    });
    assert.equal(calls.length, 0);
});
