/**
 * @file package-shape.test.mjs
 *
 * Type:
 *   Smoke test
 *
 * Purpose:
 *   Reads package.json as JSON and verifies the package metadata that downstream
 *   consumers and CDNs rely on. The test avoids loading source or dist modules so it
 *   can run on a clean tree.
 *
 * Scope:
 *   - Version, module type, engines, peer dependency, sideEffects, and top-level
 *     entry fields are checked.
 *   - exports["."] exposes only the documented condition keys and bundle paths.
 *   - Artifact existence is covered by the build-artifacts smoke test, not this
 *     metadata test.
 *
 * Out of scope:
 *   - feature behavior inside ImageEditor methods
 *   - browser rendering behavior
 *   - private implementation refactors
 *
 * Environment:
 *   - Node.js ESM
 *   - filesystem or built-artifact inspection
 *
 * Run:
 *   node --test tests/package-shape.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on published package.json shape only.
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

// ─── 1. Version and module type ─────────────────────────

test('package.json declares a compatible semver `version`', () => {
    assert.match(
        pkg.version,
        /^2\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/,
        '`version` must be a compatible 2.x semver string',
    );
});

test('package.json declares `type` as "module"', () => {
    assert.equal(pkg.type, 'module', '`type` must be "module"');
});

// ─── 2. Node engines ──────────────────────────────────────────────────────

test('package.json declares `engines.node` at >= 20', () => {
    assert.equal(typeof pkg.engines, 'object', '`engines` must be an object');
    assert.notEqual(pkg.engines, null, '`engines` must not be null');

    const nodeRange = pkg.engines.node;
    assert.equal(typeof nodeRange, 'string', '`engines.node` must be a string');
    // Accept `>=20`, `>= 20`, `>=20.0.0`, etc. — the constraint is "Node
    // 20 or newer", expressed as a `>=` range starting at major 20.
    assert.match(
        nodeRange,
        /^>=\s*20(\.|$|\s)/,
        `\`engines.node\` must declare Node 20+ (got ${JSON.stringify(nodeRange)})`,
    );
});

// ─── 3. Fabric peer dependency ────────────────────────────────────────────

test('package.json declares fabric as a `^7.0.0` peer dependency', () => {
    assert.equal(typeof pkg.peerDependencies, 'object', '`peerDependencies` must be an object');
    assert.notEqual(pkg.peerDependencies, null, '`peerDependencies` must not be null');
    assert.equal(
        pkg.peerDependencies.fabric,
        '^7.0.0',
        '`peerDependencies.fabric` must be exactly "^7.0.0"',
    );
});

test('package.json keeps canvas as a development-only dependency', () => {
    assert.equal(
        pkg.overrides?.canvas,
        undefined,
        '`overrides.canvas` must not force a canvas version on consumers',
    );
    assert.equal(
        pkg.dependencies?.canvas,
        undefined,
        '`dependencies.canvas` must not be published as a runtime dependency',
    );
    assert.equal(
        pkg.peerDependencies?.canvas,
        undefined,
        '`peerDependencies.canvas` must not be required from consumers',
    );
    assert.equal(
        pkg.devDependencies?.canvas,
        '^3.2.3',
        '`canvas` should be available only for local Fabric/jsdom tests',
    );
});

// ─── 4. `exports['.']` conditional map ────────────────────────────────────

test('package.json `exports["."]` map points at the documented bundle paths', () => {
    assert.equal(typeof pkg.exports, 'object', '`exports` must be an object');
    assert.notEqual(pkg.exports, null, '`exports` must not be null');

    const rootExport = pkg.exports['.'];
    assert.equal(typeof rootExport, 'object', '`exports["."]` must be an object map');
    assert.notEqual(rootExport, null, '`exports["."]` must not be null');

    assert.deepEqual(rootExport.import, {
        types: './dist/types/index.d.ts',
        default: './dist/esm/index.js',
    });
    assert.deepEqual(rootExport.require, {
        types: './dist/types/index.d.cts',
        default: './dist/cjs/index.cjs',
    });
    assert.equal(rootExport.default, './dist/esm/index.js');
});

test('package.json `exports["."]` does not declare any unexpected condition keys', () => {
    // the documented contract pins exactly three conditions for the root export. A
    // stray condition (for example a `node`, `browser`, or top-level `types`) is a
    // distribution-shape change that should be reviewed before landing.
    const rootExport = pkg.exports['.'];
    const actualKeys = Object.keys(rootExport).sort();
    const expectedKeys = ['default', 'import', 'require'];
    assert.deepEqual(
        actualKeys,
        expectedKeys,
        `\`exports["."]\` keys must equal ${JSON.stringify(expectedKeys)} ` + `for the root export`,
    );
});

// ─── 5. Top-level entry fields ────────────────────────────────────────────

test('package.json `main` points to the CJS bundle', () => {
    assert.equal(pkg.main, './dist/cjs/index.cjs', '`main` must point to the CJS bundle');
});

test('package.json `module` points to the ESM bundle', () => {
    assert.equal(pkg.module, './dist/esm/index.js', '`module` must point to the ESM bundle');
});

test('package.json `types` points to the declarations bundle', () => {
    assert.equal(
        pkg.types,
        './dist/types/index.d.ts',
        '`types` must point to the declarations bundle',
    );
});

test('package.json `unpkg` and `jsdelivr` both point to the UMD bundle', () => {
    const expectedUmdPath = './dist/umd/image-editor.umd.js';
    assert.equal(pkg.unpkg, expectedUmdPath, '`unpkg` must point to the UMD bundle');
    assert.equal(pkg.jsdelivr, expectedUmdPath, '`jsdelivr` must point to the UMD bundle');
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
