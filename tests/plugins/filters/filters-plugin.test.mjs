import assert from 'node:assert/strict';
import test from 'node:test';

import { ImageEditorCore } from '../../../src/core/index.js';
import { overlayFoundationPlugin } from '../../../src/foundations/overlay/index.js';
import { filtersPlugin, FiltersPreviewMissingError } from '../../../src/plugins/filters/index.js';
import { historyPlugin } from '../../../src/plugins/history/index.js';
import { maskPlugin } from '../../../src/plugins/mask/index.js';
import { transformPlugin } from '../../../src/plugins/transform/index.js';
import {
    MEMENTO_HISTORY_CAPABILITY,
    SNAPSHOT_REGISTRATION_CAPABILITY,
    definePlugin,
    definePluginRef,
} from '../../../src/sdk/index.js';
import { fabric, makeImageDataUrl, resetEditorDom } from '../../helpers/fabric-environment.mjs';

function installCommittedEventObserver(editor) {
    const observerRef = definePluginRef('example-test:filters-event-observer', '1.0.0');
    return editor.use({
        ref: observerRef,
        version: '1.0.0',
        setupMode: 'sync',
        setup(context) {
            const events = [];
            context.addDisposable(
                context.events.on('document:committed', (descriptor) => events.push(descriptor)),
            );
            return { events };
        },
    });
}

async function createEditor({
    coreOptions = {},
    filtersOptions = {},
    historyOptions = {},
    masks = false,
    rollbackFailure = false,
    transform = false,
} = {}) {
    const ids = resetEditorDom({ containerWidth: 340, containerHeight: 250 });
    const warnings = [];
    const editor = new ImageEditorCore(fabric, {
        ...coreOptions,
        canvasWidth: 340,
        canvasHeight: 250,
        onWarning: (error, message) => warnings.push({ error, message }),
    });
    let maskApi = null;
    if (masks) {
        editor.use(overlayFoundationPlugin());
        maskApi = editor.use(maskPlugin({ label: false }));
    }
    const history = editor.use(historyPlugin(historyOptions));
    const rollbackFailureApi = rollbackFailure ? installRollbackFailureSlice(editor) : null;
    const filters = editor.use(filtersPlugin(filtersOptions));
    const transformApi = transform ? editor.use(transformPlugin({ animationDuration: 0 })) : null;
    const observer = installCommittedEventObserver(editor);
    await editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
    await editor.loadImage(makeImageDataUrl({ width: 130, height: 85 }));
    return {
        editor,
        filters,
        history,
        maskApi,
        observer,
        rollbackFailureApi,
        transformApi,
        warnings,
    };
}

function installHistoryFailureProvider(editor, failingOperationId = 'filters:bake') {
    const providerRef = definePluginRef('example-test:filters-history-failure', '1.0.0');
    return editor.use(
        definePlugin({
            ref: providerRef,
            manifest: {
                id: providerRef.id,
                version: '1.0.0',
                apiVersion: providerRef.apiVersion,
                engine: '^3.0.0',
                requires: [{ token: MEMENTO_HISTORY_CAPABILITY, range: '^1.0.0' }],
            },
            setupMode: 'sync',
            setup(context) {
                const history = context.capabilities.require(MEMENTO_HISTORY_CAPABILITY);
                const records = [];
                context.disposables.add(
                    history.registerHistoryProvider(providerRef.id, {
                        isAvailable: () => true,
                        commit: (record) => {
                            if (record.operationId === failingOperationId) {
                                throw new Error(
                                    `synthetic ${failingOperationId.split(':').at(-1)} History failure`,
                                );
                            }
                            records.push(record);
                        },
                    }),
                );
                return Object.freeze({ records });
            },
        }),
    );
}

