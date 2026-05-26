/**
 * Smoke test for the canonical v2 `package.json` shape.
 *
 * Behaviors under test:
 *
 *   1. **Version and module type (Req 1.1)** — `version` is exactly
 *      `"2.0.0"` and `type` is `"module"`.
 *   2. **Engines (design contract)** — `engines.node` declares Node 20+
 *      (`>=20` or `>= 20`).
 *   3. **Fabric peer dependency (Req 1.2)** — `peerDependencies.fabric`
 *      is exactly `"^7.0.0"`.
 *   4. **`exports['.']` map (Req 1.4)** — every documented condition
 *      key (`types`, `import`, `require`, `default`) resolves to its
 *      canonical path:
 *        - `types`   → `./dist/types/index.d.ts`
 *        - `import`  → `./dist/esm/index.js`
 *        - `require` → `./dist/cjs/index.cjs`
 *        - `default` → `./dist/esm/index.js`
 *   5. **Top-level entry fields** — `main` resolves to the CJS bundle,
 *      `module` to ESM, `types` to declarations, and both `unpkg` and
 *      `jsdelivr` to the UMD bundle.
 *   6. **Tree-shaking contract** — `sideEffects` is the literal `false`.
 *
 * The test reads `package.json` as JSON (no module side effects, no
 * Fabric/jsdom bootstrap) so it stays valid on a clean tree where
 * `dist/` has not been built yet. Requirement 1.3 (artifacts on disk)
 * is covered by task 23.2, not here.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const packageJsonPath = path.join(repoRoot, 'package.json');

const pkg = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

// ─── 1. Version and module type (Requirement 1.1) ─────────────────────────

test('package.json declares `version` as the canonical v2 string', () => {
    assert.equal(
        pkg.version,
        '2.0.0',
        '`version` must be exactly "2.0.0" (Requirement 1.1)',
    );
});

test('package.json declares `type` as "module"', () => {
    assert.equal(
        pkg.type,
        'module',
        '`type` must be "module" (Requirement 1.1)',
    );
});

// ─── 2. Node engines ──────────────────────────────────────────────────────

test('package.json declares `engines.node` at >= 20', () => {
    assert.equal(
        typeof pkg.engines,
        'object',
        '`engines` must be an object',
    );
    assert.notEqual(pkg.engines, null, '`engines` must not be null');

    const nodeRange = pkg.engines.node;
    assert.equal(
        typeof nodeRange,
        'string',
        '`engines.node` must be a string',
    );
    // Accept `>=20`, `>= 20`, `>=20.0.0`, etc. — the constraint is "Node
    // 20 or newer", expressed as a `>=` range starting at major 20.
    assert.match(
        nodeRange,
        /^>=\s*20(\.|$|\s)/,
        `\`engines.node\` must declare Node 20+ (got ${JSON.stringify(nodeRange)})`,
    );
});

// ─── 3. Fabric peer dependency (Requirement 1.2) ──────────────────────────

test('package.json declares fabric as a `^7.0.0` peer dependency', () => {
    assert.equal(
        typeof pkg.peerDependencies,
        'object',
        '`peerDependencies` must be an object',
    );
    assert.notEqual(
        pkg.peerDependencies,
        null,
        '`peerDependencies` must not be null',
    );
    assert.equal(
        pkg.peerDependencies.fabric,
        '^7.0.0',
        '`peerDependencies.fabric` must be exactly "^7.0.0" (Requirement 1.2)',
    );
});

// ─── 4. `exports['.']` conditional map (Requirement 1.4) ──────────────────

test('package.json `exports["."]` map points at the documented bundle paths', () => {
    assert.equal(
        typeof pkg.exports,
        'object',
        '`exports` must be an object',
    );
    assert.notEqual(pkg.exports, null, '`exports` must not be null');

    const rootExport = pkg.exports['.'];
    assert.equal(
        typeof rootExport,
        'object',
        '`exports["."]` must be an object map',
    );
    assert.notEqual(
        rootExport,
        null,
        '`exports["."]` must not be null',
    );

    // Pin every documented condition key to its canonical path. Using a
    // table keeps the assertion list flat and the failure messages
    // pointed at the exact key that drifted.
    const expectedConditions = {
        types: './dist/types/index.d.ts',
        import: './dist/esm/index.js',
        require: './dist/cjs/index.cjs',
        default: './dist/esm/index.js',
    };

    for (const [condition, expectedPath] of Object.entries(expectedConditions)) {
        assert.equal(
            rootExport[condition],
            expectedPath,
            `\`exports["."].${condition}\` must be ${JSON.stringify(expectedPath)} ` +
            `(Requirement 1.4)`,
        );
    }
});

test('package.json `exports["."]` does not declare any unexpected condition keys', () => {
    // The design pins exactly four conditions for the root export. A
    // stray condition (for example a `node` or `browser` override) is a
    // distribution-shape change that should be reviewed against
    // Requirement 1.4 before landing.
    const rootExport = pkg.exports['.'];
    const actualKeys = Object.keys(rootExport).sort();
    const expectedKeys = ['default', 'import', 'require', 'types'];
    assert.deepEqual(
        actualKeys,
        expectedKeys,
        `\`exports["."]\` keys must equal ${JSON.stringify(expectedKeys)} ` +
        `(Requirement 1.4)`,
    );
});

// ─── 5. Top-level entry fields ────────────────────────────────────────────

test('package.json `main` points to the CJS bundle', () => {
    assert.equal(
        pkg.main,
        './dist/cjs/index.cjs',
        '`main` must point to the CJS bundle (Requirement 1.4)',
    );
});

test('package.json `module` points to the ESM bundle', () => {
    assert.equal(
        pkg.module,
        './dist/esm/index.js',
        '`module` must point to the ESM bundle (Requirement 1.4)',
    );
});

test('package.json `types` points to the declarations bundle', () => {
    assert.equal(
        pkg.types,
        './dist/types/index.d.ts',
        '`types` must point to the declarations bundle (Requirement 1.4)',
    );
});

test('package.json `unpkg` and `jsdelivr` both point to the UMD bundle', () => {
    const expectedUmdPath = './dist/umd/image-editor.umd.js';
    assert.equal(
        pkg.unpkg,
        expectedUmdPath,
        '`unpkg` must point to the UMD bundle (Requirement 1.4)',
    );
    assert.equal(
        pkg.jsdelivr,
        expectedUmdPath,
        '`jsdelivr` must point to the UMD bundle (Requirement 1.4)',
    );
});

// ─── 6. Tree-shaking contract ─────────────────────────────────────────────

test('package.json declares `sideEffects: false`', () => {
    // `sideEffects: false` lets bundlers tree-shake the barrel safely.
    // The check uses strict equality so an accidental string `"false"`
    // (which bundlers interpret as truthy) still fails.
    assert.equal(
        pkg.sideEffects,
        false,
        '`sideEffects` must be the boolean literal `false` (tree-shaking contract)',
    );
});
