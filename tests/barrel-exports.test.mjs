/**
 * Type:
 *   Smoke test
 *
 * Purpose:
 *   Inspects src/index.ts as source text to verify the package root exports only the
 *   intended runtime values and public types. It avoids loading the rest of the
 *   source tree so the test remains stable while internal modules are being edited.
 *
 * Scope:
 *   - ImageEditor is exported as both default and named export.
 *   - Editor object guards are the only additional runtime exports.
 *   - Public type exports are present and internal helpers do not leak through the
 *     barrel.
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
 *   node --test tests/barrel-exports.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on canonical public API barrel only.
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
        'barrel must contain `export { ImageEditor }` (named export)',
    );
    assert.match(
        source,
        /export\s+default\s+ImageEditor\b/,
        'barrel must contain `export default ImageEditor`',
    );
});

test('barrel exports editor object runtime guards', async () => {
    const source = await readBarrel();

    for (const guard of [
        'isAnnotationObject',
        'isBaseImageObject',
        'isDrawAnnotationObject',
        'isEditableOverlayObject',
        'isMaskObject',
        'isSessionObject',
        'isTextAnnotationObject',
    ]) {
        assert.match(source, new RegExp(`\\b${guard}\\b`), `barrel must export \`${guard}\``);
    }
});

test('barrel re-exports documented public type names', async () => {
    const source = await readBarrel();

    const expectedTypeNames = [
        'ImageEditorOptions',
        'ResolvedOptions',
        'LayoutMode',
        'EditorObjectKind',
        'EditorToolMode',
        'AnnotationType',
        'SessionObjectType',
        'EditorObjectMeta',
        'LabelConfig',
        'CropConfig',
        'CropAspectRatioPreset',
        'CropAspectRatio',
        'CropModeOptions',
        'CropExportFileType',
        'MosaicConfig',
        'ResolvedMosaicConfig',
        'MosaicOutputFileType',
        'TextAnnotationConfig',
        'ResolvedTextAnnotationConfig',
        'DrawConfig',
        'ResolvedDrawConfig',
        'DefaultMaskConfig',
        'MaskConfig',
        'MaskObject',
        'MaskNumericProp',
        'ResolvedMaskConfig',
        'BaseImageObject',
        'SessionObject',
        'AnnotationObject',
        'TextAnnotationObject',
        'DrawAnnotationObject',
        'AnnotationUpdateConfig',
        'RemoveAllAnnotationsOptions',
        'ExportArea',
        'ImageExportOptions',
        'ImageInfo',
        'ImageEditorState',
        'ImageEditorSelection',
        'ImageEditorCallbackContext',
        'ImageEditorOperation',
        'ElementIdMap',
        'FabricModule',
    ];

    for (const name of expectedTypeNames) {
        const pattern = new RegExp(`\\b${name}\\b`);
        assert.match(
            source,
            pattern,
            `barrel must re-export the documented public type \`${name}\``,
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
        /export\s*\{\s*[A-Za-z]+Manager\b/,
    ];

    for (const pattern of forbiddenInternalExports) {
        assert.equal(
            pattern.test(source),
            false,
            `barrel must not match ${pattern} (internal helper leaked to root)`,
        );
    }
});