function installRollbackFailureSlice(editor) {
    const sliceRef = definePluginRef('example-test:filters-rollback-failure', '1.0.0');
    let armed = false;
    return editor.use(
        definePlugin({
            ref: sliceRef,
            manifest: {
                id: sliceRef.id,
                version: '1.0.0',
                apiVersion: sliceRef.apiVersion,
                engine: '^3.0.0',
                requires: [{ token: SNAPSHOT_REGISTRATION_CAPABILITY, range: '^1.0.0' }],
            },
            setupMode: 'sync',
            setup(context) {
                const snapshots = context.capabilities.require(SNAPSHOT_REGISTRATION_CAPABILITY);
                context.disposables.add(
                    snapshots.registerSlice({
                        id: sliceRef.id,
                        version: 1,
                        capture: () => Object.freeze({ value: 1 }),
                        validate: (value) => ({ valid: true, value }),
                        restore: (_state, restoreContext) => {
                            if (armed && restoreContext.mode === 'trusted-memento') {
                                throw new Error('synthetic rollback restore failure');
                            }
                        },
                    }),
                );
                return Object.freeze({
                    arm: () => {
                        armed = true;
                    },
                });
            },
        }),
    );
}

async function dispose(editor) {
    await editor.disposeAsync();
    document.body.innerHTML = '';
}

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

function causeChainIncludes(error, pattern) {
    const messages = [];
    let current = error;
    for (let depth = 0; current && depth < 8; depth += 1) {
        messages.push(
            current instanceof Error ? `${current.name}: ${current.message}` : String(current),
        );
        current = current instanceof Error ? current.cause : null;
    }
    return pattern.test(messages.join('\n'));
}

test('preview is transient across committed state, Snapshot, History, and events', async () => {
    const { editor, filters, history, observer } = await createEditor();
    const snapshot = editor.saveState();
    const baseImage = editor.getCanvas().getObjects()[0];

    await filters.preview([{ type: 'brightness', value: 0.35 }]);

    assert.equal(filters.isPreviewing, true);
    assert.deepEqual(filters.getState().filters, []);
    assert.equal(editor.saveState(), snapshot);
    assert.equal(history.length, 0);
    assert.equal(observer.events.length, 0);
    assert.equal(baseImage.filters.length, 0);
    assert.equal(editor.getCanvas().getObjects().length, 2);

    await filters.cancelPreview();
    assert.equal(filters.isPreviewing, false);
    assert.equal(editor.getCanvas().getObjects().length, 1);
    assert.equal(editor.saveState(), snapshot);
    await dispose(editor);
});

test('commit and clear publish one History record and event only when state changes', async () => {
    const { editor, filters, history, observer } = await createEditor();
    const definitions = [{ type: 'brightness', value: 0.25 }];

    await filters.commit(definitions);
    assert.deepEqual(filters.getState().filters, definitions);
    assert.equal(Object.isFrozen(filters.getState()), true);
    assert.equal(history.length, 1);
    assert.equal(observer.events.length, 1);
    assert.equal(observer.events[0].operationId, 'filters:commit');
    assert.equal(editor.getCanvas().getObjects()[0].filters.length, 0);

    await filters.commit(definitions);
    assert.equal(history.length, 1);
    assert.equal(observer.events.length, 1);

    await filters.clear();
    assert.deepEqual(filters.getState().filters, []);
    assert.equal(history.length, 2);
    assert.equal(observer.events.length, 2);
    assert.equal(observer.events[1].operationId, 'filters:clear');

    await filters.clear();
    assert.equal(history.length, 2);
    assert.equal(observer.events.length, 2);
    await dispose(editor);
});

test('commit without definitions consumes only an active preview', async () => {
    const { editor, filters, history } = await createEditor();
    await assert.rejects(filters.commit(), FiltersPreviewMissingError);

    await filters.preview([{ type: 'contrast', value: -0.4 }]);
    await filters.commit();

    assert.equal(filters.isPreviewing, false);
    assert.deepEqual(filters.getState().filters, [{ type: 'contrast', value: -0.4 }]);
    assert.equal(history.length, 1);
    await dispose(editor);
});

