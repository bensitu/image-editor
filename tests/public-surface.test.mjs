/**
 * @file public-surface.test.mjs
 *
 * Type:
 *   Smoke test
 *
 * Purpose:
 *   Verifies src/image-editor.ts and src/index.ts public runtime shape by importing
 *   source with a minimal Fabric stub. The suite focuses on API presence and barrel
 *   cleanliness rather than behavior of individual methods.
 *
 * Scope:
 *   - ImageEditor default and named exports resolve to the same class.
 *   - isMaskObject is the only additional runtime value exposed from the barrel.
 *   - The documented public method set exists on ImageEditor.prototype and internal
 *     helpers stay hidden.
 *
 * Out of scope:
 *   - feature behavior inside ImageEditor methods
 *   - browser rendering behavior
 *   - private implementation refactors
 *
 * Environment:
 *   - Node.js ESM
 *   - Fabric/canvas behavior is mocked where needed
 *
 * Run:
 *   node --test tests/public-surface.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on canonical ImageEditor public surface only.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';

const barrel = await import('../src/index.ts');
const { ImageEditor: NamedImageEditor, isMaskObject } = barrel;
const DefaultImageEditor = barrel.default;

// ─── Constants from the documented contract ─────────────────────────────────────────

/**
 * Canonical public methods listed in the documented contract. Every entry must
 * resolve to a function on `ImageEditor.prototype`.
 */
const CANONICAL_METHODS = Object.freeze([
    'init',
    'dispose',
    'loadImage',
    'isImageLoaded',
    'isBusy',
    'scaleImage',
    'rotateImage',
    'resetImageTransform',
    'createMask',
    'removeSelectedMask',
    'removeAllMasks',
    'enterCropMode',
    'cancelCrop',
    'applyCrop',
    'mergeMasks',
    'exportImageBase64',
    'exportImageFile',
    'downloadImage',
    'saveState',
    'loadFromState',
    'undo',
    'redo',
]);

/**
 * Internal helpers that must NOT leak through the package root. The list
 * includes every helper that should remain an implementation detail:
 * `AnimationQueue`, `Command`, `HistoryManager`, plus the broader
 * controller/service/manager/utility categories that gate the rest of the
 * module tree.
 */
const FORBIDDEN_INTERNAL_NAMES = Object.freeze([
    // Named primitives
    'AnimationQueue',
    'Command',
    'HistoryManager',
    'OperationGuard',
    'TransformController',
    'DomBindings',
    'ViewportCache',
    // Module categories owned in the documented contract
    'CropController',
    'ExportService',
    'MaskFactory',
    'MaskListManager',
    'MaskLabelManager',
    'StateSerializer',
    'CallbackReporter',
    'ImageLoader',
    'ImageResampler',
    'LayoutManager',
    'FabricAdapter',
]);

// ─── 1. Default + named exports ─────────────────────────

test('barrel exposes ImageEditor as default and named export, both pointing to the same class', () => {
    assert.equal(
        typeof NamedImageEditor,
        'function',
        'named `ImageEditor` export must be a class (function)',
    );
    assert.equal(
        typeof DefaultImageEditor,
        'function',
        'default export must be a class (function)',
    );
    assert.equal(
        DefaultImageEditor,
        NamedImageEditor,
        'default and named exports must resolve to the same class',
    );
    assert.equal(NamedImageEditor.name, 'ImageEditor', 'class name must be `ImageEditor`');
});

// ─── 2. isMaskObject is exported ────────────────────────

test('barrel exposes isMaskObject as a runtime function', () => {
    assert.equal(
        typeof isMaskObject,
        'function',
        '`isMaskObject` must be a runtime export from the barrel',
    );
});

// ─── 3. Canonical methods on ImageEditor.prototype ──────

test('every canonical method from the documented contract is a function on ImageEditor.prototype', () => {
    for (const method of CANONICAL_METHODS) {
        const value = NamedImageEditor.prototype[method];
        assert.equal(
            typeof value,
            'function',
            `ImageEditor.prototype.${method} must be a function`,
        );
    }
});

test('canonical method set includes the documented introspection methods', () => {
    // Spot-check these names so a future refactor that drops one of them
    // fails this test by name rather than by index.
    for (const introspector of ['isImageLoaded', 'isBusy', 'saveState', 'loadFromState']) {
        assert.equal(
            typeof NamedImageEditor.prototype[introspector],
            'function',
            `\`${introspector}\` must be a function on ImageEditor.prototype`,
        );
    }
});

// ─── 4. Internal helpers must not leak from the barrel ────────────────────

test('package barrel does not re-export internal helpers as runtime values', () => {
    for (const internal of FORBIDDEN_INTERNAL_NAMES) {
        // The barrel is a module namespace; internal helpers would show
        // up as own enumerable properties. `Object.hasOwn` keeps the
        // assertion narrowly scoped to runtime exports and ignores
        // type-only re-exports (which are erased at runtime).
        assert.equal(
            Object.prototype.hasOwnProperty.call(barrel, internal),
            false,
            `barrel must not re-export internal helper \`${internal}\``,
        );
    }
});

test('package barrel runtime value exports are exactly { ImageEditor, default, isMaskObject }', () => {
    // `default` is the ESM default export and shows up as an own
    // property of the namespace object alongside the named exports. The
    // canonical set of runtime values from `src/index.ts` is small and
    // intentional; pinning it here catches accidental re-exports of
    // implementation modules in future refactors.
    const exportedKeys = Object.keys(barrel).sort();
    const expectedKeys = ['ImageEditor', 'default', 'isMaskObject'].sort();
    assert.deepEqual(
        exportedKeys,
        expectedKeys,
        `barrel runtime exports must equal ${JSON.stringify(expectedKeys)}`,
    );
});
