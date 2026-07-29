import assert from 'node:assert/strict';
import test from 'node:test';

import {
    DOCUMENT_MUTATION_CAPABILITY,
    GEOMETRY_MUTATION_CAPABILITY,
    SNAPSHOT_REGISTRATION_CAPABILITY,
} from '../../src/core-runtime/internal-capabilities.js';
import {
    EmergencyResetError,
    EditorDisposedError,
    EditorFaultedError,
    ImageEditorCore,
    definePluginRef,
} from '../../src/core/index.js';
import { GeometryUnrecoverableError } from '../../src/core-runtime/errors.js';
import { annotationFoundationRef } from '../../src/foundations/annotation/index.js';
import { overlayFoundationRef } from '../../src/foundations/overlay/index.js';
import { drawAnnotationPluginRef } from '../../src/plugins/annotation-draw/index.js';
import { shapeAnnotationPluginRef } from '../../src/plugins/annotation-shape/index.js';
import { textAnnotationPluginRef } from '../../src/plugins/annotation-text/index.js';
import { cropPluginRef } from '../../src/plugins/crop/index.js';
import { filtersPluginRef } from '../../src/plugins/filters/index.js';
import { historyPlugin, historyPluginRef } from '../../src/plugins/history/index.js';
import { maskPluginRef } from '../../src/plugins/mask/index.js';
import { mosaicPluginRef } from '../../src/plugins/mosaic/index.js';
import { overlayStatePluginRef } from '../../src/plugins/overlay-state/index.js';
import { transformPluginRef } from '../../src/plugins/transform/index.js';
import { createFullPreset } from '../../src/presets/full/index.js';
import { GEOMETRY_MUTATION_CONFLICT_DOMAINS } from '../../src/utils/internal-operation-conflict-domains.js';
import { fabric, makeImageDataUrl, resetEditorDom } from '../helpers/fabric-environment.mjs';

function causeChainIncludes(root, expected, visited = new Set()) {
    if (root === expected) return true;
    if (!root || (typeof root !== 'object' && typeof root !== 'function') || visited.has(root)) {
        return false;
    }
    visited.add(root);
    if ('cause' in root && causeChainIncludes(root.cause, expected, visited)) return true;
    for (const key of ['causes', 'errors', 'rollbackErrors']) {
        if (
            Array.isArray(root[key]) &&
            root[key].some((entry) => causeChainIncludes(entry, expected, visited))
        ) {
            return true;
        }
    }
    return false;
}

function createFaultFixture({ shouldReplayFail = () => false } = {}) {
    const fixtureId = crypto.randomUUID();
    const ref = definePluginRef(`example-test:fault-${fixtureId}`, '1.0.0');
    const operationId = `example-test:fault-mutate-${fixtureId}`;
    let setupCount = 0;
    let failRestore = false;
    let value = 0;
    let sequence = 0;
    const plugin = Object.freeze({
        ref,
        version: '1.0.0',
        setupMode: 'sync',
        requires: [
            { token: SNAPSHOT_REGISTRATION_CAPABILITY, range: '^1.0.0' },
            { token: DOCUMENT_MUTATION_CAPABILITY, range: '^1.0.0' },
        ],
        setup(context) {
            setupCount += 1;
            const setupGeneration = setupCount;
            if (setupCount > 1 && shouldReplayFail()) {
                throw new Error('synthetic plugin replay failure');
            }
            const state = context.capabilities.require(SNAPSHOT_REGISTRATION_CAPABILITY);
            const mutations = context.capabilities.require(DOCUMENT_MUTATION_CAPABILITY);
            context.operations.register({
                id: operationId,
                mode: 'mutation',
                conflictDomains: ['document', 'state'],
                reentrancy: 'reject',
            });
            context.addDisposable(
                state.registerSlice({
                    id: ref.id,
                    version: 1,
                    capturePolicy: 'always',
                    capture: () => ({ value }),
                    validate: (candidate) =>
                        candidate &&
                        typeof candidate === 'object' &&
                        Number.isFinite(candidate.value)
                            ? { valid: true, value: candidate }
                            : { valid: false, message: 'Fault fixture state is malformed.' },
                    restore: (snapshot, restoreContext) => {
                        if (failRestore && restoreContext.mode === 'trusted-memento') {
                            throw new Error('synthetic trusted restore failure');
                        }
                        value = snapshot.value;
                    },
                    clearState: () => {
                        value = 0;
                    },
                }),
            );
            return Object.freeze({
                get setupGeneration() {
                    return setupGeneration;
                },
                readSetupGeneration() {
                    return this.setupGeneration;
                },
                getValue: () => value,
                triggerFatalRestore: () => {
                    failRestore = true;
                    return mutations.run({
                        id: `${ref.id}:transaction:${++sequence}`,
                        kind: 'plugin-state',
                        operationId,
                        conflictDomains: ['document', 'state'],
                        mutate: () => {
                            value += 1;
                        },
                        validate: () => {
                            throw new Error('synthetic fatal invariant failure');
                        },
                    });
                },
            });
        },
    });
    return {
        plugin,
        ref,
        allowRestore: () => {
            failRestore = false;
        },
        getSetupCount: () => setupCount,
    };
}