test('failed active-preview commit preserves the exact preview session', async () => {
    const ids = resetEditorDom({ containerWidth: 340, containerHeight: 250 });
    const editor = new ImageEditorCore(fabric, { canvasWidth: 340, canvasHeight: 250 });
    const history = installHistoryFailureProvider(editor, 'filters:commit');
    const filters = editor.use(filtersPlugin());
    const observer = installCommittedEventObserver(editor);
    await editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
    await editor.loadImage(makeImageDataUrl({ width: 130, height: 85 }));
    history.records.length = 0;
    await filters.preview([{ type: 'brightness', value: 0.2 }]);
    const previewVisual = editor.getCanvas().getObjects()[1];
    const beforeSnapshot = editor.saveState();

    await assert.rejects(filters.commit(), /synthetic commit History failure/);

    assert.equal(filters.isPreviewing, true);
    assert.deepEqual(filters.getState().filters, []);
    assert.equal(editor.saveState(), beforeSnapshot);
    assert.equal(editor.getCanvas().getObjects()[1], previewVisual);
    assert.equal(history.records.length, 0);
    assert.equal(observer.events.length, 0);
    await filters.cancelPreview();
    await dispose(editor);
});

test('latest preview wins when an earlier clone completes late', async () => {
    const { editor, filters } = await createEditor();
    const baseImage = editor.getCanvas().getObjects()[0];
    const clone = baseImage.clone.bind(baseImage);
    const firstClone = await clone();
    const secondClone = await clone();
    let resolveFirst;
    let resolveSecond;
    const pending = [
        new Promise((resolve) => {
            resolveFirst = () => resolve(firstClone);
        }),
        new Promise((resolve) => {
            resolveSecond = () => resolve(secondClone);
        }),
    ];
    baseImage.clone = () => pending.shift();

    const first = filters.preview([{ type: 'brightness', value: 0.2 }]);
    const second = filters.preview([{ type: 'contrast', value: 0.6 }]);
    resolveSecond();
    await second;
    resolveFirst();
    await assert.rejects(first, /replaced|stale/i);

    await filters.commit();
    assert.deepEqual(filters.getState().filters, [{ type: 'contrast', value: 0.6 }]);
    await dispose(editor);
});

test('explicit commit retires an active preview and publishes only the committed definitions', async () => {
    const { editor, filters, history, observer } = await createEditor();
    const baseImage = editor.getCanvas().getObjects()[0];
    const cloneBase = baseImage.clone.bind(baseImage);
    const previewClone = await cloneBase();
    const previewGate = deferred();
    let cloneCount = 0;
    baseImage.clone = () => {
        cloneCount += 1;
        return cloneCount === 1 ? previewGate.promise : cloneBase();
    };

    const preview = filters.preview([{ type: 'brightness', value: 0.2 }]);
    const commit = filters.commit([{ type: 'contrast', value: 0.4 }]);
    previewGate.resolve(previewClone);
    const [previewResult, commitResult] = await Promise.allSettled([preview, commit]);

    assert.equal(previewResult.status, 'rejected');
    assert.equal(commitResult.status, 'fulfilled');
    assert.equal(filters.isPreviewing, false);
    assert.deepEqual(filters.getState().filters, [{ type: 'contrast', value: 0.4 }]);
    assert.equal(history.length, 1);
    assert.equal(observer.events.length, 1);
    await dispose(editor);
});

test('commit and Transform serialize through shared operation authority', async () => {
    const { editor, filters, history, transformApi } = await createEditor({ transform: true });
    const baseImage = editor.getCanvas().getObjects()[0];
    const cloneBase = baseImage.clone.bind(baseImage);
    const committedClone = await cloneBase();
    const commitGate = deferred();
    baseImage.clone = () => commitGate.promise;

    const commit = filters.commit([{ type: 'brightness', value: 0.3 }]);
    const transform = transformApi.rotate(25);
    await Promise.resolve();
    assert.equal(history.length, 0);
    commitGate.resolve(committedClone);
    await Promise.all([commit, transform]);

    assert.deepEqual(filters.getState().filters, [{ type: 'brightness', value: 0.3 }]);
    assert.equal(transformApi.getState().rotationDegrees, 25);
    assert.equal(history.length, 2);
    assert.equal(editor.getCanvas().getObjects()[0].editorObjectKind, 'baseImage');
    await dispose(editor);
});

test('dispose during preview suppresses the late clone and releases Canvas state', async () => {
    const { editor, filters } = await createEditor();
    const baseImage = editor.getCanvas().getObjects()[0];
    const cloneBase = baseImage.clone.bind(baseImage);
    const candidate = await cloneBase();
    const previewGate = deferred();
    baseImage.clone = () => previewGate.promise;

    const preview = filters.preview([{ type: 'sepia' }]);
    const disposal = editor.disposeAsync();
    previewGate.resolve(candidate);
    const [previewResult, disposalResult] = await Promise.allSettled([preview, disposal]);

    assert.equal(previewResult.status, 'rejected');
    assert.equal(disposalResult.status, 'fulfilled');
    assert.equal(editor.getCanvas(), null);
    document.body.innerHTML = '';
});

