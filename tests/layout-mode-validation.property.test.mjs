/**
 * Type:
 *   Unit test
 *
 * Purpose:
 *   Verifies constructor layout-mode validation for the canonical
 *   defaultLayoutMode option.
 *
 * Scope:
 *   - resolveOptions falls back invalid defaultLayoutMode values to expand.
 *   - ImageEditor reports invalid constructor defaultLayoutMode through onWarning.
 *   - layoutMode is internal and ignored as a public constructor option.
 *
 * Out of scope:
 *   - detailed layout geometry
 *   - runtime setLayoutMode behavior, covered by layout-mode-public-api
 *
 * Environment:
 *   - Node.js ESM
 *   - Fabric/canvas behavior is mocked where needed
 *
 * Run:
 *   node --test tests/layout-mode-validation.property.test.mjs
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { ImageEditor } = await import('../src/image-editor.ts');
const { resolveOptions } = await import('../src/core/default-options.ts');

function makeFakeFabric() {
    return { Canvas: function FakeCanvas() {} };
}

test('invalid defaultLayoutMode resolves to expand', () => {
    for (const defaultLayoutMode of ['stretch', null, 123, false, {}, []]) {
        const resolved = resolveOptions({ defaultLayoutMode });

        assert.equal(resolved.defaultLayoutMode, 'expand');
        assert.equal(resolved.layoutMode, 'expand');
    }
});

test('valid defaultLayoutMode initializes current layoutMode', () => {
    for (const defaultLayoutMode of ['fit', 'cover', 'expand']) {
        const resolved = resolveOptions({ defaultLayoutMode });

        assert.equal(resolved.defaultLayoutMode, defaultLayoutMode);
        assert.equal(resolved.layoutMode, defaultLayoutMode);
    }
});

test('layoutMode is ignored as an unknown public constructor option', () => {
    const resolved = resolveOptions({ layoutMode: 'fit' });

    assert.equal(resolved.defaultLayoutMode, 'expand');
    assert.equal(resolved.layoutMode, 'expand');
});

test('ImageEditor reports invalid constructor defaultLayoutMode through onWarning', () => {
    const calls = [];

    new ImageEditor(makeFakeFabric(), {
        defaultLayoutMode: 'stretch',
        onWarning: (error, message) => {
            calls.push({ error, message });
        },
    });

    assert.equal(calls.length, 1);
    assert.ok(calls[0].error instanceof TypeError);
    assert.match(calls[0].message, /defaultLayoutMode/i);
    assert.match(calls[0].message, /expand/i);
});
