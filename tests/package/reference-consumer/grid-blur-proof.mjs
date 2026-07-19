import assert from 'node:assert/strict';

import { ImageEditorCore } from '@bensitu/image-editor/core';
import { historyPlugin } from '@bensitu/image-editor/plugins/history';
import { overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';
import { createBlurRegionPlugin } from '@bensitu/reference-blur-region';
import { createGridGuidePlugin } from '@bensitu/reference-grid-guide';

import {
    createEditorElements,
    disposeEditor,
    fabric,
    makeImageDataUrl,
} from './fabric-environment.mjs';
import { createCommitObserverPlugin, createRestoreFailurePlugin } from './public-probes.mjs';

async function proveGridGuide() {
    const elements = createEditorElements();
    const editor = new ImageEditorCore(fabric, { canvasWidth: 360, canvasHeight: 260 });
    editor.use(overlayFoundationPlugin());
    const history = editor.use(historyPlugin());
    const gridGuide = editor.use(createGridGuidePlugin({ configuration: { spacing: 40 } }));
    const observer = editor.use(createCommitObserverPlugin('testing:grid-guide-observer'));
    await editor.init(elements);
    await editor.loadImage(makeImageDataUrl({ width: 120, height: 80 }));
    history.clear();
    observer.clear();

    await gridGuide.enable();
    assert.equal(gridGuide.isEnabled(), true);
    const horizontal = await gridGuide.addGuide('horizontal', 24);
    const vertical = await gridGuide.addGuide('vertical', 36);
    assert.deepEqual(gridGuide.listGuideIds(), [horizontal, vertical]);
    await gridGuide.enterGuideTool();
    await gridGuide.exitGuideTool();
    const snapshot = editor.saveState();
    assert.equal(snapshot.includes('reference:grid-guide'), false);
    assert.equal(history.getState().size, 0);
    assert.equal(observer.getDescriptors().length, 0);

    const configuration = gridGuide.getConfiguration();
    await assert.rejects(gridGuide.configure({ spacing: 0 }), TypeError);
    assert.deepEqual(gridGuide.getConfiguration(), configuration);
    await gridGuide.clearGuides();
    await gridGuide.disable();
    assert.equal(gridGuide.isEnabled(), false);
    assert.deepEqual(gridGuide.listGuideIds(), []);
    assert.equal(history.getState().size, 0);

    await disposeEditor(editor);
    const reinstall = new ImageEditorCore(fabric);
    reinstall.use(overlayFoundationPlugin());
    reinstall.use(createGridGuidePlugin());
    await disposeEditor(reinstall);

    return Object.freeze({
        transientSnapshotExcluded: true,
        atomicVisibility: true,
        historyRecords: 0,
        committedEvents: 0,
        toolIntegration: true,
        cleanupVerified: true,
        persistentCodecRequired: false,
    });
}

async function createBlurEditor({ source, failureInjector, restoreFailure = false }) {
    const elements = createEditorElements();
    const editor = new ImageEditorCore(fabric, { canvasWidth: 320, canvasHeight: 220 });
    editor.use(overlayFoundationPlugin());
    const history = editor.use(historyPlugin());
    const observer = editor.use(createCommitObserverPlugin('testing:blur-observer'));
    const restore = restoreFailure ? editor.use(createRestoreFailurePlugin()) : null;
    const blur = editor.use(
        createBlurRegionPlugin({
            failureInjector,
            rasterize: async ({ signal }) => {
                if (signal.aborted) throw signal.reason;
                return fabric.FabricImage.fromURL(source);
            },
        }),
    );
    await editor.init(elements);
    await editor.loadImage(source);
    history.clear();
    observer.clear();
    return { blur, editor, history, observer, restore };
}

async function proveBlurRegion() {
    const source = makeImageDataUrl({ width: 100, height: 70, fill: '#cce8d4' });
    const normal = await createBlurEditor({ source });
    const previewId = await normal.blur.preview({ x: 12, y: 10, width: 30, height: 20 });
    const revisionBefore = normal.blur.list().length;
    await normal.blur.commit(previewId);
    assert.equal(revisionBefore, 1);
    assert.deepEqual(normal.blur.list(), []);
    assert.equal(normal.history.getState().size, 1);
    assert.equal(normal.observer.getDescriptors().length, 1);
    assert.equal(normal.editor.getImageInfo().naturalWidth, 100);
    assert.equal(normal.editor.getImageInfo().naturalHeight, 70);
    await normal.history.undo();
    assert.equal(normal.history.getState().position, 0);
    await normal.history.redo();
    assert.equal(normal.history.getState().position, 1);
    await disposeEditor(normal.editor);

    const failurePoints = ['prepare', 'decode', 'raster', 'synchronize', 'render', 'history'];
    const failureResults = {};
    for (const failurePoint of failurePoints) {
        const fixture = await createBlurEditor({
            source,
            failureInjector: (point) => {
                if (point === failurePoint) throw new Error(`Injected ${failurePoint} failure.`);
            },
        });
        const id = await fixture.blur.preview({ x: 8, y: 6, width: 24, height: 18 });
        const stateBefore = fixture.editor.saveState();
        await assert.rejects(fixture.blur.commit(id));
        assert.equal(fixture.editor.saveState(), stateBefore);
        assert.equal(fixture.history.getState().size, 0);
        assert.equal(fixture.observer.getDescriptors().length, 0);
        await fixture.editor.loadImage(source);
        assert.equal(fixture.editor.isImageLoaded(), true);
        failureResults[failurePoint] = 'PASS';
        await disposeEditor(fixture.editor);
    }

    const rollbackFixture = await createBlurEditor({
        source,
        failureInjector: (point) => {
            if (point === 'synchronize' || point === 'rollback') {
                throw new Error(`Injected ${point} failure.`);
            }
        },
    });
    const rollbackId = await rollbackFixture.blur.preview({ x: 4, y: 4, width: 20, height: 16 });
    const rollbackState = rollbackFixture.editor.saveState();
    await assert.rejects(rollbackFixture.blur.commit(rollbackId));
    assert.equal(rollbackFixture.editor.saveState(), rollbackState);
    assert.equal(rollbackFixture.history.getState().size, 0);
    assert.equal(rollbackFixture.observer.getDescriptors().length, 0);
    await rollbackFixture.editor.loadImage(source);
    failureResults.rollback = 'PASS';
    await disposeEditor(rollbackFixture.editor);

    const faultFixture = await createBlurEditor({
        source,
        restoreFailure: true,
        failureInjector: (point) => {
            if (point === 'synchronize') throw new Error('Injected synchronization failure.');
        },
    });
    const faultId = await faultFixture.blur.preview({ x: 3, y: 3, width: 18, height: 14 });
    faultFixture.restore.failNextRestore();
    await assert.rejects(faultFixture.blur.commit(faultId));
    assert.equal(faultFixture.editor.getLifecycleState(), 'faulted');
    await faultFixture.editor.emergencyReset();
    assert.equal(faultFixture.editor.getLifecycleState(), 'configured');
    await faultFixture.editor.init(createEditorElements());
    await faultFixture.editor.loadImage(source);
    assert.equal(faultFixture.editor.isImageLoaded(), true);
    await disposeEditor(faultFixture.editor);

    return Object.freeze({
        allowedRasterCommit: true,
        historyRecords: 1,
        committedEvents: 1,
        previewCleanup: true,
        baseImageDimensionsPreserved: true,
        failureResults: Object.freeze(failureResults),
        restoreFailureFaulted: true,
        emergencyRecovery: true,
    });
}

export async function proveGridAndBlur() {
    return Object.freeze({
        gridGuide: await proveGridGuide(),
        blurRegion: await proveBlurRegion(),
    });
}
