import {
    DOCUMENT_MUTATION_CAPABILITY,
    SNAPSHOT_REGISTRATION_CAPABILITY,
    definePlugin,
    definePluginRef,
} from '@bensitu/image-editor/sdk';

export function createCommitObserverPlugin(id) {
    const ref = definePluginRef(id, '1.0.0');
    const descriptors = [];
    return definePlugin({
        ref,
        manifest: {
            id: ref.id,
            version: '1.0.0',
            apiVersion: ref.apiVersion,
            engine: '^3.0.0',
        },
        setupMode: 'sync',
        setup(context) {
            context.disposables.add(
                context.events.on('document:committed', (descriptor) => {
                    descriptors.push(descriptor);
                }),
            );
            return Object.freeze({
                clear: () => {
                    descriptors.length = 0;
                },
                getDescriptors: () => Object.freeze([...descriptors]),
            });
        },
    });
}

export function createCaptureProbePlugin() {
    const ref = definePluginRef('testing:capture-probe', '1.0.0');
    let captureCount = 0;
    return definePlugin({
        ref,
        manifest: {
            id: ref.id,
            version: '1.0.0',
            apiVersion: ref.apiVersion,
            engine: '^3.0.0',
            requires: [{ token: SNAPSHOT_REGISTRATION_CAPABILITY, range: '^1.0.0' }],
        },
        setupMode: 'sync',
        setup(context) {
            const state = context.capabilities.require(SNAPSHOT_REGISTRATION_CAPABILITY);
            context.disposables.add(
                state.registerSlice({
                    id: ref.id,
                    version: 1,
                    capturePolicy: 'always',
                    capture: () => {
                        captureCount += 1;
                        return Object.freeze({ ready: true });
                    },
                    validate: (value) =>
                        value && typeof value === 'object' && value.ready === true
                            ? { valid: true, value }
                            : { valid: false, message: 'Capture probe state is invalid.' },
                    restore: () => undefined,
                    clearState: () => undefined,
                }),
            );
            return Object.freeze({
                getCaptureCount: () => captureCount,
                resetCaptureCount: () => {
                    captureCount = 0;
                },
            });
        },
    });
}

export function createCompoundPlugin(transform) {
    const ref = definePluginRef('testing:compound-operation', '1.0.0');
    let sequence = 0;
    return definePlugin({
        ref,
        manifest: {
            id: ref.id,
            version: '1.0.0',
            apiVersion: ref.apiVersion,
            engine: '^3.0.0',
            requires: [{ token: DOCUMENT_MUTATION_CAPABILITY, range: '^1.0.0' }],
        },
        setupMode: 'sync',
        setup(context) {
            const mutations = context.capabilities.require(DOCUMENT_MUTATION_CAPABILITY);
            context.operations.register({
                id: 'testing:compound-apply',
                mode: 'mutation',
                conflictDomains: ['document', 'base-image', 'geometry', 'overlay', 'state'],
                reentrancy: 'reject',
            });
            return Object.freeze({
                run(factor, fail = false) {
                    return mutations.run({
                        id: `testing:compound-apply:${++sequence}`,
                        kind: 'compound',
                        operationId: 'testing:compound-apply',
                        conflictDomains: ['document', 'base-image', 'geometry', 'overlay', 'state'],
                        async mutate(transaction) {
                            await transform.scale(factor, { parent: transaction });
                            if (fail) throw new Error('Compound participant failed.');
                        },
                    });
                },
            });
        },
    });
}

export function createRestoreFailurePlugin() {
    const ref = definePluginRef('testing:restore-failure', '1.0.0');
    let failRestore = false;
    return definePlugin({
        ref,
        manifest: {
            id: ref.id,
            version: '1.0.0',
            apiVersion: ref.apiVersion,
            engine: '^3.0.0',
            requires: [{ token: SNAPSHOT_REGISTRATION_CAPABILITY, range: '^1.0.0' }],
        },
        setupMode: 'sync',
        setup(context) {
            const state = context.capabilities.require(SNAPSHOT_REGISTRATION_CAPABILITY);
            context.disposables.add(
                state.registerSlice({
                    id: ref.id,
                    version: 1,
                    capturePolicy: 'always',
                    capture: () => Object.freeze({ ready: true }),
                    validate: (value) =>
                        value && typeof value === 'object' && value.ready === true
                            ? { valid: true, value }
                            : { valid: false, message: 'Restore probe state is invalid.' },
                    restore: () => {
                        if (failRestore) {
                            failRestore = false;
                            throw new Error('Restore probe failed.');
                        }
                    },
                    clearState: () => undefined,
                }),
            );
            return Object.freeze({
                failNextRestore: () => {
                    failRestore = true;
                },
            });
        },
    });
}
