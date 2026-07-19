import assert from 'node:assert/strict';
import test from 'node:test';

import { DocumentMutationError } from '../../src/core-runtime/mutation/index.js';
import {
    DOCUMENT_MUTATION_CAPABILITY,
    SNAPSHOT_REGISTRATION_CAPABILITY,
} from '../../src/core-runtime/internal-capabilities.js';
import { ImageEditorCore, definePluginRef } from '../../src/core/index.js';
import { fabric, resetEditorDom } from '../helpers/fabric-environment.mjs';

const pluginRef = definePluginRef('example-test:document-state-participant', '1.0.0');

function stateParticipantPlugin() {
    let value = 0;
    let sequence = 0;
    const committed = [];
    return {
        ref: pluginRef,
        version: '1.0.0',
        setupMode: 'sync',
        requires: [
            { token: SNAPSHOT_REGISTRATION_CAPABILITY, range: '^1.0.0' },
            { token: DOCUMENT_MUTATION_CAPABILITY, range: '^1.0.0' },
        ],
        setup(context) {
            const state = context.capabilities.require(SNAPSHOT_REGISTRATION_CAPABILITY);
            const mutations = context.capabilities.require(DOCUMENT_MUTATION_CAPABILITY);
            context.operations.register({
                id: 'example-test:mutate-plugin-state',
                mode: 'mutation',
                conflictDomains: ['document', 'state'],
                reentrancy: 'reject',
            });
            context.addDisposable(
                state.registerSlice({
                    id: pluginRef.id,
                    version: 1,
                    capture: () => ({ value }),
                    validate: (candidate) =>
                        candidate &&
                        typeof candidate === 'object' &&
                        typeof candidate.value === 'number'
                            ? { valid: true, value: candidate }
                            : { valid: false, message: 'Test state is malformed.' },
                    restore: (snapshot) => {
                        value = snapshot.value;
                    },
                    clearState: () => {
                        value = 0;
                    },
                }),
            );
            context.events.on('document:committed', (descriptor) => committed.push(descriptor));
            return Object.freeze({
                getValue: () => value,
                getCommitted: () => [...committed],
                mutate: (nextValue, fail = false) =>
                    mutations.run({
                        id: `example-test:plugin-state-transaction:${++sequence}`,
                        kind: 'plugin-state',
                        operationId: 'example-test:mutate-plugin-state',
                        conflictDomains: ['document', 'state'],
                        mutate: () => {
                            value = nextValue;
                            if (fail) throw new Error('synthetic plugin state failure');
                        },
                    }),
            });
        },
    };
}

test('a Plugin State Slice commits and rolls back through Document Mutation authority', async () => {
    const ids = resetEditorDom();
    const editor = new ImageEditorCore(fabric);
    const participant = editor.use(stateParticipantPlugin());
    await editor.init({ canvas: ids.canvas });

    await participant.mutate(2);
    assert.equal(participant.getValue(), 2);
    assert.equal(participant.getCommitted().length, 1);

    await assert.rejects(participant.mutate(9, true), DocumentMutationError);
    assert.equal(participant.getValue(), 2);
    assert.equal(participant.getCommitted().length, 1);

    await editor.disposeAsync();
});
