import type { CoreEventMap } from '@bensitu/image-editor/core';
import {
    DOCUMENT_MUTATION_CAPABILITY,
    SNAPSHOT_REGISTRATION_CAPABILITY,
    createDisposable,
    definePlugin,
    definePluginRef,
    type ConfigurablePluginApi,
    type Disposable,
    type PluginSetupContext,
    type SynchronousEditorPlugin,
} from '@bensitu/image-editor/sdk';

export interface MetadataConfiguration {
    readonly maximumEntries: number;
    readonly maximumValueLength: number;
}

export interface MetadataSliceEnvelope {
    readonly version: number;
    readonly data: unknown;
}

export interface MetadataPluginApi extends ConfigurablePluginApi<MetadataConfiguration> {
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
    replace(entries: Readonly<Record<string, string>>): Promise<void>;
    getAll(): Readonly<Record<string, string>>;
    onCommitted(listener: (state: Readonly<Record<string, string>>) => void): Disposable;
    migrateSlice(envelope: MetadataSliceEnvelope): Readonly<Record<string, string>>;
}

export interface MetadataPluginOptions {
    readonly configuration?: Partial<MetadataConfiguration>;
}

interface StoredMetadata {
    readonly entries: Readonly<Record<string, string>>;
}

const stateSliceId = '@bensitu/reference-metadata/document';
const operationId = 'reference.metadata:write';
const defaultConfiguration: MetadataConfiguration = Object.freeze({
    maximumEntries: 64,
    maximumValueLength: 4096,
});

export class MetadataSliceVersionError extends RangeError {
    readonly sourceVersion: number;

    constructor(sourceVersion: number) {
        super(`Metadata Slice version ${sourceVersion} is unsupported.`);
        this.name = 'MetadataSliceVersionError';
        this.sourceVersion = sourceVersion;
    }
}

export const metadataPluginRef = definePluginRef<MetadataPluginApi>(
    '@bensitu/reference-metadata',
    '1.0.0',
);

function validateConfiguration(value: MetadataConfiguration): MetadataConfiguration {
    if (
        !Number.isSafeInteger(value.maximumEntries) ||
        value.maximumEntries <= 0 ||
        !Number.isSafeInteger(value.maximumValueLength) ||
        value.maximumValueLength <= 0
    ) {
        throw new TypeError('Metadata configuration is invalid.');
    }
    return Object.freeze({ ...value });
}

function validateEntries(
    value: unknown,
    configuration: MetadataConfiguration,
): Readonly<Record<string, string>> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new TypeError('Metadata entries must be an object.');
    }
    const source = value as Readonly<Record<string, unknown>>;
    const keys = Object.keys(source).sort();
    if (keys.length > configuration.maximumEntries) {
        throw new RangeError('Metadata entry count exceeds the configured maximum.');
    }
    const entries: Record<string, string> = Object.create(null) as Record<string, string>;
    for (const key of keys) {
        const entry = source[key];
        if (
            key.trim().length === 0 ||
            key.trim() !== key ||
            typeof entry !== 'string' ||
            entry.length > configuration.maximumValueLength
        ) {
            throw new TypeError(`Metadata entry "${key}" is invalid.`);
        }
        entries[key] = entry;
    }
    return Object.freeze(entries);
}

function migrateEntries(
    envelope: MetadataSliceEnvelope,
    configuration: MetadataConfiguration,
): Readonly<Record<string, string>> {
    if (!Number.isSafeInteger(envelope.version) || envelope.version <= 0) {
        throw new MetadataSliceVersionError(envelope.version);
    }
    if (envelope.version === 2) return validateEntries(envelope.data, configuration);
    if (envelope.version !== 1) throw new MetadataSliceVersionError(envelope.version);
    if (typeof envelope.data !== 'object' || envelope.data === null) {
        throw new TypeError('Metadata migration input is invalid.');
    }
    const pairs = (envelope.data as { entries?: unknown }).entries;
    if (!Array.isArray(pairs)) throw new TypeError('Metadata migration entries are invalid.');
    const candidate: Record<string, string> = Object.create(null) as Record<string, string>;
    for (const pair of pairs) {
        if (
            !Array.isArray(pair) ||
            pair.length !== 2 ||
            typeof pair[0] !== 'string' ||
            typeof pair[1] !== 'string'
        ) {
            throw new TypeError('Metadata migration entry is invalid.');
        }
        candidate[pair[0]] = pair[1];
    }
    return validateEntries(candidate, configuration);
}

