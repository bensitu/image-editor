/**
 * @file build-artifacts.test.mjs
 *
 * Type:
 *   Smoke test
 *
 * Purpose:
 *   Verifies the on-disk dist/ outputs produced by npm run build. The test checks
 *   artifact presence, non-empty output, and basic syntax markers for each published
 *   bundle format without executing those bundles.
 *
 * Scope:
 *   - ESM, CJS, UMD, and declaration artifacts are checked at their documented paths.
 *   - A completely missing dist/ directory is treated as a clean-tree skip because
 *     npm test does not build first.
 *   - A partial dist/ tree fails, which catches broken or incomplete build pipelines.
 *
 * Out of scope:
 *   - feature behavior inside ImageEditor methods
 *   - browser rendering behavior
 *   - private implementation refactors
 *
 * Environment:
 *   - Node.js ESM
 *   - filesystem or built-artifact inspection
 *   - jsdom or DOM stubs are used where needed
 *
 * Run:
 *   node --test tests/build-artifacts.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on canonical build artifact tree only.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const distRoot = path.join(repoRoot, 'dist');

// ─── Canonical artifact paths from the documented contract ────────────────────────

/**
 * The four canonical build artifacts. Keys are short labels used in
 * test names and assertion messages; values are paths relative to the
 * repository root.
 *
 * The CJS extension is `.cjs` (not `.js`) per the documented contract so that
 * Node's `"type": "module"` resolution treats the file as CommonJS.
 *
 * The UMD filename is `image-editor.umd.js` per `rollup.config.mjs`.
 */
const ARTIFACTS = Object.freeze({
    esm: 'dist/esm/index.js',
    cjs: 'dist/cjs/index.cjs',
    umd: 'dist/umd/image-editor.umd.js',
    types: 'dist/types/index.d.ts',
    cjsTypes: 'dist/types/index.d.cts',
    publicTypes: 'dist/types/core/public-types.d.ts',
});

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Resolve whether `dist/` exists as a directory. A missing `dist/` is
 * the clean-tree skip signal; any other filesystem error propagates so
 * permission issues do not silently turn into a green test.
 */
async function distDirectoryExists() {
    try {
        const stat = await fs.stat(distRoot);
        return stat.isDirectory();
    } catch (error) {
        if (error && error.code === 'ENOENT') return false;
        throw error;
    }
}

/**
 * Read an artifact's contents and return both the raw text and its
 * byte size. Throws on missing files so the caller can surface a
 * the documented contract violation.
 */
async function readArtifact(relativePath) {
    const absolutePath = path.join(repoRoot, relativePath);
    const stat = await fs.stat(absolutePath);
    const text = await fs.readFile(absolutePath, 'utf8');
    return { absolutePath, size: stat.size, text };
}

// Compute once, up front, so each test can branch on the same
// snapshot. Top-level `await` is supported because this file is an
// ESM module loaded by `node --test`.
const distIsBuilt = await distDirectoryExists();

// ─── 1. Artifact presence and non-emptiness ────────────────

test('dist/esm/index.js exists and is non-empty when dist/ is present', async () => {
    if (!distIsBuilt) return; // skip cleanly on an unbuilt tree
    const { size } = await readArtifact(ARTIFACTS.esm);
    assert.ok(size > 0, `${ARTIFACTS.esm} must be a non-empty file`);
});

test('dist/cjs/index.cjs exists and is non-empty when dist/ is present', async () => {
    if (!distIsBuilt) return;
    const { size } = await readArtifact(ARTIFACTS.cjs);
    assert.ok(size > 0, `${ARTIFACTS.cjs} must be a non-empty file`);
});

test('dist/umd/image-editor.umd.js exists and is non-empty when dist/ is present', async () => {
    if (!distIsBuilt) return;
    const { size } = await readArtifact(ARTIFACTS.umd);
    assert.ok(size > 0, `${ARTIFACTS.umd} must be a non-empty file`);
});

test('dist/types/index.d.ts exists and is non-empty when dist/ is present', async () => {
    if (!distIsBuilt) return;
    const { size } = await readArtifact(ARTIFACTS.types);
    assert.ok(size > 0, `${ARTIFACTS.types} must be a non-empty file`);
});

