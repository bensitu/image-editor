/**
 * Unit tests for the canonical public-API surface of `ImageEditor`.
 *
 * Owner: `src/image-editor.ts` (the public facade) and `src/index.ts`
 * (the canonical barrel).
 *
 * Behaviors under test:
 *
 *   1. Default + named export resolve to the same class. The package
 *      barrel exposes `ImageEditor` as both the default export and a
 *      named export, both pointing to the same class declaration.
 *   2. `isMaskObject` is the only additional runtime value re-exported.
 *   3. Canonical method set on `ImageEditor.prototype` — every public
 *      method is present as a function on the prototype, including the
 *      `isImageLoaded`, `saveState`, and `loadFromState` introspection
 *      trio.
 *   4. Internal helpers (animation queue, command, history manager,
 *      controllers, services, managers, utility modules) do not leak
 *      through the barrel.
 *
 * Identifier-level scrubbing of the deprecated aliases is owned by
 * `tests/alias-scrub.test.mjs`. This test focuses on the runtime API
 * shape so the two suites have non-overlapping responsibilities.
 *
 * Runtime note: Node 24+ strips TypeScript syntax natively, so this
 * test imports the modules under test directly from source via the
 * shared `ts-resolve-hook`. The Fabric module is stubbed structurally
 * (just an object with a `Canvas` function) so `detectFabric` resolves
 * to a usable adapter without bootstrapping a full Fabric/jsdom
 * environment — the suite is about API shape, not behavior.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';

const barrel = await import('../src/index.ts');
const { ImageEditor: NamedImageEditor, isMaskObject } = barrel;
const DefaultImageEditor = barrel.default;

// ─── Constants from Requirement 2 ─────────────────────────────────────────

/**
 * Canonical public methods listed in Requirement 2.3. Every entry must
 * resolve to a function on `ImageEditor.prototype`.
 */
const CANONICAL_METHODS = Object.freeze([
    'init',
    'dispose',
    'loadImage',
    'isImageLoaded',
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
 * mirrors the design's "Module Responsibilities" table — every helper is
 * an implementation detail (`AnimationQueue`, `Command`,
 * `HistoryManager`) plus the broader controller/service/manager/utility
 * categories that gate the rest of the module tree.
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
    // Module categories owned in the design
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

// ─── 1. Default + named exports (Requirement 2.1) ─────────────────────────

test('barrel exposes ImageEditor as default and named export, both pointing to the same class', () => {
    assert.equal(typeof NamedImageEditor, 'function',
        'named `ImageEditor` export must be a class (function)');
    assert.equal(typeof DefaultImageEditor, 'function',
        'default export must be a class (function)');
    assert.equal(DefaultImageEditor, NamedImageEditor,
        'default and named exports must resolve to the same class');
    assert.equal(NamedImageEditor.name, 'ImageEditor',
        'class name must be `ImageEditor`');
});

// ─── 2. isMaskObject is exported (Requirement 2.2) ────────────────────────

test('barrel exposes isMaskObject as a runtime function', () => {
    assert.equal(typeof isMaskObject, 'function',
        '`isMaskObject` must be a runtime export from the barrel');
});

// ─── 3. Canonical methods on ImageEditor.prototype (Requirement 2.3) ──────

test('every canonical method from Requirement 2.3 is a function on ImageEditor.prototype', () => {
    for (const method of CANONICAL_METHODS) {
        const value = NamedImageEditor.prototype[method];
        assert.equal(
            typeof value,
            'function',
            `ImageEditor.prototype.${method} must be a function (Requirement 2.3)`,
        );
    }
});

test('canonical method set includes the Requirement 2.3 introspection trio', () => {
    // Spot-check the three names called out in the task description so a
    // future refactor that drops one of them fails this test by name
    // rather than by index.
    for (const introspector of ['isImageLoaded', 'saveState', 'loadFromState']) {
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
