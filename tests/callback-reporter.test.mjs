/**
 * Unit tests for the warning/error callback reporting helpers.
 *
 * Owner module: `src/core/callback-reporter.ts` —
 * `reportWarning` and `reportError`.
 *
 * Behaviors under test:
 *
 *   1. **Public `(error, message)` argument order (Req 3.8, 5.4, 5.5)** —
 *      both helpers forward the original error as the first callback
 *      argument and the human-readable message as the second.
 *   2. **No-callback no-op** — when `onWarning` / `onError` is missing or
 *      not a function, the helpers do nothing and do not throw.
 *   3. **Callback exception isolation (Req 5.4, 5.5)** — if the callback
 *      itself throws, the helper catches the exception and logs to
 *      `console.warn` (warning path) or `console.error` (error path),
 *      then returns normally.
 *   4. **Original error preservation (Req 5.5)** — `reportError` does not
 *      rethrow on callback exception, so a caller that throws the
 *      original editor error after the helper returns observes that
 *      original error on the resulting promise — never the callback's.
 *   5. **Argument forwarding fidelity** — `error` of any shape (Error
 *      instance, plain object, primitive, `null`, `undefined`) flows
 *      through unchanged.
 *
 * Runtime note: Node 24+ strips TypeScript syntax natively, so the test
 * imports the module under test directly from source.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    reportWarning,
    reportError,
} from '../src/core/callback-reporter.ts';

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Run `body` with `console.warn` and `console.error` replaced by recorders.
 * Restores the originals on both success and failure so a failing
 * assertion cannot leak the monkey patches into later tests.
 */
function withConsoleSpies(body) {
    const warnCalls = [];
    const errorCalls = [];
    const originalWarn = console.warn;
    const originalError = console.error;
    console.warn = (...args) => { warnCalls.push(args); };
    console.error = (...args) => { errorCalls.push(args); };
    try {
        const result = body({ warnCalls, errorCalls });
        return { warnCalls, errorCalls, result };
    } finally {
        console.warn = originalWarn;
        console.error = originalError;
    }
}

// ─── reportWarning ────────────────────────────────────────────────────────

test('reportWarning: forwards (error, message) in the public argument order', () => {
    const calls = [];
    const options = {
        onWarning: (err, msg) => { calls.push([err, msg]); },
    };
    const sentinel = new Error('downsample fallback');

    const { warnCalls, errorCalls } = withConsoleSpies(() => {
        reportWarning(options, sentinel, 'Downsample fell back to source format.');
    });

    assert.equal(calls.length, 1, 'callback must fire exactly once');
    assert.equal(calls[0].length, 2, 'callback must receive exactly two args');
    assert.equal(calls[0][0], sentinel, 'first arg must be the original error');
    assert.equal(calls[0][1], 'Downsample fell back to source format.',
        'second arg must be the message');
    assert.equal(warnCalls.length, 0, 'no console.warn on success');
    assert.equal(errorCalls.length, 0, 'no console.error on success');
});

test('reportWarning: forwards non-Error error values unchanged', () => {
    const cases = [
        'string error',
        42,
        null,
        undefined,
        { code: 'E_FAKE' },
        false,
    ];

    for (const value of cases) {
        const calls = [];
        const options = { onWarning: (err, msg) => { calls.push([err, msg]); } };

        withConsoleSpies(() => {
            reportWarning(options, value, 'msg');
        });

        assert.equal(calls.length, 1, `callback must fire for value=${String(value)}`);
        assert.equal(calls[0][0], value,
            `error arg must be forwarded unchanged for value=${String(value)}`);
        assert.equal(calls[0][1], 'msg');
    }
});

test('reportWarning: missing or non-function onWarning is a no-op', () => {
    const cases = [
        {},
        { onWarning: null },
        { onWarning: undefined },
        { onWarning: 'not a function' },
        { onWarning: 42 },
        { onWarning: {} },
    ];

    for (const options of cases) {
        const { warnCalls, errorCalls } = withConsoleSpies(() => {
            // Must not throw despite the wonky shape.
            assert.doesNotThrow(
                () => reportWarning(options, new Error('e'), 'm'),
                `reportWarning must be a no-op for options=${JSON.stringify(options)}`,
            );
        });

        assert.equal(warnCalls.length, 0,
            `no console.warn for no-callback options=${JSON.stringify(options)}`);
        assert.equal(errorCalls.length, 0,
            `no console.error for no-callback options=${JSON.stringify(options)}`);
    }
});