test('dispose during commit aborts the transaction before document publication', async () => {
    const { editor, filters, history, observer } = await createEditor();
    const baseImage = editor.getCanvas().getObjects()[0];
    const candidate = await baseImage.clone();
    const commitGate = deferred();
    baseImage.clone = () => commitGate.promise;

    const commit = filters.commit([{ type: 'sepia' }]);
    const disposal = editor.disposeAsync();
    commitGate.resolve(candidate);
    const [commitResult, disposalResult] = await Promise.allSettled([commit, disposal]);

    assert.equal(commitResult.status, 'rejected');
    assert.equal(disposalResult.status, 'fulfilled');
    assert.equal(history.length, 0);
    assert.equal(observer.events.length, 0);
    assert.equal(editor.getCanvas(), null);
    document.body.innerHTML = '';
});

test('image load queued behind commit wins without retaining stale Filter state', async () => {
    const { editor, filters, history, observer } = await createEditor();
    const baseImage = editor.getCanvas().getObjects()[0];
    const candidate = await baseImage.clone();
    const commitGate = deferred();
    baseImage.clone = () => commitGate.promise;

    const commit = filters.commit([{ type: 'brightness', value: 0.2 }]);
    const load = editor.loadImage(makeImageDataUrl({ width: 96, height: 64, fill: '#d8f2ff' }));
    commitGate.resolve(candidate);
    await Promise.all([commit, load]);

    assert.deepEqual(filters.getState().filters, []);
    assert.equal(filters.isPreviewing, false);
    assert.equal(history.length, 0);
    assert.equal(observer.events.length, 1);
    assert.equal(observer.events[0].operationId, 'filters:commit');
    assert.equal(editor.getImageInfo().naturalWidth, 96);
    await dispose(editor);
});

test('committed state has no live alias to caller definitions', async () => {
    const { editor, filters } = await createEditor();
    const definition = { type: 'brightness', value: 0.2 };
    const input = [definition];
    await filters.commit(input);

    definition.value = 0.9;
    input.push({ type: 'grayscale' });

    assert.deepEqual(filters.getState().filters, [{ type: 'brightness', value: 0.2 }]);
    assert.equal(Object.isFrozen(filters.getState().filters), true);
    assert.equal(Object.isFrozen(filters.getState().filters[0]), true);
    await dispose(editor);
});

test('preview failure disposes its candidate and preserves the committed document', async () => {
    const { editor, filters, history } = await createEditor();
    const baseImage = editor.getCanvas().getObjects()[0];
    const clone = await baseImage.clone();
    clone.applyFilters = () => {
        throw new Error('synthetic Filter application failure');
    };
    baseImage.clone = async () => clone;

    await assert.rejects(filters.preview([{ type: 'brightness', value: 0.2 }]), (error) => {
        assert.equal(error.name, 'FilterImplementationError');
        assert.match(error.cause.message, /synthetic Filter application failure/);
        return true;
    });
    assert.equal(filters.isPreviewing, false);
    assert.deepEqual(filters.getState().filters, []);
    assert.equal(editor.getCanvas().getObjects().length, 1);
    assert.equal(history.length, 0);
    await dispose(editor);
});

test('failed commit rolls state and visual rendering back without History or events', async () => {
    const { editor, filters, history, observer } = await createEditor();
    const baseImage = editor.getCanvas().getObjects()[0];
    baseImage.clone = async () => {
        throw new Error('synthetic committed visual failure');
    };

    await assert.rejects(
        filters.commit([{ type: 'brightness', value: 0.4 }]),
        /synthetic committed visual failure/,
    );
    assert.deepEqual(filters.getState().filters, []);
    assert.equal(filters.isPreviewing, false);
    assert.equal(history.length, 0);
    assert.equal(observer.events.length, 0);
    assert.equal(editor.isImageLoaded(), true);
    await dispose(editor);
});

