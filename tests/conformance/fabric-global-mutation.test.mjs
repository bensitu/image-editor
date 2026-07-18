import assert from 'node:assert/strict';
import test from 'node:test';

import { assertNoUndeclaredFabricGlobalMutation } from '../../src/testing/index.js';
import { fabric } from '../helpers/fabric-environment.mjs';

const probeProperty = 'referenceGlobalProbe';

function mutationLifecycle(permissions = []) {
    return {
        fabric,
        importModule: () => Object.freeze({ ready: true }),
        createDefinition: () => Object.freeze({ manifest: Object.freeze({ permissions }) }),
        setup: () => {
            Object.defineProperty(fabric.Object.prototype, probeProperty, {
                configurable: true,
                value: true,
            });
            return Object.freeze({ ready: true });
        },
        dispose: () => {
            delete fabric.Object.prototype[probeProperty];
        },
    };
}

test('global Fabric detection passes when known surfaces remain unchanged', async () => {
    const result = await assertNoUndeclaredFabricGlobalMutation({
        fabric,
        importModule: () => Object.freeze({ ready: true }),
        createDefinition: () => Object.freeze({ manifest: Object.freeze({ permissions: [] }) }),
        setup: () => Object.freeze({ ready: true }),
        dispose: () => undefined,
    });

    assert.equal(result.status, 'PASS');
    assert.equal(result.details.isolation, 'STRONG');
    assert.deepEqual(result.details.changedSurfaces, []);
});

test('undeclared Fabric prototype mutation fails with phase evidence', async () => {
    const result = await assertNoUndeclaredFabricGlobalMutation(mutationLifecycle());

    assert.equal(result.status, 'FAIL');
    assert.equal(result.details.isolation, 'FAILED');
    assert.equal(
        result.details.changedSurfaces.some((surface) => surface.endsWith(probeProperty)),
        true,
    );
    assert.deepEqual(
        result.details.phases.map((entry) => entry.phase),
        ['setup', 'dispose'],
    );
    assert.equal(Object.hasOwn(fabric.Object.prototype, probeProperty), false);
});

test('declared Fabric mutation is reported with downgraded isolation', async () => {
    const result = await assertNoUndeclaredFabricGlobalMutation(
        mutationLifecycle(['fabric:global-mutation']),
    );

    assert.equal(result.status, 'PASS_WITH_DOWNGRADED_ISOLATION');
    assert.equal(result.details.isolation, 'DOWNGRADED');
    assert.equal(result.details.declarationPresent, true);
    assert.equal(Object.hasOwn(fabric.Object.prototype, probeProperty), false);
});
