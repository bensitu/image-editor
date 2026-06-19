/**
 * Type:
 *   Unit test
 *
 * Purpose:
 *   Verifies the limited busy-operation runner brackets identical facade
 *   operation flows without changing callback/UI ordering.
 *
 * Scope:
 *   - Success path order.
 *   - Rejection path cleanup.
 *
 * Out of scope:
 *   - OperationGuard internals.
 *   - Public ImageEditor no-op contracts.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { runBusyOperation, runBusyOperationWithoutUi } =
    await import('../src/runtime/editor-operation-runner.ts');

function createAccess() {
    const calls = [];
    const token = Symbol('mergeMasks');
    return {
        calls,
        token,
        beginBusyOperation(operation) {
            calls.push(['beginBusyOperation', operation]);
            return token;
        },
        endBusyOperation(receivedToken) {
            calls.push(['endBusyOperation', receivedToken === token]);
        },
        buildCallbackContext(operation, isInternalOperation) {
            calls.push(['buildCallbackContext', operation, isInternalOperation]);
            return { operation, isInternalOperation };
        },
        emitBusyChangeIfChanged(context) {
            calls.push(['emitBusyChangeIfChanged', context.operation]);
        },
        updateUi() {
            calls.push(['updateUi']);
        },
    };
}

test('runBusyOperation preserves success path ordering and return value', async () => {
    const access = createAccess();

    const result = await runBusyOperation(access, 'mergeMasks', async (context, token) => {
        access.calls.push(['body', context.operation, token === access.token]);
        return 'done';
    });

    assert.equal(result, 'done');
    assert.deepEqual(access.calls, [
        ['buildCallbackContext', 'mergeMasks', false],
        ['beginBusyOperation', 'mergeMasks'],
        ['emitBusyChangeIfChanged', 'mergeMasks'],
        ['updateUi'],
        ['body', 'mergeMasks', true],
        ['endBusyOperation', true],
        ['emitBusyChangeIfChanged', 'mergeMasks'],
        ['updateUi'],
    ]);
});

test('runBusyOperation still ends busy state and updates UI when body rejects', async () => {
    const access = createAccess();
    const error = new Error('failed');

    await assert.rejects(
        runBusyOperation(access, 'mergeAnnotations', async () => {
            access.calls.push(['body']);
            throw error;
        }),
        error,
    );

    assert.deepEqual(access.calls, [
        ['buildCallbackContext', 'mergeAnnotations', false],
        ['beginBusyOperation', 'mergeAnnotations'],
        ['emitBusyChangeIfChanged', 'mergeAnnotations'],
        ['updateUi'],
        ['body'],
        ['endBusyOperation', true],
        ['emitBusyChangeIfChanged', 'mergeAnnotations'],
        ['updateUi'],
    ]);
});

test('runBusyOperationWithoutUi preserves export/download ordering', async () => {
    const access = createAccess();

    const result = await runBusyOperationWithoutUi(
        access,
        'exportImageBase64',
        async (context, token) => {
            access.calls.push(['body', context.operation, token === access.token]);
            return 'data-url';
        },
    );

    assert.equal(result, 'data-url');
    assert.deepEqual(access.calls, [
        ['buildCallbackContext', 'exportImageBase64', false],
        ['beginBusyOperation', 'exportImageBase64'],
        ['emitBusyChangeIfChanged', 'exportImageBase64'],
        ['body', 'exportImageBase64', true],
        ['endBusyOperation', true],
        ['emitBusyChangeIfChanged', 'exportImageBase64'],
    ]);
});
