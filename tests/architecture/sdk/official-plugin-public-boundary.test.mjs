import assert from 'node:assert/strict';
import test from 'node:test';

import { inspectOfficialPlugins } from '../../../scripts/check-official-plugin-compliance.mjs';

test('official Plugins use public contracts and retain setup registrations', async () => {
    const result = await inspectOfficialPlugins();

    assert.equal(result.result, 'PASS', JSON.stringify(result.diagnostics, null, 2));
    assert.deepEqual(result.summary, {
        officialPluginInternalImports: 0,
        officialPluginUndeclaredPermissions: 0,
        officialPluginHiddenCoreCapabilities: 0,
        officialPluginBroadMutableHostAccess: 0,
        officialPluginSetupLeaks: 0,
    });
});
