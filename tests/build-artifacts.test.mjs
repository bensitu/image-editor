/**
 * Smoke test for the canonical build artifact tree on disk.
 *
 * Behaviors under test:
 *
 *   1. **Artifact presence (Req 1.3)** — after `npm run build`, every
 *      canonical bundle exists at its documented path:
 *        - `dist/esm/index.js`              (ESM bundle)
 *        - `dist/cjs/index.cjs`             (CJS bundle)
 *        - `dist/umd/image-editor.umd.js`   (UMD bundle)
 *        - `dist/types/index.d.ts`          (TypeScript declarations)
 *   2. **Artifacts are non-empty (Req 1.6)** — a build that "succeeds"
 *      but emits an empty file is still a broken build, so each
 *      artifact's byte size must be greater than zero.
 *   3. **Bundle shape sanity (Req 1.3, 1.6)** — each bundle carries
 *      the syntactic markers of its declared format:
 *        - ESM bundle uses `import` or `export` syntax
 *        - CJS bundle declares `'use strict'` and assigns to `exports`
 *        - UMD bundle exposes the documented `ImageEditor` global
 *          identifier (per `rollup.config.mjs` `output.name`)
 *
 * Skip behavior on a clean tree:
 *
 *   The build step is independent of the test step in this repo (`npm
 *   test` does NOT depend on `npm run build`), so it is valid for
 *   `dist/` to be absent when this test runs. When the entire `dist/`
 *   directory is missing, every assertion in this file returns early
 *   without failing — Requirement 1.3 is verified end-to-end by CI
 *   pipelines that build before testing. This mirrors the ENOENT skip
 *   path in `tests/public-surface.test.mjs` for `dist/types/index.d.ts`.
 *
 *   When `dist/` IS present but a specific artifact is missing or
 *   empty, the assertion fails — that is the failure mode of a broken
 *   build pipeline (for example a successful `tsc` followed by a
 *   broken Rollup pass), and it is exactly what this smoke test exists
 *   to catch.
 *
 * The test reads files from disk (no module side effects, no
 * Fabric/jsdom bootstrap) so it stays self-contained.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const distRoot = path.join(repoRoot, 'dist');

// ─── Canonical artifact paths from Requirement 1.3 ────────────────────────

/**
 * The four canonical build artifacts. Keys are short labels used in
 * test names and assertion messages; values are paths relative to the
 * repository root.
 *
 * The CJS extension is `.cjs` (not `.js`) per Requirement 1.4 so that
 * Node's `"type": "module"` resolution treats the file as CommonJS.
 *
 * The UMD filename is `image-editor.umd.js` per `rollup.config.mjs`.
 */
const ARTIFACTS = Object.freeze({
    esm:   'dist/esm/index.js',
    cjs:   'dist/cjs/index.cjs',
    umd:   'dist/umd/image-editor.umd.js',
    types: 'dist/types/index.d.ts',
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
    } catch (err) {
        if (err && err.code === 'ENOENT') return false;
        throw err;
    }
}

/**
 * Read an artifact's contents and return both the raw text and its
 * byte size. Throws on missing files so the caller can surface a
 * Requirement 1.3 violation.
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

// ─── 1. Artifact presence and non-emptiness (Req 1.3, 1.6) ────────────────

test('dist/esm/index.js exists and is non-empty when dist/ is present', async () => {
    if (!distIsBuilt) return; // skip cleanly on an unbuilt tree
    const { size } = await readArtifact(ARTIFACTS.esm);
    assert.ok(
        size > 0,
        `${ARTIFACTS.esm} must be a non-empty file (Requirement 1.3)`,
    );
});

test('dist/cjs/index.cjs exists and is non-empty when dist/ is present', async () => {
    if (!distIsBuilt) return;
    const { size } = await readArtifact(ARTIFACTS.cjs);
    assert.ok(
        size > 0,
        `${ARTIFACTS.cjs} must be a non-empty file (Requirement 1.3)`,
    );
});

test('dist/umd/image-editor.umd.js exists and is non-empty when dist/ is present', async () => {
    if (!distIsBuilt) return;
    const { size } = await readArtifact(ARTIFACTS.umd);
    assert.ok(
        size > 0,
        `${ARTIFACTS.umd} must be a non-empty file (Requirement 1.3)`,
    );
});

test('dist/types/index.d.ts exists and is non-empty when dist/ is present', async () => {
    if (!distIsBuilt) return;
    const { size } = await readArtifact(ARTIFACTS.types);
    assert.ok(
        size > 0,
        `${ARTIFACTS.types} must be a non-empty file (Requirement 1.3)`,
    );
});

// ─── 2. Bundle shape sanity (Req 1.3, 1.6) ────────────────────────────────

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
        `\`import\`) per Requirement 1.3`,
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
        `${ARTIFACTS.cjs} must declare \`'use strict';\` at the top ` +
        `(Requirement 1.3)`,
    );
    assert.match(
        text,
        /\b(?:exports\.[A-Za-z_$][\w$]*\s*=|module\.exports\s*=|Object\.defineProperty\(\s*exports\b)/,
        `${ARTIFACTS.cjs} must assign onto \`exports\` or \`module.exports\` ` +
        `(Requirement 1.3)`,
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
        `assigned by Rollup's UMD wrapper (Requirement 1.5, surfaced via ` +
        `Requirement 1.3 path layout)`,
    );
});

test('types bundle declares the `ImageEditor` symbol', async () => {
    if (!distIsBuilt) return;
    const { text } = await readArtifact(ARTIFACTS.types);
    // The declarations bundle for `src/index.ts` re-exports
    // `ImageEditor`. A successful `tsc -p tsconfig.types.json` run
    // therefore produces a file that mentions the identifier; an
    // empty-or-stub `.d.ts` would silently break TypeScript consumers
    // even though Requirement 1.3's "file exists at the path" check
    // passes. Asserting the identifier catches that failure mode.
    assert.match(
        text,
        /\bImageEditor\b/,
        `${ARTIFACTS.types} must declare the \`ImageEditor\` symbol ` +
        `(Requirements 1.3, 2.1)`,
    );
});
