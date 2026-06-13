/**
 * Type:
 *   Unit test
 *
 * Purpose:
 *   Verifies Mosaic configuration defaults, normalization, runtime patching, and
 *   defensive copy behavior.
 *
 * Scope:
 *   - Constructor defaults and defaultMosaicConfig overrides are normalized.
 *   - Runtime setters patch current Mosaic config without mutating constructor
 *     defaults.
 *   - Invalid Mosaic runtime values warn and leave current config unchanged.
 *   - Dash arrays are defensively copied for public reads and config merges.
 *
 * Out of scope:
 *   - Mosaic pixel processing
 *   - Mosaic pointer geometry
 *   - canvas preview rendering
 *
 * Environment:
 *   - Node.js ESM
 *   - focused Fabric stubs
 *
 * Run:
 *   node --test tests/mosaic-config.test.mjs
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { DEFAULT_MOSAIC_CONFIG, resolveOptions, mergeMosaicConfigPatch, cloneResolvedMosaicConfig } =
    await import('../src/core/default-options.ts');
const { ImageEditor } = await import('../src/image-editor.ts');

function makeFabricStub() {
    class FakeFabricImage {}
    return {
        Canvas: class FakeCanvas {},
        FabricImage: FakeFabricImage,
        Image: FakeFabricImage,
    };
}

test('constructor omitted Mosaic config uses defaults', () => {
    const resolved = resolveOptions({});

    assert.deepEqual(resolved.defaultMosaicConfig, DEFAULT_MOSAIC_CONFIG);
    assert.equal(Object.isFrozen(resolved.defaultMosaicConfig), true);
    assert.equal(Object.isFrozen(resolved.defaultMosaicConfig.previewStrokeDashArray), true);
});

test('constructor defaultMosaicConfig overrides defaults and invalid values fall back safely', () => {
    const resolved = resolveOptions({
        defaultMosaicConfig: {
            brushSize: 64,
            blockSize: 12.8,
            previewStroke: '#f00',
            previewStrokeWidth: -1,
            previewStrokeDashArray: [2, 3],
            previewFill: 'rgba(255,0,0,0.1)',
            outputFileType: 'image/webp',
            outputQuality: 2,
        },
    });

    assert.equal(resolved.defaultMosaicConfig.brushSize, 64);
    assert.equal(resolved.defaultMosaicConfig.blockSize, 12);
    assert.equal(resolved.defaultMosaicConfig.previewStroke, '#f00');
    assert.equal(
        resolved.defaultMosaicConfig.previewStrokeWidth,
        DEFAULT_MOSAIC_CONFIG.previewStrokeWidth,
    );
    assert.deepEqual(resolved.defaultMosaicConfig.previewStrokeDashArray, [2, 3]);
    assert.equal(resolved.defaultMosaicConfig.previewFill, 'rgba(255,0,0,0.1)');
    assert.equal(resolved.defaultMosaicConfig.outputFileType, 'webp');
    assert.equal(resolved.defaultMosaicConfig.outputQuality, 1);
});

test('getMosaicConfig returns current config as a defensive copy', () => {
    const editor = new ImageEditor(makeFabricStub(), {
        defaultMosaicConfig: {
            brushSize: 40,
            blockSize: 6,
            previewStrokeDashArray: [1, 2],
        },
    });

    const config = editor.getMosaicConfig();
    assert.equal(config.brushSize, 40);
    assert.deepEqual(config.previewStrokeDashArray, [1, 2]);

    config.previewStrokeDashArray?.push(99);

    assert.deepEqual(editor.getMosaicConfig().previewStrokeDashArray, [1, 2]);
});

test('setMosaicConfig patches current config without mutating constructor defaults', () => {
    const editor = new ImageEditor(makeFabricStub(), {
        defaultMosaicConfig: {
            brushSize: 40,
            blockSize: 6,
        },
    });

    editor.setMosaicConfig({ brushSize: 72 });
    assert.equal(editor.getMosaicConfig().brushSize, 72);
    assert.equal(editor.getMosaicConfig().blockSize, 6);

    editor.resetMosaicConfig();
    assert.equal(editor.getMosaicConfig().brushSize, 40);
    assert.equal(editor.getMosaicConfig().blockSize, 6);
});

test('setMosaicBrushSize and setMosaicBlockSize normalize valid runtime values', () => {
    const editor = new ImageEditor(makeFabricStub(), {});

    editor.setMosaicBrushSize(80);
    editor.setMosaicBlockSize(9.9);

    assert.equal(editor.getMosaicConfig().brushSize, 80);
    assert.equal(editor.getMosaicConfig().blockSize, 9);
});

test('invalid runtime Mosaic setters no-op and warn', () => {
    const warnings = [];
    const editor = new ImageEditor(makeFabricStub(), {
        onWarning: (error, message) => warnings.push({ error, message }),
    });
    const before = editor.getMosaicConfig();

    editor.setMosaicBrushSize(Number.NaN);
    editor.setMosaicBlockSize(-3);
    editor.setMosaicConfig(null);

    assert.deepEqual(editor.getMosaicConfig(), before);
    assert.equal(warnings.length, 3);
    assert.match(warnings[0].message, /Mosaic config fields/);
    assert.match(warnings[2].message, /Mosaic config/);
});

test('Mosaic config changes do not create a history entry', () => {
    const states = [];
    const editor = new ImageEditor(makeFabricStub(), {
        onImageChanged: (state, context) => states.push({ state, context }),
    });

    editor.setMosaicConfig({ brushSize: 96 });

    assert.equal(states.length, 1);
    assert.equal(states[0].context.operation, 'setMosaicConfig');
    assert.equal(states[0].state.canUndo, false);
});

test('mergeMosaicConfigPatch and cloneResolvedMosaicConfig copy dash arrays defensively', () => {
    const current = cloneResolvedMosaicConfig(DEFAULT_MOSAIC_CONFIG);
    const next = mergeMosaicConfigPatch(current, { previewStrokeDashArray: [7, 8] });

    assert.deepEqual(next.previewStrokeDashArray, [7, 8]);
    next.previewStrokeDashArray?.push(9);
    assert.deepEqual(current.previewStrokeDashArray, [4, 4]);
});
