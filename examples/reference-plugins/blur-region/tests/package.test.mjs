import assert from 'node:assert/strict';
import test from 'node:test';

import { createBlurRegionPlugin, blurRegionPluginRef } from '../dist/esm/index.js';

test('blur region package requests the narrow raster boundary without Canvas access', () => {
    const plugin = createBlurRegionPlugin({ rasterize: async () => ({}) });
    assert.equal(plugin.ref, blurRegionPluginRef);
    assert.deepEqual(plugin.manifest.permissions, [
        'fabric:objects',
        'fabric:custom-class',
        'core:raster-mutation',
    ]);
    assert.equal(
        plugin.manifest.requires.some(
            (entry) =>
                entry.token.id === 'core:canvas-read' || entry.token.id === 'core:base-image-read',
        ),
        false,
    );
});