test('Snapshot round trip restores committed definitions and rejects invalid Slice data', async () => {
    const { editor, filters } = await createEditor();
    await filters.commit([{ type: 'brightness', value: 0.2 }, { type: 'grayscale' }]);
    const snapshot = JSON.parse(editor.saveState());
    const slice = snapshot.plugins['plugin:filters'].data;
    assert.deepEqual(slice, {
        schema: 'image-editor.filters',
        version: 1,
        filters: [{ type: 'brightness', value: 0.2 }, { type: 'grayscale' }],
    });
    assert.deepEqual(snapshot.core.canvas.objects[0].filters, []);

    await filters.clear();
    await editor.loadFromState(snapshot);
    assert.deepEqual(filters.getState(), slice);

    const future = structuredClone(snapshot);
    future.plugins['plugin:filters'].data.version = 2;
    await assert.rejects(editor.loadFromState(future), /version 2 is unsupported/i);
    assert.deepEqual(filters.getState(), slice);

    const incompatibleSlice = structuredClone(snapshot);
    incompatibleSlice.plugins['plugin:filters'].version = 2;
    await assert.rejects(
        editor.loadFromState(incompatibleSlice),
        /incompatible with installed version 1/i,
    );
    assert.deepEqual(filters.getState(), slice);

    const unknown = structuredClone(snapshot);
    unknown.plugins['plugin:filters'].data.filters = [{ type: 'arbitrary-fabric-class' }];
    await assert.rejects(editor.loadFromState(unknown), /Unknown Filter type/i);
    assert.deepEqual(filters.getState(), slice);

    const fabricFilter = structuredClone(snapshot);
    fabricFilter.core.canvas.objects[0].filters = [{ type: 'Brightness', brightness: 0.5 }];
    await assert.rejects(editor.loadFromState(fabricFilter), /Fabric filters are not accepted/i);
    assert.deepEqual(filters.getState(), slice);
    await dispose(editor);
});

test('missing Plugin policies skip or preserve opaque Filters Slice data without Fabric state', async () => {
    const source = await createEditor();
    await source.filters.commit([{ type: 'sepia' }]);
    const snapshot = source.editor.saveState();
    await dispose(source.editor);

    const ids = resetEditorDom({ containerWidth: 340, containerHeight: 250 });
    const warnings = [];
    const editor = new ImageEditorCore(fabric, {
        onWarning: (error, message) => warnings.push({ error, message }),
    });
    await editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
    await editor.loadFromState(snapshot, { missingPluginPolicy: 'preserve-opaque' });

    const preserved = JSON.parse(editor.saveState());
    assert.deepEqual(preserved.plugins['plugin:filters'].data.filters, [{ type: 'sepia' }]);
    assert.deepEqual(preserved.core.canvas.objects[0].filters, []);
    assert.ok(warnings.some((warning) => /preserved opaquely/.test(warning.message)));
    await dispose(editor);
});

test('export includes committed Filters, excludes preview, and leaves live state unchanged', async () => {
    const { editor, filters, history, observer } = await createEditor();
    const unfiltered = await editor.exportImageBase64({ format: 'png' });
    await filters.commit([{ type: 'brightness', value: 0.45 }]);
    const committedSnapshot = editor.saveState();
    const committed = await editor.exportImageBase64({ format: 'png' });
    assert.notEqual(committed, unfiltered);

    await filters.preview([{ type: 'grayscale' }]);
    const duringPreview = await editor.exportImageBase64({ format: 'png' });
    const repeated = await editor.exportImageBase64({ format: 'png' });
    assert.equal(duringPreview, committed);
    assert.equal(repeated, committed);
    assert.equal(editor.saveState(), committedSnapshot);
    assert.equal(filters.isPreviewing, true);
    assert.equal(history.length, 1);
    assert.equal(observer.events.length, 1);
    await dispose(editor);
});

