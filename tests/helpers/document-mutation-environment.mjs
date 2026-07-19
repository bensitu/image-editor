import { DocumentMutationCoordinator } from '../../src/core-runtime/mutation/index.js';
import { OperationRegistry } from '../../src/plugin-kernel/index.js';

const ALL_MUTATION_DOMAINS = [
    'document',
    'base-image',
    'geometry',
    'raster',
    'overlay',
    'selection',
    'tool',
    'export',
    'state',
];

export function createDocumentMutationEnvironment({
    operationIds,
    mementos,
    state,
    history,
    events,
    warningSink,
    onOperationStart = () => undefined,
    onOperationEnd = () => undefined,
}) {
    const registry = new OperationRegistry();
    for (const id of operationIds) {
        registry.register(
            {
                id,
                mode: 'mutation',
                conflictDomains: ALL_MUTATION_DOMAINS,
                reentrancy: 'reject',
            },
            'core:host',
        );
    }
    const mutations = new DocumentMutationCoordinator({
        mementos,
        operations: {
            has: (operationId) => registry.has(operationId),
            get: (operationId) => registry.get(operationId),
            run: (operationId, task, options) =>
                registry.runForHost(
                    operationId,
                    null,
                    async (_value, context) => {
                        onOperationStart(operationId);
                        try {
                            return await task(context);
                        } finally {
                            onOperationEnd(operationId);
                        }
                    },
                    options,
                ),
        },
        state: {
            requestRender: state.requestRender,
            isDisposed: state.isDisposed,
        },
        history,
        events: {
            emitCommitted: (descriptor) =>
                events.emitCommitted('geometry:committed', descriptor.result),
        },
        warningSink: (warning) =>
            warningSink?.({
                ...warning,
                code:
                    warning.code === 'DOCUMENT_COMMITTED_OBSERVER_FAILED'
                        ? 'COMMITTED_EVENT_LISTENER_FAILED'
                        : warning.code,
            }),
    });
    return { mutations, registry };
}
