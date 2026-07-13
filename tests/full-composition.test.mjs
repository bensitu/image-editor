import assert from 'node:assert/strict';
import test from 'node:test';

import { createFullCompatibilityComposition } from '../src/compatibility/full-composition.js';
import { resolveOptions } from '../src/core/default-options.js';
import { fabric } from './helpers/fabric-environment.mjs';

test('Full compatibility composition installs plugins without constructing a Canvas', async () => {
    let canvasConstructions = 0;
    let legacyDisposals = 0;
    const countingFabric = {
        ...fabric,
        Canvas: class CountingCanvas {
            constructor() {
                canvasConstructions += 1;
            }
        },
    };
    const legacyFeatures = {
        attached: false,
        attach() {
            this.attached = true;
        },
        dispose() {
            legacyDisposals += 1;
        },
    };

    const composition = createFullCompatibilityComposition(
        countingFabric,
        resolveOptions({ animationDuration: 0 }),
        legacyFeatures,
    );

    assert.equal(canvasConstructions, 0);
    assert.equal(composition.legacyFeatures.attached, false);
    assert.deepEqual(composition.transform.getState(), {
        scale: 1,
        rotationDegrees: 0,
        flipX: false,
        flipY: false,
    });
    assert.equal(typeof composition.masks.getAll, 'function');
    assert.equal(composition.history.canUndo(), false);

    await composition.dispose();
    await composition.dispose();
    assert.equal(legacyDisposals, 1);
    assert.equal(canvasConstructions, 0);
});
