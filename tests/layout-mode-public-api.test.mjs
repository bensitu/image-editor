/**
 * Type:
 *   Unit test
 *
 * Purpose:
 *   Verifies ImageEditor.setLayoutMode exposes the layout strategy selection
 *   as a public API instead of requiring consumers to mutate private options.
 *
 * Scope:
 *   - Each public mode maps to exactly one active layout flag.
 *   - Invalid JavaScript input is ignored and reported through onWarning.
 *
 * Out of scope:
 *   - image decoding and rendering behavior
 *   - layout math, which is covered by layout-manager property tests
 *
 * Environment:
 *   - Node.js ESM
 *   - Fabric behavior is structurally mocked; no canvas is created.
 *
 * Run:
 *   node --test tests/layout-mode-public-api.test.mjs
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { ImageEditor } = await import('../src/image-editor.ts');

function makeFakeFabric() {
    return { Canvas: function FakeCanvas() {} };
}

function layoutFlags(editor) {
    return {
        fitImageToCanvas: editor.options.fitImageToCanvas,
        coverImageToCanvas: editor.options.coverImageToCanvas,
        expandCanvasToImage: editor.options.expandCanvasToImage,
    };
}

test('setLayoutMode selects exactly one layout flag for future loads', () => {
    const editor = new ImageEditor(makeFakeFabric(), {
        fitImageToCanvas: false,
        coverImageToCanvas: false,
        expandCanvasToImage: true,
    });

    editor.setLayoutMode('fit');
    assert.deepEqual(layoutFlags(editor), {
        fitImageToCanvas: true,
        coverImageToCanvas: false,
        expandCanvasToImage: false,
    });

    editor.setLayoutMode('cover');
    assert.deepEqual(layoutFlags(editor), {
        fitImageToCanvas: false,
        coverImageToCanvas: true,
        expandCanvasToImage: false,
    });

    editor.setLayoutMode('expand');
    assert.deepEqual(layoutFlags(editor), {
        fitImageToCanvas: false,
        coverImageToCanvas: false,
        expandCanvasToImage: true,
    });
});

test('setLayoutMode ignores invalid JavaScript input and reports a warning', () => {
    const warnings = [];
    const editor = new ImageEditor(makeFakeFabric(), {
        fitImageToCanvas: true,
        coverImageToCanvas: false,
        expandCanvasToImage: false,
        onWarning: (error, message) => warnings.push({ error, message }),
    });

    editor.setLayoutMode('stretch');

    assert.deepEqual(layoutFlags(editor), {
        fitImageToCanvas: true,
        coverImageToCanvas: false,
        expandCanvasToImage: false,
    });
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].error instanceof TypeError);
    assert.match(warnings[0].message, /layout mode/i);
});