test('export failure disposes its clone and preserves committed Filters', async () => {
    const { editor, filters, history, observer } = await createEditor();
    await filters.commit([{ type: 'contrast', value: 0.3 }]);
    const beforeState = filters.getState();
    const beforeSnapshot = editor.saveState();
    const beforeExport = await editor.exportImageBase64({ format: 'png' });
    const baseImage = editor.getCanvas().getObjects()[0];
    const cloneBase = baseImage.clone.bind(baseImage);
    let candidateDisposed = false;
    baseImage.clone = async () => {
        const candidate = await cloneBase();
        const disposeCandidate = candidate.dispose.bind(candidate);
        candidate.dispose = () => {
            candidateDisposed = true;
            return disposeCandidate();
        };
        candidate.applyFilters = () => {
            throw new Error('synthetic export Filter failure');
        };
        return candidate;
    };

    await assert.rejects(editor.exportImageBase64({ format: 'png' }), (error) => {
        assert.equal(error.name, 'CoreRuntimeError');
        assert.equal(error.cause?.name, 'FilterImplementationError');
        assert.equal(causeChainIncludes(error, /synthetic export Filter failure/), true);
        return true;
    });
    baseImage.clone = cloneBase;

    assert.equal(candidateDisposed, true);
    assert.deepEqual(filters.getState(), beforeState);
    assert.equal(editor.saveState(), beforeSnapshot);
    assert.equal(await editor.exportImageBase64({ format: 'png' }), beforeExport);
    assert.equal(history.length, 1);
    assert.equal(observer.events.length, 1);
    await dispose(editor);
});

test('load removes preview and committed Filter state deterministically', async () => {
    const { editor, filters, history } = await createEditor();
    await filters.commit([{ type: 'brightness', value: 0.3 }]);
    await filters.preview([{ type: 'sepia' }]);

    await editor.loadImage(makeImageDataUrl({ width: 96, height: 64, fill: '#ffe5c2' }));

    assert.equal(filters.isPreviewing, false);
    assert.deepEqual(filters.getState().filters, []);
    assert.equal(editor.getCanvas().getObjects().length, 1);
    assert.equal(history.length, 0);
    await dispose(editor);
});

test('configuration remains outside Snapshot and status listeners are isolated', async () => {
    const { editor, filters, warnings } = await createEditor({
        filtersOptions: { maxFilterCount: 4 },
    });
    const statuses = [];
    filters.subscribe((status) => statuses.push(status));
    filters.subscribe(() => {
        throw new Error('synthetic listener failure');
    });

    await filters.configure({ maxFilterCount: 3 });
    await filters.commit([
        { type: 'brightness', value: 0.2 },
        { type: 'contrast', value: 0.2 },
    ]);
    await assert.rejects(filters.configure({ maxFilterCount: 1 }), /active Filter count 2/);

    assert.deepEqual(filters.getConfiguration(), { maxFilterCount: 3 });
    assert.ok(statuses.length >= 2);
    assert.ok(warnings.some((warning) => /status listener/.test(warning.message)));
    assert.doesNotMatch(editor.saveState(), /maxFilterCount/);
    await dispose(editor);
});

test('configuration revalidates after a queued committed state change', async () => {
    const { editor, filters, history } = await createEditor();
    const baseImage = editor.getCanvas().getObjects()[0];
    const candidate = await baseImage.clone();
    const commitGate = deferred();
    baseImage.clone = () => commitGate.promise;

    const commit = filters.commit([
        { type: 'brightness', value: 0.2 },
        { type: 'contrast', value: 0.2 },
    ]);
    const configure = filters.configure({ maxFilterCount: 1 });
    commitGate.resolve(candidate);

    await commit;
    await assert.rejects(configure, /active Filter count 2/);
    assert.deepEqual(filters.getConfiguration(), { maxFilterCount: 8 });
    assert.equal(history.length, 1);
    await dispose(editor);
});

test('History disabled keeps commit, clear, and bake outside the undo timeline', async () => {
    const { editor, filters, history } = await createEditor({
        historyOptions: { enabled: false },
    });
    await filters.commit([{ type: 'brightness', value: 0.2 }]);
    await filters.clear();
    await filters.commit([{ type: 'contrast', value: 0.2 }]);
    await filters.bake();

    assert.equal(history.length, 0);
    assert.deepEqual(filters.getState().filters, []);
    await dispose(editor);
});

