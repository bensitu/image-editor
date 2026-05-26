/**
 * Static smoke tests for the canonical public-API barrel (`src/index.ts`).
 *
 * These tests inspect the barrel as a string so they remain valid even
 * when other parts of the source tree are mid-edit. They cover the
 * shape of the barrel:
 *
 *   - `ImageEditor` is exposed as both the default and the named export.
 *   - `isMaskObject` is the only additional runtime value re-exported.
 *   - The documented public types are re-exported.
 *   - Internal helpers (AnimationQueue, Command, HistoryManager,
 *     controllers, services, managers) are not root-exported.
 *
 * Identifier-level deprecated-alias scrubbing is owned by
 * `tests/alias-scrub.test.mjs`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.resolve(__dirname, '..', 'src', 'index.ts');

async function readBarrel() {
    return fs.readFile(indexPath, 'utf8');
}

test('barrel exports ImageEditor as both named and default', async () => {
    const source = await readBarrel();

    assert.match(
        source,
        /export\s*\{\s*ImageEditor\s*\}/,
        'barrel must contain `export { ImageEditor }` (named export)'
    );
    assert.match(
        source,
        /export\s+default\s+ImageEditor\b/,
        'barrel must contain `export default ImageEditor`'
    );
});

test('barrel exports isMaskObject', async () => {
    const source = await readBarrel();

    assert.match(
        source,
        /export\s*\{\s*isMaskObject\s*\}/,
        'barrel must contain `export { isMaskObject }`'
    );
});

test('barrel re-exports documented public type names', async () => {
    const source = await readBarrel();

    const expectedTypeNames = [
        'ImageEditorOptions',
        'ResolvedOptions',
        'LabelConfig',
        'CropConfig',
        'MaskConfig',
        'MaskObject',
        'MaskNumericProp',
        'ResolvedMaskConfig',
        'ElementIdMap',
        'FabricModule'
    ];

    for (const name of expectedTypeNames) {
        const pattern = new RegExp(`\\b${name}\\b`);
        assert.match(
            source,
            pattern,
            `barrel must re-export the documented public type \`${name}\``
        );
    }
});

test('barrel does not export internal helpers', async () => {
    const source = await readBarrel();

    const forbiddenInternalExports = [
        /export\s*\{\s*AnimationQueue\b/,
        /export\s*\{\s*Command\b/,
        /export\s*\{\s*HistoryManager\b/,
        // Any controllers, services, managers should not be value-exported
        /export\s*\{\s*[A-Za-z]+Controller\b/,
        /export\s*\{\s*[A-Za-z]+Service\b/,
        /export\s*\{\s*[A-Za-z]+Manager\b/
    ];

    for (const pattern of forbiddenInternalExports) {
        assert.equal(
            pattern.test(source),
            false,
            `barrel must not match ${pattern} (internal helper leaked to root)`
        );
    }
});
