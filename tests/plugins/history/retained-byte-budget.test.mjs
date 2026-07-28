import assert from 'node:assert/strict';
import test from 'node:test';

import { HistoryPluginController } from '../../../src/plugins/history/history-controller.js';
import { estimateRetainedBytes } from '../../../src/plugins/history/retained-size-estimator.js';

const DEFAULT_MAX_BYTES = 128 * 1024 * 1024;

function createRecord(operationId, payload) {
    return {
        operationId,
        before: { phase: 'before', payload },
        after: { phase: 'after', payload },
        timestamp: 1,
        detail: undefined,
    };
}

function createController(options = {}) {
    const warnings = [];
    const restored = [];
    const fatalErrors = [];
    const controller = new HistoryPluginController(
        {
            captureMemento: () => ({ phase: 'captured' }),
            restoreMemento: async (memento) => {
                restored.push(memento);
            },
            reportFatal: (error) => {
                fatalErrors.push(error);
            },
        },
        {
            run: (_operationId, body) => body(),
        },
        options,
        (error, message) => warnings.push({ error, message }),
    );
    return { controller, fatalErrors, restored, warnings };
}

test('retained-size estimation is deterministic, UTF-8-aware, and accessor-safe', () => {
    assert.equal(estimateRetainedBytes('plain'), 5);
    assert.equal(estimateRetainedBytes('é'), 2);
    assert.equal(estimateRetainedBytes('😀'), 4);
    assert.equal(estimateRetainedBytes(new ArrayBuffer(12)), 12);
    assert.equal(estimateRetainedBytes(new Uint8Array(new ArrayBuffer(12), 2, 5)), 5);
    assert.equal(estimateRetainedBytes(new DataView(new ArrayBuffer(12), 3, 4)), 4);
    assert.equal(estimateRetainedBytes(new Date(0)), estimateRetainedBytes(new Date(1)));

    let getterCalls = 0;
    const cyclic = { map: new Map(), set: new Set() };
    cyclic.self = cyclic;
    cyclic.map.set('self', cyclic);
    cyclic.set.add(cyclic);
    Object.defineProperty(cyclic, 'unsafe', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return 'not-read';
        },
    });

    const first = estimateRetainedBytes(cyclic);
    const second = estimateRetainedBytes(cyclic);
    assert.equal(first, second);
    assert.ok(first > 0);
    assert.equal(getterCalls, 0);
});

test('maxBytes defaults safely and rejects every invalid explicit value', () => {
    const { controller } = createController();
    assert.equal(controller.getState().maxBytes, DEFAULT_MAX_BYTES);

    for (const maxBytes of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.throws(
            () => createController({ maxBytes }),
            (error) =>
                error?.code === 'HISTORY_MAX_BYTES_INVALID' &&
                /positive safe integer/u.test(error.message),
        );
    }
});

test('maxSize and maxBytes independently and jointly evict FIFO entries', () => {
    const records = [
        createRecord('test:history-a', 'a'),
        createRecord('test:history-b', 'bb'),
        createRecord('test:history-c', 'ccc'),
    ];
    const bytes = records.map((record) => estimateRetainedBytes(record));

    const sizeBound = createController({ maxSize: 2 }).controller;
    records.forEach((record) => sizeBound.push(record));
    assert.equal(sizeBound.length, 2);
    assert.equal(sizeBound.getState().position, 2);

    const byteBound = createController({ maxSize: 10, maxBytes: bytes[1] + bytes[2] }).controller;
    records.forEach((record) => byteBound.push(record));
    assert.deepEqual(byteBound.getState(), {
        isEnabled: true,
        canUndo: true,
        canRedo: false,
        length: 2,
        size: 2,
        position: 2,
        bytes: bytes[1] + bytes[2],
        maxBytes: bytes[1] + bytes[2],
    });

    const combined = createController({ maxSize: 1, maxBytes: bytes[1] + bytes[2] }).controller;
    records.forEach((record) => combined.push(record));
    assert.equal(combined.length, 1);
    assert.equal(combined.getState().bytes, bytes[2]);
});

test('redo truncation, clear, disable, and disposal keep retained bytes exact', async () => {
    const records = [
        createRecord('test:history-a', 'a'),
        createRecord('test:history-b', 'bb'),
        createRecord('test:history-c', 'ccc'),
        createRecord('test:history-d', 'dddd'),
    ];
    const bytes = records.map((record) => estimateRetainedBytes(record));
    const { controller } = createController();
    records.slice(0, 3).forEach((record) => controller.push(record));

    await controller.undo();
    await controller.undo();
    assert.equal(controller.getState().position, 1);
    assert.equal(controller.canRedo(), true);

    controller.push(records[3]);
    assert.equal(controller.getState().bytes, bytes[0] + bytes[3]);
    assert.equal(controller.getState().position, 2);
    assert.equal(controller.canUndo(), true);
    assert.equal(controller.canRedo(), false);

    await controller.disable({ clear: false });
    assert.equal(controller.getState().bytes, bytes[0] + bytes[3]);
    assert.equal(controller.canUndo(), false);
    await controller.disable({ clear: true });
    assert.equal(controller.getState().bytes, 0);

    await controller.enable({ baseline: 'current' });
    controller.push(records[0]);
    controller.clear();
    assert.equal(controller.getState().bytes, 0);

    controller.push(records[1]);
    controller.dispose();
    assert.equal(controller.getState().bytes, 0);
    assert.equal(controller.getState().position, 0);
});

test('an oversized record clears continuity, remains unavailable, and reports a warning', () => {
    const small = createRecord('test:history-small', 'small');
    const oversized = createRecord('test:history-oversized', 'x'.repeat(4_096));
    const smallBytes = estimateRetainedBytes(small);
    const { controller, warnings } = createController({ maxBytes: smallBytes });

    controller.push(small);
    assert.equal(controller.canUndo(), true);
    controller.push(oversized);

    assert.deepEqual(controller.getState(), {
        isEnabled: true,
        canUndo: false,
        canRedo: false,
        length: 0,
        size: 0,
        position: 0,
        bytes: 0,
        maxBytes: smallBytes,
    });
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].error.code, 'HISTORY_RECORD_BYTE_LIMIT_EXCEEDED');
    assert.match(warnings[0].message, /exceeding/u);
});
