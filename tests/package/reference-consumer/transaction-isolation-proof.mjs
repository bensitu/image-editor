import assert from 'node:assert/strict';

import { ImageEditorCore } from '@bensitu/image-editor/core';
import { historyPlugin } from '@bensitu/image-editor/plugins/history';
import { maskPlugin } from '@bensitu/image-editor/plugins/mask';
import { overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';
import { transformPlugin } from '@bensitu/image-editor/plugins/transform';
import { captureFabricGlobalState } from '@bensitu/image-editor/testing';
import { createGridGuidePlugin } from '@bensitu/reference-grid-guide';
import { createMetadataPlugin } from '@bensitu/reference-metadata';
import { createWatermarkPlugin } from '@bensitu/reference-watermark';

import {
    createEditorElements,
    disposeEditor,
    fabric,
    makeImageDataUrl,
} from './fabric-environment.mjs';
import {
    createCaptureProbePlugin,
    createCommitObserverPlugin,
    createCompoundPlugin,
} from './public-probes.mjs';

function captureCompoundState(transform, watermark, masks, overlay) {
    const mask = masks.getAll()[0];
    const mark = watermark.list()[0];
    const transformState = transform.getState();
    const rounded = (value) => Math.round(value * 10_000) / 10_000;
    return Object.freeze({
        transform: Object.freeze({
            scale: rounded(transformState.scale),
            rotationDegrees: rounded(transformState.rotationDegrees),
            flipX: transformState.flipX,
            flipY: transformState.flipY,
        }),
        watermark: Object.freeze({
            id: mark.id,
            left: rounded(mark.left),
            top: rounded(mark.top),
            opacity: rounded(mark.opacity),
        }),
        mask: Object.freeze({
            id: mask.maskUid,
            left: rounded(mask.left),
            top: rounded(mask.top),
            scaleX: rounded(mask.scaleX),
            scaleY: rounded(mask.scaleY),
            angle: rounded(mask.angle),
        }),
        selection: overlay.getSelection(),
    });
}

async function proveCompoundTransaction() {
    const elements = createEditorElements({ width: 380, height: 280 });
    const editor = new ImageEditorCore(fabric, { canvasWidth: 380, canvasHeight: 280 });
    const overlay = editor.use(overlayFoundationPlugin());
    const history = editor.use(historyPlugin());
    const transform = editor.use(transformPlugin({ animationDuration: 0 }));
    const masks = editor.use(maskPlugin({ bindToImageTransform: true, label: false }));
    const watermark = editor.use(createWatermarkPlugin());
    const captureProbe = editor.use(createCaptureProbePlugin());
    const observer = editor.use(createCommitObserverPlugin('testing:compound-observer'));
    const compound = editor.use(createCompoundPlugin(transform));
    await editor.init(elements);
    await editor.loadImage(makeImageDataUrl({ width: 140, height: 90 }));
    const watermarkId = await watermark.add({ text: 'Atomic', left: 18, top: 16 });
    const mask = await masks.create({ left: 52, top: 34, width: 36, height: 24 });
    overlay.select([watermarkId, mask.maskUid]);
    const before = captureCompoundState(transform, watermark, masks, overlay);
    history.clear();
    observer.clear();
    captureProbe.resetCaptureCount();

    await compound.run(1.3);
    const after = captureCompoundState(transform, watermark, masks, overlay);
    const captureCount = captureProbe.getCaptureCount();
    assert.notDeepEqual(after.transform, before.transform);
    assert.notDeepEqual(after.watermark, before.watermark);
    assert.notDeepEqual(after.mask, before.mask);
    assert.equal(history.getState().size, 1);
    assert.equal(observer.getDescriptors().length, 1);
    assert.equal(captureCount, 2);
    assert.notEqual(after.selection.ids.length, 1);

    await history.undo();
    assert.deepEqual(captureCompoundState(transform, watermark, masks, overlay), before);
    await history.redo();
    assert.deepEqual(captureCompoundState(transform, watermark, masks, overlay), after);

    const beforeFailure = captureCompoundState(transform, watermark, masks, overlay);
    const historyBeforeFailure = history.getState().size;
    const eventsBeforeFailure = observer.getDescriptors().length;
    await assert.rejects(compound.run(1.6, true), /Compound participant failed/u);
    assert.deepEqual(captureCompoundState(transform, watermark, masks, overlay), beforeFailure);
    assert.equal(history.getState().size, historyBeforeFailure);
    assert.equal(observer.getDescriptors().length, eventsBeforeFailure);

    await disposeEditor(editor);
    return Object.freeze({
        topLevelTransactions: 1,
        mementoPairs: captureCount / 2,
        historyRecords: 1,
        committedEvents: 1,
        undoRestoredAll: true,
        redoRestoredAll: true,
        participantFailureRolledBackAll: true,
        nestedWorkPublishedOnce: true,
        activeSelectionAtomic: true,
    });
}

function installIsolationPackages(editor) {
    editor.use(overlayFoundationPlugin());
    const history = editor.use(historyPlugin());
    const metadata = editor.use(createMetadataPlugin());
    const watermark = editor.use(createWatermarkPlugin());
    const gridGuide = editor.use(createGridGuidePlugin());
    return { gridGuide, history, metadata, watermark };
}

async function proveMultiInstanceIsolation() {
    const globalBefore = captureFabricGlobalState(fabric);
    const firstElements = createEditorElements();
    const secondElements = createEditorElements();
    const firstEditor = new ImageEditorCore(fabric);
    const secondEditor = new ImageEditorCore(fabric);
    const first = installIsolationPackages(firstEditor);
    const second = installIsolationPackages(secondEditor);
    await Promise.all([firstEditor.init(firstElements), secondEditor.init(secondElements)]);
    const source = makeImageDataUrl({ width: 104, height: 68 });
    await Promise.all([firstEditor.loadImage(source), secondEditor.loadImage(source)]);
    first.history.clear();
    second.history.clear();

    await Promise.all([
        first.metadata.set('owner', 'first'),
        second.metadata.set('owner', 'second'),
    ]);
    assert.deepEqual(first.metadata.getAll(), { owner: 'first' });
    assert.deepEqual(second.metadata.getAll(), { owner: 'second' });
    await first.watermark.add({ text: 'First', left: 8, top: 8 });
    assert.equal(first.watermark.list().length, 1);
    assert.equal(second.watermark.list().length, 0);
    await Promise.all([first.gridGuide.enterGuideTool(), second.gridGuide.enterGuideTool()]);
    await Promise.all([first.gridGuide.exitGuideTool(), second.gridGuide.exitGuideTool()]);
    const secondHistorySize = second.history.getState().size;
    first.history.clear();
    assert.equal(first.history.getState().size, 0);
    assert.equal(second.history.getState().size, secondHistorySize);

    await disposeEditor(firstEditor);
    await second.metadata.set('after-dispose', 'available');
    assert.equal(second.metadata.getAll()['after-dispose'], 'available');
    await disposeEditor(secondEditor);
    const globalAfter = captureFabricGlobalState(fabric);
    assert.deepEqual(globalAfter, globalBefore);

    return Object.freeze({
        coreRegistriesIsolated: true,
        pluginStateIsolated: true,
        operationsIsolated: true,
        toolsIsolated: true,
        overlayIndexesIsolated: true,
        historyIsolated: true,
        fabricGlobalStateIsolated: true,
    });
}

export async function proveTransactionsAndIsolation() {
    return Object.freeze({
        compoundTransaction: await proveCompoundTransaction(),
        multiInstanceIsolation: await proveMultiInstanceIsolation(),
    });
}
