import assert from 'node:assert/strict';
import test from 'node:test';

import { CORE_STATUS_CAPABILITY } from '@bensitu/image-editor/sdk';
import { createPluginTestHost } from '@bensitu/image-editor/testing';

import { statusPlugin, statusPluginRef } from '../dist/esm/index.js';

test('template Plugin installs, configures, infers its reference, and disposes', () => {
    let disposed = false;
    const host = createPluginTestHost({
        hostCapabilities: [
            {
                token: CORE_STATUS_CAPABILITY,
                implementation: { isDisposed: () => disposed },
            },
        ],
    });
    const api = host.installSync(statusPlugin({ label: 'Canvas' }));

    assert.equal(host.get(statusPluginRef), api);
    assert.equal(api.read(), 'Canvas: ready');
    api.configure({ label: 'Document' });
    assert.deepEqual(api.getConfiguration(), { label: 'Document' });

    disposed = true;
    host.disposeSync();
    assert.throws(() => api.read(), /disposed/);
});
