import assert from 'node:assert/strict';
import test from 'node:test';

import { createMetadataPlugin, metadataPluginRef } from '../dist/esm/index.js';

test('metadata package has no Fabric or Canvas permission', () => {
    const plugin = createMetadataPlugin();
    assert.equal(plugin.ref, metadataPluginRef);
    assert.deepEqual(plugin.manifest.permissions ?? [], []);
    assert.equal(
        plugin.manifest.requires.some((entry) => entry.token.id.includes('canvas')),
        false,
    );
});