function createGeometryFaultFixture() {
    const fixtureId = crypto.randomUUID();
    const ref = definePluginRef(`example-test:geometry-fault-${fixtureId}`, '1.0.0');
    const operationId = `example-test:geometry-fault-mutate-${fixtureId}`;
    const applyFailure = new Error('synthetic Geometry participant apply failure');
    const rollbackFailure = new Error('synthetic Geometry participant rollback failure');
    const restoreFailure = new Error('synthetic Geometry Memento restore failure');
    let failRestore = true;
    let sequence = 0;
    let value = 1;
    const plugin = Object.freeze({
        ref,
        version: '1.0.0',
        setupMode: 'sync',
        requires: [
            { token: SNAPSHOT_REGISTRATION_CAPABILITY, range: '^1.0.0' },
            { token: GEOMETRY_MUTATION_CAPABILITY, range: '^1.0.0' },
        ],
        permissions: ['core:geometry-participant'],
        setup(context) {
            const state = context.capabilities.require(SNAPSHOT_REGISTRATION_CAPABILITY);
            const geometry = context.capabilities.require(GEOMETRY_MUTATION_CAPABILITY);
            context.operations.register({
                id: operationId,
                mode: 'mutation',
                conflictDomains: GEOMETRY_MUTATION_CONFLICT_DOMAINS,
                reentrancy: 'reject',
            });
            context.addDisposable(
                state.registerSlice({
                    id: ref.id,
                    version: 1,
                    capturePolicy: 'always',
                    capture: () => ({ value }),
                    validate: (candidate) =>
                        candidate &&
                        typeof candidate === 'object' &&
                        Number.isFinite(candidate.value)
                            ? { valid: true, value: candidate }
                            : { valid: false, message: 'Geometry fault state is malformed.' },
                    restore: (snapshot, restoreContext) => {
                        if (failRestore && restoreContext.mode === 'trusted-memento') {
                            throw restoreFailure;
                        }
                        value = snapshot.value;
                    },
                    clearState: () => {
                        value = 0;
                    },
                }),
            );
            context.addDisposable(
                geometry.registerParticipant({
                    id: `${ref.id}:participant`,
                    order: 0,
                    supports: (mutation) => mutation.operationId === operationId,
                    prepare: () => Object.freeze({ before: value }),
                    apply: () => {
                        value += 1;
                        throw applyFailure;
                    },
                    rollback: () => {
                        throw rollbackFailure;
                    },
                }),
            );
            return Object.freeze({
                trigger: () =>
                    geometry.run({
                        id: `${ref.id}:transaction:${++sequence}`,
                        kind: 'transform',
                        operationId,
                        mutateBase: () => undefined,
                    }),
            });
        },
    });
    return {
        applyFailure,
        plugin,
        restoreFailure,
        rollbackFailure,
        allowRestore: () => {
            failRestore = false;
        },
    };
}