test('reportWarning: catches callback exceptions and logs to console.warn', () => {
    const callbackError = new Error('user warning callback exploded');
    const options = {
        onWarning: () => { throw callbackError; },
    };

    const { warnCalls, errorCalls } = withConsoleSpies(() => {
        // Must not propagate the callback's exception — Req 5.4.
        assert.doesNotThrow(
            () => reportWarning(options, new Error('orig'), 'msg'),
            'reportWarning must swallow callback exceptions',
        );
    });

    assert.equal(warnCalls.length, 1,
        'console.warn must be called exactly once on callback exception');
    // Diagnostic line should name the helper and include the thrown value
    // so the misbehaving callback is easy to locate from the logs.
    assert.equal(typeof warnCalls[0][0], 'string');
    assert.match(warnCalls[0][0], /onWarning/);
    assert.equal(warnCalls[0][1], callbackError,
        'console.warn must include the callback exception value');
    assert.equal(errorCalls.length, 0,
        'reportWarning must not log to console.error');
});

// ─── reportError ──────────────────────────────────────────────────────────

test('reportError: forwards (error, message) in the public argument order', () => {
    const calls = [];
    const options = {
        onError: (err, msg) => { calls.push([err, msg]); },
    };
    const sentinel = new Error('image decode failed');

    const { warnCalls, errorCalls } = withConsoleSpies(() => {
        reportError(options, sentinel, 'Image load failed: decode error.');
    });

    assert.equal(calls.length, 1, 'callback must fire exactly once');
    assert.equal(calls[0].length, 2, 'callback must receive exactly two args');
    assert.equal(calls[0][0], sentinel, 'first arg must be the original error');
    assert.equal(calls[0][1], 'Image load failed: decode error.',
        'second arg must be the message');
    assert.equal(warnCalls.length, 0, 'no console.warn on success');
    assert.equal(errorCalls.length, 0, 'no console.error on success');
});

test('reportError: missing or non-function onError is a no-op', () => {
    const cases = [
        {},
        { onError: null },
        { onError: undefined },
        { onError: 'not a function' },
        { onError: 42 },
        { onError: {} },
    ];

    for (const options of cases) {
        const { warnCalls, errorCalls } = withConsoleSpies(() => {
            assert.doesNotThrow(
                () => reportError(options, new Error('e'), 'm'),
                `reportError must be a no-op for options=${JSON.stringify(options)}`,
            );
        });

        assert.equal(warnCalls.length, 0,
            `no console.warn for no-callback options=${JSON.stringify(options)}`);
        assert.equal(errorCalls.length, 0,
            `no console.error for no-callback options=${JSON.stringify(options)}`);
    }
});

test('reportError: catches callback exceptions and logs to console.error', () => {
    const callbackError = new Error('user error callback exploded');
    const options = {
        onError: () => { throw callbackError; },
    };

    const { warnCalls, errorCalls } = withConsoleSpies(() => {
        // Must not propagate the callback's exception — Req 5.5.
        assert.doesNotThrow(
            () => reportError(options, new Error('orig'), 'msg'),
            'reportError must swallow callback exceptions',
        );
    });

    assert.equal(errorCalls.length, 1,
        'console.error must be called exactly once on callback exception');
    assert.equal(typeof errorCalls[0][0], 'string');
    assert.match(errorCalls[0][0], /onError/);
    assert.equal(errorCalls[0][1], callbackError,
        'console.error must include the callback exception value');
    assert.equal(warnCalls.length, 0,
        'reportError must not log to console.warn');
});

// ─── Original-error preservation (Req 5.5) ────────────────────────────────

test('reportError: original editor error is not masked when callback throws', async () => {
    // Models the call shape in the image loader: we report the error,
    // then reject with the original. A faulty callback must not be able
    // to swap its own exception in.
    const original = new Error('original editor error');
    const callbackError = new Error('callback exploded');
    const options = {
        onError: () => { throw callbackError; },
    };

    const promise = (async () => {
        withConsoleSpies(() => {
            reportError(options, original, 'pipeline failure');
        });
        // The pipeline preserves the original for the consumer.
        throw original;
    })();

    await assert.rejects(
        promise,
        (err) => {
            assert.equal(err, original,
                'consumer must observe the original error, not the callback exception');
            assert.notEqual(err, callbackError,
                'callback exception must not surface on the consumer promise');
            return true;
        },
    );
});
