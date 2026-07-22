import assert from 'node:assert/strict';
import test from 'node:test';

import { settleAbortable } from '../../src/utils/abortable-promise.js';

test('settleAbortable rejects promptly and disposes a late result', async () => {
    const controller = new AbortController();
    const reason = new Error('cancelled');
    let resolveTask;
    let disposedValue = null;
    const task = new Promise((resolve) => {
        resolveTask = resolve;
    });
    const operation = settleAbortable(task, controller.signal, (value) => {
        disposedValue = value;
    });

    controller.abort(reason);
    await assert.rejects(operation, (error) => error === reason);
    resolveTask('late');
    await Promise.resolve();

    assert.equal(disposedValue, 'late');
});
