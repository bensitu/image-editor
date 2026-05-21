import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

test('package metadata points to generated files', () => {
    const packagePaths = [
        packageJson.main,
        packageJson.module,
        packageJson.types,
        packageJson.exports['.'].types,
        packageJson.exports['.'].import,
        packageJson.exports['.'].default
    ];

    for (const packagePath of packagePaths) {
        const localPath = packagePath.replace(/^\.\//, '');
        assert.equal(existsSync(localPath), true, `${packagePath} should exist`);
    }
});

test('dist contains compressed and uncompressed browser and ESM builds', () => {
    const expectedFiles = [
        'dist/image-editor.js',
        'dist/image-editor.js.map',
        'dist/image-editor.min.js',
        'dist/image-editor.min.js.map',
        'dist/image-editor.esm.js',
        'dist/image-editor.esm.js.map',
        'dist/image-editor.esm.min.js',
        'dist/image-editor.esm.min.js.map',
        'dist/image-editor.esm.mjs',
        'dist/image-editor.esm.mjs.map',
        'dist/image-editor.esm.min.mjs',
        'dist/image-editor.esm.min.mjs.map'
    ];

    for (const fileName of expectedFiles) {
        assert.equal(existsSync(fileName), true, `${fileName} should exist`);
    }
});

test('package ESM import exposes default and named ImageEditor exports', async () => {
    const module = await import('@bensitu/image-editor');

    assert.equal(typeof module.default, 'function');
    assert.equal(typeof module.ImageEditor, 'function');
    assert.equal(module.default, module.ImageEditor);
});

test('browser build exposes ImageEditor as a global for script usage', () => {
    delete globalThis.ImageEditor;
    require('../dist/image-editor.js');

    assert.equal(typeof globalThis.ImageEditor, 'function');
});

test('type declarations match the public package API', () => {
    const declaration = readFileSync('image-editor.d.ts', 'utf8');
    const removedApis = [
        'declare module \'image-editor\'',
        'addCircleMask',
        'addPolygonMask',
        'removeMask(',
        'getMask(',
        'getAllMasks',
        'selectMask',
        'exportAs',
        'canUndo',
        'canRedo',
        'setTheme',
        'setLanguage',
        'validateOptions',
        'createImageEditor',
        'DEFAULT_OPTIONS',
        'SUPPORTED_FORMATS',
        'VERSION',
        'setFabric('
    ];

    assert.match(declaration, /declare module '@bensitu\/image-editor'/);
    assert.match(declaration, /export default ImageEditor/);
    assert.match(declaration, /export class ImageEditor/);
    assert.match(declaration, /canvasElement/);
    assert.match(declaration, /containerElement/);
    assert.match(declaration, /@deprecated Use canvasElement instead/);
    assert.match(declaration, /will be removed in v2\.0\.0/);
    assert.match(declaration, /createMask/);
    assert.match(declaration, /@deprecated Use createMask\(\) instead/);
    assert.match(declaration, /mergeMasks/);
    assert.match(declaration, /@deprecated Use mergeMasks\(\) instead/);
    assert.match(declaration, /resetImageTransform/);
    assert.match(declaration, /@deprecated Use resetImageTransform\(\) instead/);
    assert.match(declaration, /exportImageBase64/);
    assert.match(declaration, /@deprecated Use exportImageBase64\(\) instead/);
    assert.match(declaration, /exportImageFile/);
    assert.match(declaration, /enterCropMode/);
    assert.match(declaration, /applyCrop/);
    assert.match(declaration, /export interface LoadImageOptions/);
    assert.match(declaration, /imageLoadTimeoutMs\?: number/);
    assert.match(declaration, /loadImage\(imageBase64: string, options\?: LoadImageOptions\): Promise<void>;/);
    assert.match(declaration, /export interface RemoveAllMasksOptions/);
    assert.match(declaration, /removeAllMasks\(options\?: RemoveAllMasksOptions\): void;/);
    assert.match(declaration, /points\?: Array<\{ x: number; y: number \}> \| Array<\[number, number\]>/);
    assert.match(declaration, /fileType\?: 'jpeg' \| 'jpg' \| 'png' \| 'webp'/);
    assert.match(declaration, /undo\(\): Promise<void>;/);
    assert.match(declaration, /redo\(\): Promise<void>;/);
    assert.match(declaration, /loadFromState\(serializedState: string \| object\): Promise<void>;/);

    for (const api of removedApis) {
        assert.equal(declaration.includes(api), false, `${api} should not be declared`);
    }
});

test('docs demo can load ImageEditor on GitHub Pages', () => {
    const html = readFileSync('docs/index.html', 'utf8');
    const script = readFileSync('docs/js/script.js', 'utf8');

    assert.match(html, /cdn\.jsdelivr\.net\/npm\/@bensitu\/image-editor\/dist\/image-editor\.js/);
    assert.equal(/<script\s+src=["']\.\.\/dist\/image-editor\.js/.test(html), false);
    assert.match(script, /exportImageBase64\(\)/);
    assert.equal(script.includes('getImageBase64('), false);
    assert.match(script, /imageInput:\s*null/);
    assert.match(script, /uploadArea:\s*null/);
});

test('docs canvas container only shows scrollbars when content overflows', () => {
    const css = readFileSync('docs/css/style.css', 'utf8');

    assert.match(css, /#imageContainer\s*{[\s\S]*overflow:\s*auto;/);
    assert.equal(/#imageContainer\s*{[\s\S]*overflow:\s*scroll;/.test(css), false);
});

test('release workflows attach npm artifacts and publish the reviewed artifact manually', () => {
    const draftReleaseWorkflow = readFileSync('.github/workflows/draft-release.yml', 'utf8');
    const publishWorkflow = readFileSync('.github/workflows/publish-npm.yml', 'utf8');

    assert.match(draftReleaseWorkflow, /workflow_dispatch:/);
    assert.match(draftReleaseWorkflow, /version:/);
    assert.match(draftReleaseWorkflow, /npm ci --include=optional/);
    assert.match(draftReleaseWorkflow, /npm pack --json/);
    assert.match(draftReleaseWorkflow, /sha256sum "\$\{PACKAGE_TARBALL\}"/);
    assert.match(draftReleaseWorkflow, /git tag -a "\$\{TAG_NAME\}"/);
    assert.match(draftReleaseWorkflow, /gh release create "\$\{TAG_NAME\}" "\$\{PACKAGE_TARBALL\}" "\$\{PACKAGE_CHECKSUM\}" --draft/);
    assert.equal(/1\.3\.0|v1\.3\.0/.test(draftReleaseWorkflow), false);
    assert.equal(/1\.3\.0|v1\.3\.0/.test(publishWorkflow), false);
    assert.match(publishWorkflow, /workflow_dispatch:/);
    assert.match(publishWorkflow, /gh release download "\$\{TAG_NAME\}" --pattern '\*\.tgz' --pattern '\*\.sha256'/);
    assert.match(publishWorkflow, /sha256sum -c "\$\{PACKAGE_CHECKSUMS\[0\]\}"/);
    assert.match(publishWorkflow, /npm publish "\.\/\$\{PACKAGE_TARBALL\}" --access public --tag "\$\{NPM_TAG\}"/);
    assert.equal(/^\s*(npm run lint|npm test|npm pack\b)/m.test(publishWorkflow), false);
});
