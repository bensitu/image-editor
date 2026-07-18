import assert from 'node:assert/strict';
import test from 'node:test';

import { createWatermarkPlugin, watermarkPluginRef } from '../dist/esm/index.js';

test('watermark package publishes a manifest-backed plugin', () => {
    const plugin = createWatermarkPlugin();
    assert.equal(plugin.ref, watermarkPluginRef);
    assert.equal(plugin.manifest.id, '@bensitu/reference-watermark');
    assert.deepEqual(plugin.manifest.permissions, ['fabric:objects', 'fabric:custom-class']);
});
