/** Verifies that Mask warning callbacks are forwarded safely and remain observational. */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { reportWarning } from '../src/core/callback-reporter.ts';

type ConsoleCall = unknown[];

function withConsoleSpies<TResult>(
    body: (calls: { warnCalls: ConsoleCall[]; errorCalls: ConsoleCall[] }) => TResult,
) {
    const warnCalls: ConsoleCall[] = [];
    const errorCalls: ConsoleCall[] = [];
    const originalWarn = console.warn;
    const originalError = console.error;
    console.warn = (...args) => {
        warnCalls.push(args);
    };
    console.error = (...args) => {
        errorCalls.push(args);
    };
    try {
        const result = body({ warnCalls, errorCalls });
        return { warnCalls, errorCalls, result };
    } finally {
        console.warn = originalWarn;
        console.error = originalError;
    }
}

test('reportWarning forwards the original value and message', () => {
    const calls: [unknown, string][] = [];
    const sentinel = new Error('mask callback warning');
    const options = {
        onWarning: (error: unknown, message: string) => calls.push([error, message]),
    };

    const { warnCalls, errorCalls } = withConsoleSpies(() => {
        reportWarning(options, sentinel, 'Mask callback failed.');
    });

    assert.deepEqual(calls, [[sentinel, 'Mask callback failed.']]);
    assert.deepEqual(warnCalls, []);
    assert.deepEqual(errorCalls, []);
});

test('reportWarning forwards non-Error values unchanged', () => {
    const values = ['string error', 42, null, undefined, { code: 'E_FAKE' }, false];
    for (const value of values) {
        const calls: unknown[] = [];
        reportWarning({ onWarning: (error) => calls.push(error) }, value, 'message');
        assert.deepEqual(calls, [value]);
    }
});

test('reportWarning ignores missing and invalid callbacks', () => {
    for (const options of [
        {},
        { onWarning: null },
        { onWarning: undefined },
        { onWarning: 'not a function' },
        { onWarning: 42 },
    ]) {
        assert.doesNotThrow(() => reportWarning(options as never, new Error('warning'), 'message'));
    }
});

test('reportWarning contains and logs callback failures', () => {
    const callbackError = new Error('callback failed');
    const { warnCalls, errorCalls } = withConsoleSpies(() => {
        assert.doesNotThrow(() =>
            reportWarning(
                {
                    onWarning: () => {
                        throw callbackError;
                    },
                },
                new Error('original warning'),
                'message',
            ),
        );
    });

    assert.deepEqual(warnCalls, [['[ImageEditor] onWarning callback threw', callbackError]]);
    assert.deepEqual(errorCalls, []);
});
