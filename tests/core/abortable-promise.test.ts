import assert from 'node:assert/strict';
import test from 'node:test';

import { settleAbortable } from '../../src/utils/abortable-promise.js';

test('settleAbortable rejects promptly and disposes a late result', async () => {
    const controller = new AbortController();
    const reason = new Error('cancelled');
    let resolveTask = (_value: string): void => {
        throw new Error('Promise executor did not initialize its resolver.');
    };
    let disposedValue: unknown = null;
    const task = new Promise<string>((resolve) => {
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