test('bake preserves pixels, clears state, and round-trips through History', async () => {
    const { editor, filters, history, observer } = await createEditor();
    await filters.commit([{ type: 'brightness', value: 0.25 }]);
    const filtered = await editor.exportImageBase64({ format: 'png' });
    const baseImage = editor.getCanvas().getObjects()[0];

    await filters.bake();

    const baked = await editor.exportImageBase64({ format: 'png' });
    assert.equal(baked, filtered);
    assert.notEqual(editor.getCanvas().getObjects()[0], baseImage);
    assert.deepEqual(filters.getState().filters, []);
    assert.equal(history.length, 2);
    assert.equal(observer.events.length, 2);
    assert.equal(observer.events[1].operationId, 'filters:bake');

    await history.undo();
    assert.deepEqual(filters.getState().filters, [{ type: 'brightness', value: 0.25 }]);
    assert.equal(await editor.exportImageBase64({ format: 'png' }), filtered);
    await history.redo();
    assert.deepEqual(filters.getState().filters, []);
    assert.equal(await editor.exportImageBase64({ format: 'png' }), baked);
    await dispose(editor);
});

test('failed offscreen bake restores Filters, Base Image, History, and events', async () => {
    const { editor, filters, history, observer } = await createEditor();
    await filters.commit([{ type: 'contrast', value: 0.3 }]);
    const beforeState = filters.getState();
    const beforeExport = await editor.exportImageBase64({ format: 'png' });
    const baseImage = editor.getCanvas().getObjects()[0];
    const cloneBase = baseImage.clone.bind(baseImage);
    baseImage.clone = async () => {
        const clone = await cloneBase();
        clone.toDataURL = () => {
            throw new Error('synthetic offscreen render failure');
        };
        return clone;
    };

    await assert.rejects(filters.bake(), /synthetic offscreen render failure/);

    assert.deepEqual(filters.getState(), beforeState);
    assert.equal(await editor.exportImageBase64({ format: 'png' }), beforeExport);
    assert.equal(history.length, 1);
    assert.equal(observer.events.length, 1);
    assert.equal(editor.isImageLoaded(), true);
    await dispose(editor);
});

test('bake rejects filter application and decode failures without changing the document', async (t) => {
    for (const failure of ['filter-application', 'decode']) {
        await t.test(failure, async () => {
            const { editor, filters, history, observer } = await createEditor();
            await filters.commit([{ type: 'brightness', value: 0.2 }]);
            const beforeState = filters.getState();
            const beforeSnapshot = editor.saveState();
            const baseImage = editor.getCanvas().getObjects()[0];
            const cloneBase = baseImage.clone.bind(baseImage);
            baseImage.clone = async () => {
                const clone = await cloneBase();
                if (failure === 'filter-application') {
                    clone.applyFilters = () => {
                        throw new Error('synthetic bake Filter failure');
                    };
                } else {
                    clone.toDataURL = () => 'data:image/png;base64,AAAA';
                }
                return clone;
            };

            await assert.rejects(
                filters.bake(),
                failure === 'filter-application'
                    ? (error) => causeChainIncludes(error, /synthetic bake Filter failure/)
                    : /decode failed/i,
            );

            assert.deepEqual(filters.getState(), beforeState);
            assert.equal(editor.saveState(), beforeSnapshot);
            assert.equal(history.length, 1);
            assert.equal(observer.events.length, 1);
            assert.equal(editor.getLifecycleState(), 'initialized');
            await dispose(editor);
        });
    }
});

test('bake rolls back Raster, synchronization, and final render failures', async (t) => {
    for (const failure of ['raster', 'synchronize', 'render']) {
        await t.test(failure, async () => {
            const { editor, filters, history, observer } = await createEditor();
            await filters.commit([{ type: 'contrast', value: 0.25 }]);
            const beforeState = filters.getState();
            const beforeExport = await editor.exportImageBase64({ format: 'png' });
            const canvas = editor.getCanvas();
            if (failure === 'raster') {
                const add = canvas.add.bind(canvas);
                let failOnce = true;
                canvas.add = (...objects) => {
                    if (failOnce) {
                        failOnce = false;
                        throw new Error('synthetic Raster mutation failure');
                    }
                    return add(...objects);
                };
            } else {
                const requestRender = canvas.requestRenderAll.bind(canvas);
                let requestCount = 0;
                canvas.requestRenderAll = () => {
                    requestCount += 1;
                    const failureRequest = failure === 'synchronize' ? 1 : 2;
                    if (requestCount === failureRequest) {
                        throw new Error(`synthetic ${failure} failure`);
                    }
                    return requestRender();
                };
            }

            await assert.rejects(filters.bake(), new RegExp(`synthetic ${failure}`, 'i'));

            assert.deepEqual(filters.getState(), beforeState);
            assert.equal(await editor.exportImageBase64({ format: 'png' }), beforeExport);
            assert.equal(history.length, 1);
            assert.equal(observer.events.length, 1);
            assert.equal(editor.getLifecycleState(), 'initialized');
            await dispose(editor);
        });
    }
});

