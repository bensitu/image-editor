import assert from 'node:assert/strict';
import test from 'node:test';

import { createGridGuidePlugin, gridGuidePluginRef } from '../dist/esm/index.js';

test('grid and guide package declares only its required Fabric permissions', () => {
    const plugin = createGridGuidePlugin();
    assert.equal(plugin.ref, gridGuidePluginRef);
    assert.deepEqual(plugin.manifest.permissions, ['fabric:objects', 'fabric:custom-class']);
    assert.equal(
        plugin.manifest.requires.some((entry) => entry.token.id === 'core:snapshot-registration'),
        false,
    );
});
