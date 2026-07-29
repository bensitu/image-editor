import assert from 'node:assert/strict';
import test from 'node:test';

import {
    DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS,
    GEOMETRY_MUTATION_CONFLICT_DOMAINS,
    OVERLAY_AUTHORING_SESSION_CONFLICT_DOMAINS,
    PERSISTENT_OVERLAY_MUTATION_CONFLICT_DOMAINS,
} from '../../src/utils/internal-operation-conflict-domains.js';

test('shared conflict-domain sets are frozen, semantically named, and exact', () => {
    const sets = [
        DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS,
        GEOMETRY_MUTATION_CONFLICT_DOMAINS,
        PERSISTENT_OVERLAY_MUTATION_CONFLICT_DOMAINS,
        OVERLAY_AUTHORING_SESSION_CONFLICT_DOMAINS,
    ];
    assert.equal(sets.every(Object.isFrozen), true);
    assert.deepEqual(DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS, [
        'document',
        'base-image',
        'geometry',
        'raster',
        'overlay',
        'state',
    ]);
    assert.deepEqual(GEOMETRY_MUTATION_CONFLICT_DOMAINS, [
        'document',
        'base-image',
        'geometry',
        'overlay',
        'state',
    ]);
    assert.deepEqual(PERSISTENT_OVERLAY_MUTATION_CONFLICT_DOMAINS, [
        'document',
        'overlay',
        'selection',
        'state',
    ]);
    assert.deepEqual(OVERLAY_AUTHORING_SESSION_CONFLICT_DOMAINS, ['overlay', 'selection', 'state']);
    assert.equal(new Set(sets.map((domains) => JSON.stringify(domains))).size, sets.length);
});
