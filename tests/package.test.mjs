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
        'VERSION'
    ];

    assert.match(declaration, /declare module '@bensitu\/image-editor'/);
    assert.match(declaration, /export default ImageEditor/);
    assert.match(declaration, /export class ImageEditor/);
    assert.match(declaration, /exportImageFile/);
    assert.match(declaration, /enterCropMode/);
    assert.match(declaration, /applyCrop/);

    for (const api of removedApis) {
        assert.equal(declaration.includes(api), false, `${api} should not be declared`);
    }
});

test('docs demo can load ImageEditor on GitHub Pages', () => {
    const html = readFileSync('docs/index.html', 'utf8');

    assert.match(html, /cdn\.jsdelivr\.net\/npm\/@bensitu\/image-editor\/dist\/image-editor\.js/);
    assert.equal(/<script\s+src=["']\.\.\/dist\/image-editor\.js/.test(html), false);
});

test('docs canvas container only shows scrollbars when content overflows', () => {
    const css = readFileSync('docs/css/style.css', 'utf8');

    assert.match(css, /#imageContainer\s*{[\s\S]*overflow:\s*auto;/);
    assert.equal(/#imageContainer\s*{[\s\S]*overflow:\s*scroll;/.test(css), false);
});
