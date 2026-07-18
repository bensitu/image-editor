import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    DocumentMutationError,
    DocumentMutationInvariantError,
    DocumentMutationUnrecoverableError,
    EditorFaultedError,
    SnapshotValidationError,
    classifyCoreError,
} from '../../src/core-runtime/errors.js';
import { OverlayRecoverableObjectError } from '../../src/foundations/overlay/index.js';
import { OperationConflictError } from '../../src/plugin-kernel/index.js';

test('Core error classification covers every severity and behavior branch', () => {
    const cases = [
        [new OverlayRecoverableObjectError('bad object'), 'recoverable-object', 'recoverable'],
        [
            { code: 'OPTIONAL_CAPABILITY_INCOMPATIBLE' },
            'recoverable-optional-capability',
            'recoverable',
        ],
        [new DOMException('cancelled', 'AbortError'), 'operation-cancelled', 'cancelled'],
        [new OperationConflictError('conflict'), 'operation-conflict', 'recoverable'],
        [new DocumentMutationError('tx', 'participant failed'), 'fatal-participant', 'fatal'],
        [
            new DocumentMutationInvariantError('tx', new Error('invalid')),
            'fatal-invariant',
            'fatal',
        ],
        [
            new DocumentMutationError('tx', 'rollback failed', new Error('cause'), [
                new Error('rollback'),
            ]),
            'fatal-rollback',
            'fatal',
        ],
        [
            new DocumentMutationUnrecoverableError('tx', new Error('cause'), [
                new Error('restore'),
            ]),
            'fatal-restore',
            'fatal',
        ],
        [new SnapshotValidationError('invalid'), 'snapshot-validation', 'fatal'],
        [new EditorFaultedError('mutate'), 'lifecycle', 'fatal'],
    ];

    for (const [error, behavior, severity] of cases) {
        assert.deepEqual(classifyCoreError(error), { behavior, severity });
    }
});

test('public Core exports no concrete coordinator, Runtime, or privileged capability token', async () => {
    const [publicCore, internalPorts, authoringPorts] = await Promise.all([
        readFile(new URL('../../src/core/index.ts', import.meta.url), 'utf8'),
        readFile(
            new URL('../../src/core-runtime/internal-capabilities.ts', import.meta.url),
            'utf8',
        ),
        readFile(new URL('../../src/sdk/core-capabilities.ts', import.meta.url), 'utf8'),
    ]);

    assert.doesNotMatch(publicCore, /CORE_HOST_CAPABILITY|CORE_STATE_CAPABILITY/);
    assert.doesNotMatch(publicCore, /GeometryMutationCoordinator|DocumentMutationCoordinator/);
    assert.doesNotMatch(publicCore, /EditorRuntime|from\s+['"].*runtime\/editor-runtime/);
    assert.doesNotMatch(internalPorts, /interface CoreHostPort|interface CoreStatePort/);
    assert.match(authoringPorts, /interface BaseImageReadPort/);
    assert.match(authoringPorts, /interface RenderRequestPort/);
    assert.match(authoringPorts, /interface RasterMutationPort/);
    assert.match(authoringPorts, /interface CanvasReadPort/);
    assert.match(authoringPorts, /interface SnapshotRegistrationPort/);

    const baseImageReadPort = authoringPorts.slice(
        authoringPorts.indexOf('interface BaseImageReadPort'),
        authoringPorts.indexOf('interface RenderRequestPort'),
    );
    assert.doesNotMatch(baseImageReadPort, /replace|set|mutat/i);
});