async function faultEditor(editor, fixture, ids) {
    if (editor.getPlugin(historyPluginRef) === null) editor.use(historyPlugin());
    const api = editor.use(fixture.plugin);
    await editor.init({ canvas: ids.canvas });
    await assert.rejects(api.triggerFatalRestore(), /pre-operation state could not be restored/i);
    assert.equal(editor.getLifecycleState(), 'faulted');
    return api;
}

test('real Core Geometry assembly faults when participant rollback and Memento restore fail', async () => {
    const ids = resetEditorDom();
    const reportedErrors = [];
    const editor = new ImageEditorCore(fabric, {
        onError: (error, message) => reportedErrors.push({ error, message }),
    });
    const fixture = createGeometryFaultFixture();
    const api = editor.use(fixture.plugin);
    await editor.init({ canvas: ids.canvas });
    await editor.loadImage(makeImageDataUrl());

    await assert.rejects(api.trigger(), (error) => {
        assert.equal(error instanceof GeometryUnrecoverableError, true);
        assert.equal(error.cause, fixture.applyFailure);
        assert.equal(causeChainIncludes(error, fixture.rollbackFailure), true);
        assert.equal(causeChainIncludes(error, fixture.restoreFailure), true);
        return true;
    });

    assert.equal(editor.getLifecycleState(), 'faulted');
    await assert.rejects(editor.loadImage(makeImageDataUrl()), EditorFaultedError);
    assert.ok(
        editor
            .getDiagnostics()
            .some(
                (diagnostic) =>
                    diagnostic.behavior === 'fatal-restore' &&
                    diagnostic.cause === fixture.applyFailure,
            ),
    );
    assert.ok(
        reportedErrors.some(
            ({ error }) =>
                causeChainIncludes(error, fixture.rollbackFailure) &&
                causeChainIncludes(error, fixture.restoreFailure),
        ),
    );

    fixture.allowRestore();
    await editor.emergencyReset();
    assert.equal(editor.getLifecycleState(), 'configured');
    await editor.init({ canvas: ids.canvas });
    await editor.disposeAsync();
});

test('fatal restore faults Core, rejects ordinary work, and emergencyReset replays clean state', async () => {
    const ids = resetEditorDom();
    const editor = new ImageEditorCore(fabric);
    const fixture = createFaultFixture();
    const staleApi = await faultEditor(editor, fixture, ids);

    await assert.rejects(editor.loadImage(makeImageDataUrl()), EditorFaultedError);
    await assert.rejects(async () => staleApi.triggerFatalRestore(), EditorFaultedError);
    await assert.rejects(editor.exportImageBase64(), EditorFaultedError);
    assert.ok(
        editor.getDiagnostics().some((diagnostic) => diagnostic.behavior === 'fatal-restore'),
    );

    fixture.allowRestore();
    await editor.emergencyReset();

    assert.equal(editor.getLifecycleState(), 'configured');
    assert.equal(editor.getCanvas(), null);
    assert.equal(editor.isImageLoaded(), false);
    assert.equal(fixture.getSetupCount(), 2);
    assert.equal(editor.requirePlugin(fixture.ref), staleApi);
    assert.equal(staleApi.setupGeneration, 2);
    assert.equal(staleApi.readSetupGeneration(), 2);
    assert.equal(editor.requirePlugin(historyPluginRef).getState().size, 0);

    await editor.init({ canvas: ids.canvas });
    await editor.loadImage(makeImageDataUrl());
    assert.equal(editor.isImageLoaded(), true);
    await editor.disposeAsync();
    assert.throws(() => staleApi.getValue(), EditorDisposedError);
});