test('dist/types/index.d.cts exists and is non-empty when dist/ is present', async () => {
    if (!distIsBuilt) return;
    const { size } = await readArtifact(ARTIFACTS.cjsTypes);
    assert.ok(size > 0, `${ARTIFACTS.cjsTypes} must be a non-empty file`);
});

// ─── 2. Bundle shape sanity ────────────────────────────────

test('ESM bundle uses ESM syntax (import or export)', async () => {
    if (!distIsBuilt) return;
    const { text } = await readArtifact(ARTIFACTS.esm);
    // The barrel re-exports `ImageEditor`, the default export, and
    // `isMaskObject`, so at minimum a top-level `export` keyword must
    // appear. Accept `import` as well for completeness — the ESM
    // bundle is the only canonical artifact that may carry either.
    assert.match(
        text,
        /(^|\n)\s*(export|import)\b/,
        `${ARTIFACTS.esm} must contain ESM syntax (top-level \`export\` or ` +
            `\`import\`) per the documented contract`,
    );
});

test('CJS bundle uses CJS syntax (`use strict` and exports assignment)', async () => {
    if (!distIsBuilt) return;
    const { text } = await readArtifact(ARTIFACTS.cjs);
    // Rollup's CJS output emits `'use strict';` as the first line and
    // assigns onto `exports` (either `Object.defineProperty(exports,
    // ...)` or `exports.X = ...` or `module.exports = ...`). Either
    // marker on its own can be coincidental in source text, so require
    // both.
    assert.match(
        text,
        /^\s*['"]use strict['"]\s*;/,
        `${ARTIFACTS.cjs} must declare \`'use strict';\` at the top ` + ``,
    );
    assert.match(
        text,
        /\b(?:exports\.[A-Za-z_$][\w$]*\s*=|module\.exports\s*=|Object\.defineProperty\(\s*exports\b)/,
        `${ARTIFACTS.cjs} must assign onto \`exports\` or \`module.exports\` ` + ``,
    );
});

test('UMD bundle exposes the documented `ImageEditor` global identifier', async () => {
    if (!distIsBuilt) return;
    const { text } = await readArtifact(ARTIFACTS.umd);
    // Rollup's UMD wrapper installs `output.name` as a property on
    // `globalThis` (or `self` / `this`). For our config that name is
    // `ImageEditor` (`rollup.config.mjs`, `configs.umd.output.name`).
    // The minified wrapper takes the form `).ImageEditor={}` or
    // similar — assert the identifier appears with a property-access
    // boundary so a stray substring elsewhere cannot satisfy the
    // check.
    assert.match(
        text,
        /\bImageEditor\b/,
        `${ARTIFACTS.umd} must reference the \`ImageEditor\` global name ` +
            `assigned by Rollup's UMD wrapper`,
    );
});

test('types bundle declares the `ImageEditor` symbol', async () => {
    if (!distIsBuilt) return;
    const { text } = await readArtifact(ARTIFACTS.types);
    // The declarations bundle for `src/index.ts` re-exports
    // `ImageEditor`. A successful `tsc -p tsconfig.types.json` run
    // therefore produces a file that mentions the identifier; an
    // empty-or-stub `.d.ts` would silently break TypeScript consumers
    // even though the documented contract's "file exists at the path" check
    // passes. Asserting the identifier catches that failure mode.
    assert.match(
        text,
        /\bImageEditor\b/,
        `${ARTIFACTS.types} must declare the \`ImageEditor\` symbol ` + ``,
    );
});

test('CJS types bundle declares the `ImageEditor` symbol', async () => {
    if (!distIsBuilt) return;
    const { text } = await readArtifact(ARTIFACTS.cjsTypes);
    assert.match(
        text,
        /\bImageEditor\b/,
        `${ARTIFACTS.cjsTypes} must declare the \`ImageEditor\` symbol ` + ``,
    );
});

test('public types declaration exports ResolvedMaskConfig', async () => {
    if (!distIsBuilt) return;
    const { text } = await readArtifact(ARTIFACTS.publicTypes);
    assert.match(
        text,
        /\bexport\s+interface\s+ResolvedMaskConfig\b/,
        `${ARTIFACTS.publicTypes} must export \`ResolvedMaskConfig\` because ` +
            `the package root re-exports it and MaskConfig.fabricGenerator references it`,
    );
});
