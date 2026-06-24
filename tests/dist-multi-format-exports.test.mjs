/**
 * Type:
 *   Smoke test
 *
 * Purpose:
 *   Loads the built ESM, CJS, and UMD bundles and verifies that each format exposes
 *   the same canonical public runtime surface. The test validates packaged artifacts
 *   rather than source modules.
 *
 * Scope:
 *   - ImageEditor is exposed as default and named export where the format supports
 *     both.
 *   - Editor object guards are present in every format.
 *   - Internal helpers remain absent from all root export shapes; missing dist/
 *     artifacts are treated as clean-tree skips.
 *
 * Out of scope:
 *   - feature behavior inside ImageEditor methods
 *   - browser rendering behavior
 *   - private implementation refactors
 *
 * Environment:
 *   - Node.js ESM
 *   - filesystem or built-artifact inspection
 *   - Fabric/canvas behavior is mocked where needed
 *
 * Run:
 *   node --test tests/dist-multi-format-exports.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on multi-format distribution exports only.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const distRoot = path.join(repoRoot, 'dist');

const ESM_PATH = path.join(distRoot, 'esm', 'index.js');
const CJS_PATH = path.join(distRoot, 'cjs', 'index.cjs');
const UMD_PATH = path.join(distRoot, 'umd', 'image-editor.umd.js');

// ─── Constants ────────────────────────────────────────────────────────────

/**
 * Internal helpers that must not leak through any format's root export.
 * The list mirrors `tests/public-surface.test.mjs` so the static (`src/`)
 * and built (`dist/`) checks stay aligned.
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
    // Internal module categories
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

/**
 * The canonical runtime exports of the package root, sorted. Every
 * format that supports named exports (ESM, CJS) must surface exactly
 * this set — anything more is a leak; anything less is a regression.
 *
 * UMD's wrapper installs the same set as own properties of the
 * `ImageEditor` global plus the Rollup-injected `__esModule` marker,
 * so the UMD assertion uses a slightly different shape (covered
 * below).
 */