test('bake History publication failure restores Raster and Filter state', async () => {
    const ids = resetEditorDom({ containerWidth: 340, containerHeight: 250 });
    const editor = new ImageEditorCore(fabric, { canvasWidth: 340, canvasHeight: 250 });
    const history = installHistoryFailureProvider(editor);
    const filters = editor.use(filtersPlugin());
    const observer = installCommittedEventObserver(editor);
    await editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
    await editor.loadImage(makeImageDataUrl({ width: 130, height: 85 }));
    history.records.length = 0;
    await filters.commit([{ type: 'sepia' }]);
    const beforeState = filters.getState();
    const beforeExport = await editor.exportImageBase64({ format: 'png' });

    await assert.rejects(filters.bake(), /synthetic bake History failure/);

    assert.deepEqual(filters.getState(), beforeState);
    assert.equal(await editor.exportImageBase64({ format: 'png' }), beforeExport);
    assert.equal(history.records.length, 1);
    assert.equal(observer.events.length, 1);
    assert.equal(editor.getLifecycleState(), 'initialized');
    await dispose(editor);
});

test('bake restore failure escalates the editor to the faulted lifecycle', async () => {
    const { editor, filters, rollbackFailureApi } = await createEditor({
        rollbackFailure: true,
    });
    await filters.commit([{ type: 'brightness', value: 0.2 }]);
    const baseImage = editor.getCanvas().getObjects()[0];
    const cloneBase = baseImage.clone.bind(baseImage);
    baseImage.clone = async () => {
        const clone = await cloneBase();
        clone.toDataURL = () => {
            throw new Error('synthetic bake trigger failure');
        };
        return clone;
    };
    rollbackFailureApi.arm();

    await assert.rejects(filters.bake(), (error) => {
        assert.equal(causeChainIncludes(error, /synthetic bake trigger failure/), true);
        assert.equal(
            error.rollbackErrors.some((rollbackError) =>
                causeChainIncludes(rollbackError, /synthetic rollback restore failure/),
            ),
            true,
        );
        return true;
    });

    assert.equal(editor.getLifecycleState(), 'faulted');
    await editor.forceDispose();
    document.body.innerHTML = '';
});

test('bake applies Core dimension limits before Raster mutation', async () => {
    const { editor, filters, history, observer } = await createEditor({
        coreOptions: { maxExportDimension: 100 },
    });
    await filters.commit([{ type: 'grayscale' }]);
    const beforeState = filters.getState();
    const beforeSnapshot = editor.saveState();

    await assert.rejects(filters.bake(), /dimensions exceed the Core policy/i);

    assert.equal(editor.saveState(), beforeSnapshot);
    assert.equal(editor.getCanvas().getObjects()[0].editorObjectKind, 'baseImage');
    assert.deepEqual(filters.getState(), beforeState);
    assert.equal(history.length, 1);
    assert.equal(observer.events.length, 1);
    await dispose(editor);
});

test('bake preserves Mask objects and the Base Image ordering invariant', async () => {
    const { editor, filters, maskApi } = await createEditor({ masks: true });
    const mask = await maskApi.create({ left: 48, top: 36 });
    await filters.commit([{ type: 'grayscale' }]);

    await filters.bake();

    assert.equal(maskApi.getAll().length, 1);
    assert.equal(maskApi.getAll()[0], mask);
    assert.equal(editor.getCanvas().getObjects()[0].editorObjectKind, 'baseImage');
    assert.equal(mask.canvas, editor.getCanvas());
    await dispose(editor);
});
