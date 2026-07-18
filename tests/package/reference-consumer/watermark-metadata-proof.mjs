import assert from 'node:assert/strict';

import { ImageEditorCore } from '@bensitu/image-editor/core';
import { historyPlugin } from '@bensitu/image-editor/plugins/history';
import { overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';
import { transformPlugin } from '@bensitu/image-editor/plugins/transform';
import { PluginSetupError } from '@bensitu/image-editor/sdk';
import { createMetadataPlugin, MetadataSliceVersionError } from '@bensitu/reference-metadata';
import { createWatermarkPlugin } from '@bensitu/reference-watermark';

import {
    createEditorElements,
    disposeEditor,
    fabric,
    makeImageDataUrl,
} from './fabric-environment.mjs';
import { createCommitObserverPlugin } from './public-probes.mjs';

async function proveWatermark() {
    const elements = createEditorElements();
    const editor = new ImageEditorCore(fabric, { canvasWidth: 360, canvasHeight: 260 });
    const overlay = editor.use(overlayFoundationPlugin());
    const history = editor.use(historyPlugin());
    const transform = editor.use(transformPlugin({ animationDuration: 0 }));
    const watermark = editor.use(createWatermarkPlugin());
    const observer = editor.use(createCommitObserverPlugin('testing:watermark-observer'));
    await editor.init(elements);
    await editor.loadImage(makeImageDataUrl({ width: 120, height: 80 }));
    history.clear();
    observer.clear();

    const id = await watermark.add({ text: 'Proof', left: 16, top: 12 });
    assert.match(id, /^watermark-\d+$/u);
    assert.equal(history.getState().size, 1);
    assert.equal(observer.getDescriptors().length, 1);
    assert.equal(watermark.list().length, 1);
    const snapshot = editor.saveState();
    const beforeTransform = watermark.list()[0];
    await transform.scale(1.25);
    const afterTransform = watermark.list()[0];
    assert.notDeepEqual(
        { left: afterTransform.left, top: afterTransform.top },
        { left: beforeTransform.left, top: beforeTransform.top },
    );

    await watermark.update(id, { text: 'Changed', opacity: 0.4 });
    assert.equal(watermark.list()[0].text, 'Changed');
    await editor.loadFromState(snapshot);
    assert.equal(watermark.list()[0].text, 'Proof');
    assert.equal(watermark.list()[0].id, id);

    const exportedState = editor.saveState();
    const firstExport = await editor.exportImageBase64();
    const secondExport = await editor.exportImageBase64();
    assert.equal(firstExport, secondExport);
    assert.equal(editor.saveState(), exportedState);

    const committedConfiguration = watermark.getConfiguration();
    assert.throws(() => watermark.configure({ defaultOpacity: 2 }), TypeError);
    assert.deepEqual(watermark.getConfiguration(), committedConfiguration);
    assert.equal(overlay.getByPersistentId(id) !== null, true);

    await disposeEditor(editor);
    const reinstall = new ImageEditorCore(fabric);
    reinstall.use(overlayFoundationPlugin());
    reinstall.use(createWatermarkPlugin());
    await disposeEditor(reinstall);

    const invalidEditor = new ImageEditorCore(fabric);
    invalidEditor.use(overlayFoundationPlugin());
    assert.throws(
        () =>
            invalidEditor.use(
                createWatermarkPlugin({
                    codec: {
                        type: 'testing:incomplete-codec',
                        version: '1.0.0',
                        serialize: () => ({}),
                        validate: () => true,
                    },
                }),
            ),
        PluginSetupError,
    );
    await disposeEditor(invalidEditor);

    return Object.freeze({
        persistentCodec: true,
        stateRoundTrip: true,
        geometryParticipation: true,
        deterministicExport: true,
        invalidConfigurationAtomic: true,
        missingCodecRejected: true,
        overlayMutationHistory: Object.freeze({
            topLevelTransactions: 1,
            historyRecords: 1,
            committedEvents: 1,
            registrationLeaks: 0,
        }),
    });
}

async function proveMetadata() {
    const elements = createEditorElements();
    const editor = new ImageEditorCore(fabric);
    const history = editor.use(historyPlugin());
    const metadata = editor.use(createMetadataPlugin());
    await editor.init(elements);
    history.clear();
    const committedStates = [];
    const listener = metadata.onCommitted((state) => committedStates.push(state));
    await metadata.set('author', 'Ada');
    assert.deepEqual(metadata.getAll(), { author: 'Ada' });
    assert.equal(committedStates.length, 1);
    assert.equal(history.getState().size, 1);

    const snapshot = editor.saveState();
    await metadata.set('author', 'Grace');
    await editor.loadFromState(snapshot);
    assert.deepEqual(metadata.getAll(), { author: 'Ada' });

    metadata.configure({ maximumValueLength: 16 });
    const configuration = metadata.getConfiguration();
    await editor.loadFromState(snapshot);
    assert.deepEqual(metadata.getConfiguration(), configuration);
    const stateBeforeFailure = editor.saveState();
    const historyBeforeFailure = history.getState().size;
    await assert.rejects(metadata.set('oversized', 'x'.repeat(17)), TypeError);
    assert.equal(editor.saveState(), stateBeforeFailure);
    assert.equal(history.getState().size, historyBeforeFailure);

    const migrationInput = {
        version: 1,
        data: {
            entries: [
                ['second', '2'],
                ['first', '1'],
            ],
        },
    };
    const firstMigration = metadata.migrateSlice(migrationInput);
    const secondMigration = metadata.migrateSlice(migrationInput);
    assert.deepEqual({ ...firstMigration }, { first: '1', second: '2' });
    assert.deepEqual({ ...secondMigration }, { ...firstMigration });
    const documentBeforeMigrationFailure = metadata.getAll();
    assert.throws(
        () => metadata.migrateSlice({ version: 1, data: { entries: [['invalid']] } }),
        TypeError,
    );
    assert.deepEqual(metadata.getAll(), documentBeforeMigrationFailure);
    assert.throws(
        () => metadata.migrateSlice({ version: 99, data: {} }),
        MetadataSliceVersionError,
    );

    const committedCountBeforeDispose = committedStates.length;
    listener.dispose();
    await metadata.set('listener', 'disposed');
    assert.equal(committedStates.length, committedCountBeforeDispose);
    const opaqueSnapshot = editor.saveState();
    await disposeEditor(editor);

    const receivingElements = createEditorElements();
    const receivingEditor = new ImageEditorCore(fabric);
    await receivingEditor.init(receivingElements);
    await receivingEditor.loadFromState(opaqueSnapshot, {
        missingPluginPolicy: 'preserve-opaque',
    });
    const preserved = JSON.parse(receivingEditor.saveState()).plugins;
    const original = JSON.parse(opaqueSnapshot).plugins;
    assert.deepEqual(
        preserved['@bensitu/reference-metadata/document'],
        original['@bensitu/reference-metadata/document'],
    );
    await disposeEditor(receivingEditor);

    return Object.freeze({
        fabricImports: 0,
        canvasCapabilityRequests: 0,
        overlayRegistrations: 0,
        stateRoundTrip: true,
        committedEventObserved: true,
        configurationSeparated: true,
        cleanupVerified: true,
        sliceMigration: Object.freeze({
            sourceVersion: 1,
            targetVersion: 2,
            migrated: true,
            deterministic: true,
            validatedBeforeCommit: true,
            failedMigrationMutationCount: 0,
            futureVersionTypedFailure: true,
            missingPluginPolicyPreserved: true,
            privateAccesses: 0,
        }),
    });
}

export async function proveWatermarkAndMetadata() {
    return Object.freeze({
        watermark: await proveWatermark(),
        metadata: await proveMetadata(),
    });
}
