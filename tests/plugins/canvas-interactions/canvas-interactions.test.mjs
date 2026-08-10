import assert from 'node:assert/strict';
import test from 'node:test';

import { ImageEditorCore } from '../../../src/core/index.js';
import {
    canvasInteractionsPlugin,
    canvasInteractionsPluginRef,
} from '../../../src/plugins/canvas-interactions/index.js';
import { fabric, resetEditorDom } from '../../helpers/fabric-environment.mjs';

test('Canvas Interactions installs as an optional Plugin with an isolated status lifecycle', async () => {
    const ids = resetEditorDom({ containerWidth: 320, containerHeight: 240 });
    const editor = new ImageEditorCore(fabric, { canvasWidth: 320, canvasHeight: 240 });
    const interactions = editor.use(canvasInteractionsPlugin());
    const statuses = [];
    const subscription = interactions.subscribe((status) => statuses.push(status));

    await editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
    assert.equal(editor.requirePlugin(canvasInteractionsPluginRef), interactions);
    assert.deepEqual(interactions.getStatus(), {
        isBound: false,
        isDisposed: false,
        activeBindingId: null,
        gestureActive: false,
    });
    await interactions.cancel();
    subscription.dispose();
    await editor.disposeAsync();
    document.body.innerHTML = '';

    assert.equal(statuses.length, 1);
});