export function createMetadataPlugin(
    options: MetadataPluginOptions = {},
): SynchronousEditorPlugin<MetadataPluginApi, CoreEventMap> {
    let configuration = validateConfiguration({
        ...defaultConfiguration,
        ...options.configuration,
    });
    let entries: Readonly<Record<string, string>> = Object.freeze({});
    let transactionCounter = 0;
    const listeners = new Set<(state: Readonly<Record<string, string>>) => void>();

    return definePlugin({
        ref: metadataPluginRef,
        manifest: {
            id: metadataPluginRef.id,
            version: '1.0.0',
            apiVersion: metadataPluginRef.apiVersion,
            engine: '^3.0.0',
            requires: [
                { token: DOCUMENT_MUTATION_CAPABILITY, range: '^1.0.0' },
                { token: SNAPSHOT_REGISTRATION_CAPABILITY, range: '^1.0.0' },
            ],
        },
        setupMode: 'sync',
        setup(context: PluginSetupContext<CoreEventMap>) {
            const mutations = context.capabilities.require(DOCUMENT_MUTATION_CAPABILITY);
            const state = context.capabilities.require(SNAPSHOT_REGISTRATION_CAPABILITY);
            context.operations.register({
                id: operationId,
                mode: 'mutation',
                conflictDomains: ['document', 'state'],
                reentrancy: 'queue',
            });
            context.disposables.add(
                state.registerSlice<StoredMetadata>({
                    id: stateSliceId,
                    version: 2,
                    capturePolicy: 'always',
                    capture: () => Object.freeze({ entries }),
                    validate(value) {
                        try {
                            if (typeof value !== 'object' || value === null) {
                                throw new TypeError('Metadata state must be an object.');
                            }
                            return {
                                valid: true,
                                value: Object.freeze({
                                    entries: validateEntries(
                                        (value as Partial<StoredMetadata>).entries,
                                        configuration,
                                    ),
                                }),
                            };
                        } catch (error) {
                            return {
                                valid: false,
                                message: error instanceof Error ? error.message : String(error),
                            };
                        }
                    },
                    restore: (value) => {
                        entries = validateEntries(value.entries, configuration);
                    },
                    clearState: () => {
                        entries = Object.freeze({});
                    },
                }),
            );
            context.disposables.add(
                context.events.on('document:committed', (event) => {
                    if (event.operationId !== operationId) return;
                    const snapshot = Object.freeze({ ...entries });
                    for (const listener of [...listeners]) listener(snapshot);
                }),
            );
            context.disposables.add(createDisposable(() => listeners.clear()));

            const commit = async (candidate: Readonly<Record<string, string>>): Promise<void> => {
                const next = validateEntries(candidate, configuration);
                await mutations.run({
                    id: `metadata:write:${++transactionCounter}`,
                    kind: 'plugin-state',
                    operationId,
                    conflictDomains: ['document', 'state'],
                    metadata: Object.freeze({ entryCount: Object.keys(next).length }),
                    mutate: () => {
                        entries = next;
                    },
                    describeCommit: () => Object.freeze({ entryCount: Object.keys(next).length }),
                });
            };

            const api: MetadataPluginApi = {
                set: (key, value) => commit({ ...entries, [key]: value }),
                delete: (key) => {
                    const next = { ...entries };
                    delete next[key];
                    return commit(next);
                },
                replace: commit,
                getAll: () => Object.freeze({ ...entries }),
                onCommitted(listener) {
                    listeners.add(listener);
                    return createDisposable(() => {
                        listeners.delete(listener);
                    });
                },
                migrateSlice: (envelope) => migrateEntries(envelope, configuration),
                configure(patch) {
                    const next = validateConfiguration({ ...configuration, ...patch });
                    validateEntries(entries, next);
                    configuration = next;
                },
                getConfiguration: () => Object.freeze({ ...configuration }),
            };
            return Object.freeze(api);
        },
    });
}
