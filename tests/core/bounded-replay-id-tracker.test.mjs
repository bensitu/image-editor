import assert from 'node:assert/strict';
import test from 'node:test';

import {
    BoundedReplayIdTracker,
    DEFAULT_RECENT_REPLAY_ID_LIMIT,
} from '../../src/core-runtime/mutation/bounded-replay-id-tracker.js';

test('active and recent replay IDs reject duplicates until eviction or reset', () => {
    const tracker = new BoundedReplayIdTracker(2);

    assert.equal(tracker.start('first'), true);
    assert.equal(tracker.start('first'), false);
    assert.equal(tracker.activeSize, 1);
    tracker.complete('first');
    assert.equal(tracker.activeSize, 0);
    assert.equal(tracker.start('first'), false);

    assert.equal(tracker.start('second'), true);
    tracker.complete('second');
    assert.equal(tracker.start('third'), true);
    tracker.complete('third');
    assert.equal(tracker.recentSize, 2);
    assert.equal(tracker.has('first'), false);
    assert.equal(tracker.has('second'), true);
    assert.equal(tracker.has('third'), true);

    tracker.clear();
    assert.equal(tracker.activeSize, 0);
    assert.equal(tracker.recentSize, 0);
    assert.equal(tracker.start('second'), true);
});

test('100k completed mutation IDs remain within the explicit replay window', () => {
    const tracker = new BoundedReplayIdTracker();

    for (let index = 0; index < 100_000; index += 1) {
        const id = `mutation-${index}`;
        assert.equal(tracker.start(id), true);
        tracker.complete(id);
    }

    assert.equal(tracker.activeSize, 0);
    assert.equal(tracker.recentSize, DEFAULT_RECENT_REPLAY_ID_LIMIT);
    assert.equal(tracker.has('mutation-89999'), false);
    assert.equal(tracker.has('mutation-90000'), true);
    assert.equal(tracker.has('mutation-99999'), true);
});
