import assert from 'node:assert/strict';
import test from 'node:test';

import {
    DOCUMENT_MUTATION_CAPABILITY,
    SNAPSHOT_REGISTRATION_CAPABILITY,
} from '../../src/core-runtime/internal-capabilities.js';
import {
    EmergencyResetError,
    EditorFaultedError,
    ImageEditorCore,
    definePluginRef,
} from '../../src/core/index.js';
import { historyPlugin, historyPluginRef } from '../../src/plugins/history/index.js';
import { fabric, makeImageDataUrl, resetEditorDom } from '../helpers/fabric-environment.mjs';

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

async function faultEditor(editor, fixture, ids) {
    editor.use(historyPlugin());
    const api = editor.use(fixture.plugin);
    await editor.init({ canvas: ids.canvas });
    await assert.rejects(api.triggerFatalRestore(), /pre-operation state could not be restored/i);
    assert.equal(editor.getLifecycleState(), 'faulted');
    return api;
}

test('fatal restore faults Core, rejects ordinary work, and emergencyReset replays clean state', async () => {
    const ids = resetEditorDom();
    const editor = new ImageEditorCore(fabric);
    const fixture = createFaultFixture();
    const staleApi = await faultEditor(editor, fixture, ids);

    await assert.rejects(editor.loadImage(makeImageDataUrl()), EditorFaultedError);
    await assert.rejects(staleApi.triggerFatalRestore(), EditorFaultedError);
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
    assert.notEqual(editor.requirePlugin(fixture.ref), staleApi);
    assert.equal(editor.requirePlugin(historyPluginRef).getState().size, 0);

    await editor.init({ canvas: ids.canvas });
    await editor.loadImage(makeImageDataUrl());
    assert.equal(editor.isImageLoaded(), true);
    await editor.disposeAsync();
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
