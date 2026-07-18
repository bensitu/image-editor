import assert from 'node:assert/strict';
import test from 'node:test';

import { createFrameworkRedactionAdapter } from '../../examples/fabric-vs-framework-redaction/image-editor-framework/index.ts';
import { createPureFabricRedactionAdapter } from '../../examples/fabric-vs-framework-redaction/pure-fabric/index.ts';
import { runRedactionScenario } from '../../examples/fabric-vs-framework-redaction/shared-scenarios/index.ts';
import { makeImageDataUrl, resetEditorDom } from '../helpers/fabric-environment.mjs';

const invalidImageSource = 'comparison:invalid-image-source';

async function runPureFabricScenario() {
    const ids = resetEditorDom({ containerWidth: 320, containerHeight: 240 });
    const canvas = document.getElementById(ids.canvas);
    assert.ok(canvas instanceof HTMLCanvasElement);
    const adapter = await createPureFabricRedactionAdapter(canvas);
    return runRedactionScenario(adapter, makeImageDataUrl(), invalidImageSource);
}

async function runFrameworkScenario() {
    const ids = resetEditorDom({ containerWidth: 320, containerHeight: 240 });
    const canvas = document.getElementById(ids.canvas);
    const container = document.getElementById(ids.canvasContainer);
    assert.ok(canvas instanceof HTMLCanvasElement);
    assert.ok(container instanceof HTMLElement);
    const adapter = await createFrameworkRedactionAdapter(canvas, container);
    return runRedactionScenario(adapter, makeImageDataUrl(), invalidImageSource);
}

test('pure Fabric and the framework complete the same redaction scenario', async () => {
    const results = [await runPureFabricScenario(), await runFrameworkScenario()];

    for (const result of results) {
        assert.equal(result.rotation, 90);
        assert.equal(result.maskCountAfterAdd, 1);
        assert.equal(result.maskCountAfterUndo, 0);
        assert.equal(result.rotationChangedSnapshot, true);
        assert.equal(result.maskChangedSnapshot, true);
        assert.equal(result.undoChangedSnapshot, true);
        assert.equal(result.failedLoadRolledBack, true);
        assert.equal(result.disposed, true);
    }
});
