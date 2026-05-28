/**
 * @file layout-conflict-warning.property.test.mjs
 *
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies src/image/layout-manager.ts conflict detection and the ImageEditor
 *   facade warning route when fitImageToCanvas and coverImageToCanvas are both
 *   enabled. The test keeps layout strategy logic and callback reporting in one
 *   focused suite.
 *
 * Scope:
 *   - detectLayoutConflict returns structured conflict data only for the fit plus
 *     cover pair.
 *   - Strategy precedence stays aligned with selectLayoutStrategy.
 *   - ImageEditor forwards a single onWarning callback with the public argument
 *     order.
 *
 * Out of scope:
 *   - browser layout engine differences
 *   - visual rendering quality
 *   - unrelated editor workflows
 *
 * Environment:
 *   - Node.js ESM
 *   - fast-check generated cases where applicable
 *   - Fabric/canvas behavior is mocked where needed
 *
 * Run:
 *   node --test tests/layout-conflict-warning.property.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on layout conflict warning only.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { detectLayoutConflict, selectLayoutStrategy } =
    await import('../src/image/layout-manager.ts');
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
    const onWarning = (error, message) => {
        calls.push({ error, message });
    };
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
    const onWarning = (error, message) => {
        calls.push({ error, message });
    };
    withSilencedConsoleError(() => {
        new ImageEditor(makeFakeFabric(), {
            fitImageToCanvas: true,
            coverImageToCanvas: false,
            onWarning,
        });
    });
    assert.equal(calls.length, 0);
});