const CANONICAL_RUNTIME_EXPORTS = Object.freeze([
    'ImageEditor',
    'default',
    'isAnnotationObject',
    'isBaseImageObject',
    'isDrawAnnotationObject',
    'isEditableOverlayObject',
    'isMaskObject',
    'isSessionObject',
    'isTextAnnotationObject',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Resolve whether a path exists on disk. Returns `true` only when the
 * filesystem call succeeds; ENOENT is the clean-tree skip signal and
 * is reported as `false`. Any other error (permissions, broken disk)
 * propagates so it cannot silently turn into a green test.
 */
async function pathExists(absolutePath) {
    try {
        await fs.stat(absolutePath);
        return true;
    } catch (error) {
        if (error && error.code === 'ENOENT') return false;
        throw error;
    }
}

/**
 * Minimal Fabric stub installed on the UMD sandbox's `globalThis` so
 * any defensive `globalThis.fabric` reads at module-evaluation time
 * resolve to a usable shape. The UMD wrapper does not construct
 * `ImageEditor` at evaluation time — Fabric is only consulted from
 * the constructor — but providing the stub keeps the test resilient
 * to future changes that might add a top-level lookup.
 */
function makeFakeFabric() {
    return { Canvas: function FakeCanvas() {} };
}

/**
 * Evaluate the UMD bundle inside a fresh `vm` context and return the
 * `ImageEditor` global it installed. The UMD wrapper emitted by Rollup
 * checks (in order) `exports + module`, `define.amd`, then falls
 * through to `globalThis.ImageEditor = {}` populated by the IIFE.
 * The sandbox intentionally omits both `exports` and `define` so the
 * global branch is taken.
 */
async function evaluateUmdBundle() {
    const source = await fs.readFile(UMD_PATH, 'utf8');

    const sandbox = {
        // `globalThis` is the sandbox object itself — Node's vm
        // contextifies the object so `globalThis === sandbox` inside
        // the script. Stubbing `fabric` here matches the UMD
        // peerDependency contract (`rollup.config.mjs` declares
        // `fabric` as an external global).
        fabric: makeFakeFabric(),
        // Node's vm script bodies see `console` only if it's on the
        // sandbox; supply a no-op shim so any defensive logging at
        // evaluation time does not throw.
        console: { error() {}, warn() {}, log() {} },
    };

    vm.createContext(sandbox);
    const script = new vm.Script(source, { filename: 'image-editor.umd.js' });
    script.runInContext(sandbox);

    return sandbox.ImageEditor;
}

/**
 * Test-driver: returns `true` when each of the three bundle artifacts
 * is present on disk. Used to short-circuit every test in this file
 * with a uniform skip signal.
 */
async function allArtifactsBuilt() {
    const [esm, cjs, umd] = await Promise.all([
        pathExists(ESM_PATH),
        pathExists(CJS_PATH),
        pathExists(UMD_PATH),
    ]);
    return esm && cjs && umd;
}

const distIsBuilt = await allArtifactsBuilt();

// ─── 1. ESM bundle exposes canonical exports ──────────

test('ESM bundle exposes ImageEditor (default + named) and isMaskObject', async () => {
    if (!distIsBuilt) return; // skip cleanly on an unbuilt tree

    // `pathToFileURL` is required on Windows so the dynamic import
    // resolves an absolute path correctly across platforms.
    const esmModule = await import(pathToFileURL(ESM_PATH).href);

    assert.equal(
        typeof esmModule.ImageEditor,
        'function',
        'ESM bundle must expose `ImageEditor` as a named export',
    );
    assert.equal(
        typeof esmModule.default,
        'function',
        'ESM bundle must expose `ImageEditor` as the default export',
    );
    assert.equal(
        esmModule.default,
        esmModule.ImageEditor,
        'ESM `default` and named `ImageEditor` must reference the same class ' + '',
    );
    assert.equal(
        esmModule.ImageEditor.name,
        'ImageEditor',
        "ESM bundle's exported class must be named `ImageEditor`",
    );
    assert.equal(
        typeof esmModule.isMaskObject,
        'function',
        'ESM bundle must expose `isMaskObject`',
    );
});

test('ESM bundle does not root-export any internal helper', async () => {
    if (!distIsBuilt) return;

    const esmModule = await import(pathToFileURL(ESM_PATH).href);
    const ownKeys = Object.keys(esmModule);

    for (const internal of FORBIDDEN_INTERNAL_NAMES) {
        assert.equal(
            ownKeys.includes(internal),
            false,
            `ESM bundle must not root-export internal helper \`${internal}\`. ` +
                `Got keys: ${JSON.stringify(ownKeys)}`,
        );
    }
});

test('ESM bundle root exports are exactly the canonical runtime set', async () => {
    if (!distIsBuilt) return;

    const esmModule = await import(pathToFileURL(ESM_PATH).href);
    const exportedKeys = Object.keys(esmModule).sort();
    const expectedKeys = [...CANONICAL_RUNTIME_EXPORTS].sort();

    assert.deepEqual(
        exportedKeys,
        expectedKeys,
        `ESM bundle root exports must equal ${JSON.stringify(expectedKeys)} ` + ``,
    );
});

// ─── 2. CJS bundle exposes canonical exports ──────────

test('CJS bundle exposes ImageEditor (default + named) and isMaskObject', () => {
    if (!distIsBuilt) return;

    // `createRequire` produces a CJS-aware `require` rooted at this
    // ESM test file so we can load the `.cjs` artifact without the
    // host package's `exports` map intervening.
    const require = createRequire(import.meta.url);
    const cjsModule = require(CJS_PATH);

    assert.equal(
        typeof cjsModule.ImageEditor,
        'function',
        'CJS bundle must expose `ImageEditor` as a named export',
    );
    assert.equal(
        typeof cjsModule.default,
        'function',
        'CJS bundle must expose `ImageEditor` as the `default` property ' + '',
    );
    assert.equal(
        cjsModule.default,
        cjsModule.ImageEditor,
        'CJS `default` and `ImageEditor` must reference the same class ' + '',
    );
    assert.equal(
        cjsModule.ImageEditor.name,
        'ImageEditor',
        "CJS bundle's exported class must be named `ImageEditor`",
    );
    assert.equal(
        typeof cjsModule.isMaskObject,
        'function',
        'CJS bundle must expose `isMaskObject`',
    );
});

test('CJS bundle does not root-export any internal helper', () => {
    if (!distIsBuilt) return;

    const require = createRequire(import.meta.url);
    const cjsModule = require(CJS_PATH);
    const ownKeys = Object.keys(cjsModule);

    for (const internal of FORBIDDEN_INTERNAL_NAMES) {
        assert.equal(
            ownKeys.includes(internal),
            false,
            `CJS bundle must not root-export internal helper \`${internal}\`. ` +
                `Got keys: ${JSON.stringify(ownKeys)}`,
        );
    }
});

test('CJS bundle enumerable exports cover the canonical runtime set', () => {
    if (!distIsBuilt) return;

    const require = createRequire(import.meta.url);
    const cjsModule = require(CJS_PATH);
    const exportedKeys = Object.keys(cjsModule);

    // Rollup's CJS output may add the `__esModule` interop marker
    // (`exports.__esModule = true`) alongside the named exports, so
    // we assert "the canonical runtime set is a subset of the
    // exports" rather than strict equality. The forbidden-key check
    // above is what guards against extra leakage.
    for (const expected of CANONICAL_RUNTIME_EXPORTS) {
        assert.equal(
            exportedKeys.includes(expected),
            true,
            `CJS bundle must export \`${expected}\` ` +
                `. Got keys: ${JSON.stringify(exportedKeys)}`,
        );
    }
});

test('package root CommonJS require exposes the v2 namespace shape', () => {
    if (!distIsBuilt) return;

    const require = createRequire(path.join(repoRoot, 'package.json'));
    const packageModule = require(repoRoot);

    assert.equal(
        typeof packageModule,
        'object',
        'v2 CommonJS require must return a namespace object, not the constructor directly',
    );
    assert.equal(
        typeof packageModule.ImageEditor,
        'function',
        'package root require must expose `ImageEditor` as a named export',
    );
    assert.equal(
        typeof packageModule.default,
        'function',
        'package root require must expose `ImageEditor` as `default`',
    );
    assert.equal(
        packageModule.default,
        packageModule.ImageEditor,
        'package root require default and named ImageEditor exports must match',
    );
    assert.equal(
        typeof packageModule.isMaskObject,
        'function',
        'package root require must expose `isMaskObject`',
    );
});

// ─── 3. UMD bundle exposes canonical exports ──────────

test('UMD bundle installs `ImageEditor` global with canonical surface', async () => {
    if (!distIsBuilt) return;

    const umdGlobal = await evaluateUmdBundle();

    assert.equal(
        typeof umdGlobal,
        'object',
        'UMD bundle must install an `ImageEditor` global as an object ' +
            ". Rollup's UMD wrapper assigns `globalThis.ImageEditor = {}` " +
            'and the IIFE populates its exports onto that object.',
    );
    assert.notEqual(umdGlobal, null, 'UMD `ImageEditor` global must not be null');

    assert.equal(
        typeof umdGlobal.ImageEditor,
        'function',
        'UMD bundle must expose `ImageEditor` on its global namespace',
    );
    assert.equal(
        typeof umdGlobal.default,
        'function',
        'UMD bundle must expose `default` on its global namespace ' + '',
    );
    assert.equal(
        umdGlobal.default,
        umdGlobal.ImageEditor,
        'UMD `default` and `ImageEditor` must reference the same class ' + '',
    );
    // The UMD bundle is minified by Rollup's `terser` plugin
    // (`rollup.config.mjs`), so the inner class declaration is
    // renamed to a short identifier (e.g. `se`). The exported
    // *property* name remains `ImageEditor` (verified above) — that
    // is the API contract for the bundle surface. We therefore skip a
    // `Function.name` assertion on the UMD class to avoid coupling
    // the test to terser's name-mangling output.
    assert.equal(
        typeof umdGlobal.isMaskObject,
        'function',
        'UMD bundle must expose `isMaskObject` on its global namespace ' + '',
    );
});

test('UMD bundle does not expose any internal helper', async () => {
    if (!distIsBuilt) return;

    const umdGlobal = await evaluateUmdBundle();
    const ownKeys = Object.keys(umdGlobal);

    for (const internal of FORBIDDEN_INTERNAL_NAMES) {
        assert.equal(
            ownKeys.includes(internal),
            false,
            `UMD \`ImageEditor\` global must not expose internal helper \`${internal}\`. ` +
                `Got keys: ${JSON.stringify(ownKeys)}`,
        );
    }
});

test('UMD bundle global namespace covers the canonical runtime set', async () => {
    if (!distIsBuilt) return;

    const umdGlobal = await evaluateUmdBundle();
    const exportedKeys = Object.keys(umdGlobal);

    // Rollup's UMD wrapper also defines `__esModule` on the namespace
    // for ESM-interop, so this is a subset assertion. The
    // forbidden-key check above guards against extra leakage.
    for (const expected of CANONICAL_RUNTIME_EXPORTS) {
        assert.equal(
            exportedKeys.includes(expected),
            true,
            `UMD bundle must expose \`${expected}\` on its global namespace ` +
                `. Got keys: ${JSON.stringify(exportedKeys)}`,
        );
    }
});

// ─── 4. Cross-format consistency ───────────────────────────

test('ESM, CJS, and UMD bundles agree on the public surface shape', async () => {
    if (!distIsBuilt) return;

    const esmModule = await import(pathToFileURL(ESM_PATH).href);

    const require = createRequire(import.meta.url);
    const cjsModule = require(CJS_PATH);

    const umdGlobal = await evaluateUmdBundle();

    // The three formats hold structurally distinct `ImageEditor`
    // class instances (each bundle re-emits its own class
    // declaration), so identity comparison across formats is not
    // expected. What MUST agree is the canonical export name set
    // and the fact that each format's `default` aliases its own
    // `ImageEditor`. Both invariants are checked above per-format;
    // this test just pins the agreement point so a future format
    // drift (e.g. CJS dropping `default`) shows up as a single
    // failure.
    for (const expected of CANONICAL_RUNTIME_EXPORTS) {
        assert.equal(expected in esmModule, true, `ESM bundle must expose \`${expected}\``);
        assert.equal(expected in cjsModule, true, `CJS bundle must expose \`${expected}\``);
        assert.equal(expected in umdGlobal, true, `UMD bundle must expose \`${expected}\``);
    }
});