test('Full preset API references remain live across emergency reset replay', async () => {
    const ids = resetEditorDom();
    const preset = createFullPreset(fabric, { transform: { animationDuration: 0 } });
    const fixture = createFaultFixture();
    const expected = [
        [transformPluginRef, preset.transform],
        [historyPluginRef, preset.history],
        [overlayFoundationRef, preset.overlays],
        [maskPluginRef, preset.masks],
        [filtersPluginRef, preset.filters],
        [cropPluginRef, preset.crop],
        [mosaicPluginRef, preset.mosaic],
        [annotationFoundationRef, preset.annotations],
        [textAnnotationPluginRef, preset.text],
        [shapeAnnotationPluginRef, preset.shape],
        [drawAnnotationPluginRef, preset.draw],
        [overlayStatePluginRef, preset.overlayState],
    ];

    await faultEditor(preset.editor, fixture, ids);
    fixture.allowRestore();
    await preset.editor.emergencyReset();

    for (const [ref, api] of expected) assert.equal(preset.editor.requirePlugin(ref), api);
    await preset.editor.init({ canvas: ids.canvas });
    await preset.editor.loadImage(makeImageDataUrl());
    assert.equal(preset.transform.getState().scale, 1);
    assert.equal(preset.history.getState().size, 0);
    assert.deepEqual(preset.overlays.list(), []);
    assert.deepEqual(preset.masks.getAll(), []);
    assert.equal(preset.filters.isPreviewing, false);
    assert.equal(preset.crop.getSession(), null);
    assert.equal(preset.mosaic.getSession(), null);
    assert.deepEqual(preset.annotations.list(), []);
    assert.equal(preset.text.getEditingSession(), null);
    assert.equal(preset.shape.getSession(), null);
    assert.equal(preset.draw.getSession(), null);

    await preset.editor.disposeAsync();
});

test('emergencyReset replay failure aggregates diagnostics and permanently disposes Core', async () => {
    const ids = resetEditorDom();
    let replayFails = false;
    const fixture = createFaultFixture({ shouldReplayFail: () => replayFails });
    const editor = new ImageEditorCore(fabric);
    await faultEditor(editor, fixture, ids);
    fixture.allowRestore();
    replayFails = true;

    await assert.rejects(editor.emergencyReset(), (error) => {
        assert.equal(error instanceof EmergencyResetError, true);
        assert.ok(error.diagnostics.length > 0);
        return true;
    });
    assert.equal(editor.getLifecycleState(), 'disposed');
    assert.ok(editor.getDiagnostics().some((entry) => /replay/i.test(entry.message)));
});

test('forceDispose is allowed from faulted and always reaches disposed', async () => {
    const ids = resetEditorDom();
    const fixture = createFaultFixture();
    const editor = new ImageEditorCore(fabric);
    await faultEditor(editor, fixture, ids);

    await editor.forceDispose();

    assert.equal(editor.getLifecycleState(), 'disposed');
    assert.equal(editor.getCanvas(), null);
});

test('fault and plugin state remain isolated between Core instances', async () => {
    const firstIds = resetEditorDom({ prefix: `first-${crypto.randomUUID()}` });
    const first = new ImageEditorCore(fabric);
    const firstFixture = createFaultFixture();
    await faultEditor(first, firstFixture, firstIds);

    const secondIds = resetEditorDom({ prefix: `second-${crypto.randomUUID()}` });
    const second = new ImageEditorCore(fabric);
    const secondFixture = createFaultFixture();
    second.use(secondFixture.plugin);
    await second.init({ canvas: secondIds.canvas });
    await second.loadImage(makeImageDataUrl());

    assert.equal(first.getLifecycleState(), 'faulted');
    assert.equal(second.getLifecycleState(), 'initialized');
    assert.equal(second.getDiagnostics().length, 0);
    assert.equal(second.isImageLoaded(), true);

    await first.forceDispose();
    await second.disposeAsync();
});
