import assert from 'node:assert/strict';

import { ImageEditorCore } from '@bensitu/image-editor/core';
import { overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';
import {
    BASE_IMAGE_INFO_CAPABILITY,
    DOCUMENT_MUTATION_CAPABILITY,
    FABRIC_RUNTIME_CAPABILITY,
    RASTER_MUTATION_CAPABILITY,
    SNAPSHOT_REGISTRATION_CAPABILITY,
} from '@bensitu/image-editor/sdk';
import { CONFORMANCE_PROFILE, runPluginConformance } from '@bensitu/image-editor/testing';
import {
    OVERLAY_CAPABILITY,
    OVERLAY_REGISTRATION_CAPABILITY,
} from '@bensitu/image-editor/plugins/overlay';

import { disposeEditor, fabric } from './fabric-environment.mjs';

function removableRegistration(collection, value) {
    collection.add(value);
    let active = true;
    return Object.freeze({
        dispose() {
            if (!active) return;
            active = false;
            collection.delete(value);
        },
    });
}

function createTransactionContext(id) {
    return Object.freeze({
        transactionId: id,
        parentTransactionId: null,
        operationId: id,
        kind: 'plugin-state',
        conflictDomains: Object.freeze(['document', 'state']),
        metadata: Object.freeze({}),
        signal: new AbortController().signal,
        addRollback: () => undefined,
        addValidator: () => undefined,
        reportDiagnostic: () => undefined,
    });
}

function createDocumentMutationPort() {
    let sequence = 0;
    return Object.freeze({
        async run(request) {
            const transaction = createTransactionContext(`conformance:${++sequence}`);
            for (const participant of [...(request.participants ?? [])].sort(
                (left, right) => left.order - right.order,
            )) {
                await participant.prepare?.(transaction);
            }
            try {
                const result = await request.mutate(transaction);
                await request.synchronize?.(result, transaction);
                await request.validate?.(result, transaction);
                request.describeCommit?.(result, transaction);
                return result;
            } catch (error) {
                await request.rollback?.(error, transaction);
                throw error;
            }
        },
    });
}

function createOverlayPorts() {
    const definitions = new Set();
    const objects = [];
    let selection = Object.freeze({
        ids: Object.freeze([]),
        primaryId: null,
        kinds: Object.freeze([]),
    });

    const classify = (object) => {
        for (const definition of definitions) {
            if (!definition.classify(object)) continue;
            const persistentId = definition.getPersistentId(object);
            if (!persistentId) return null;
            return Object.freeze({
                kind: definition.id,
                persistentId,
                ownerPluginId: definition.ownerPluginId,
                hidden: false,
                locked: false,
            });
        }
        return null;
    };
    const requireObjects = (incoming, mode) => {
        for (const object of incoming) {
            const classification = classify(object);
            const definition = [...definitions].find(
                (candidate) => candidate.id === classification?.kind,
            );
            if (!classification || definition.persistence.mode !== mode) {
                throw new Error(`Conformance Overlay expected a ${mode} object.`);
            }
        }
    };
    const removeIds = (ids) => {
        for (let index = objects.length - 1; index >= 0; index -= 1) {
            const classification = classify(objects[index]);
            if (classification && ids.includes(classification.persistentId))
                objects.splice(index, 1);
        }
    };
    const overlay = Object.freeze({
        list(query = {}) {
            return Object.freeze(
                objects.filter((object) => {
                    const entry = classify(object);
                    return entry && (!query.kinds || query.kinds.includes(entry.kind));
                }),
            );
        },
        getByPersistentId(id) {
            return objects.find((object) => classify(object)?.persistentId === id) ?? null;
        },
        classify,
        flatten: async () => undefined,
        async mutate(request) {
            const transaction = createTransactionContext(request.id);
            const context = Object.freeze({
                transaction,
                action: request.action,
                objectIds: Object.freeze([...(request.objectIds ?? [])]),
            });
            const result = await request.mutate(context);
            await request.affectedObjects?.(result, context);
            await request.synchronize?.(result, context);
            await request.validate?.(result, context);
            return result;
        },
        async add(incoming) {
            requireObjects(incoming, 'persistent');
            objects.push(...incoming);
        },
        async addTransient(incoming) {
            requireObjects(incoming, 'transient');
            objects.push(...incoming);
        },
        async replaceTransient(ids, incoming) {
            removeIds(ids);
            requireObjects(incoming, 'transient');
            objects.push(...incoming);
        },
        async remove(ids) {
            removeIds(ids);
        },
        async removeTransient(ids) {
            removeIds(ids);
        },
        cancelActiveGesture: async () => undefined,
        waitForIdle: async () => undefined,
        getSelection: () => selection,
        select(ids) {
            const values = Object.freeze([...ids]);
            selection = Object.freeze({
                ids: values,
                primaryId: values[0] ?? null,
                kinds: Object.freeze(
                    values
                        .map((id) => classify(overlay.getByPersistentId(id))?.kind)
                        .filter(Boolean),
                ),
            });
        },
        discardSelection() {
            selection = Object.freeze({
                ids: Object.freeze([]),
                primaryId: null,
                kinds: Object.freeze([]),
            });
        },
        onSelectionChange: () => Object.freeze({ dispose: () => undefined }),
        setHidden: async () => undefined,
        setLocked: async () => undefined,
        bringForward: async () => undefined,
        sendBackward: async () => undefined,
        bringToFront: async () => undefined,
        sendToBack: async () => undefined,
    });
    const registration = Object.freeze({
        definitions,
        registerKind: (definition) => removableRegistration(definitions, definition),
        registerGeometryPolicy: (definition) => removableRegistration(new Set(), definition),
        registerInteractionPolicy: (definition) => removableRegistration(new Set(), definition),
        registerExportRenderer: (definition) => removableRegistration(new Set(), definition),
    });
    return { definitions, overlay, registration };
}

function createHostCapabilities() {
    const slices = new Set();
    const overlayPorts = createOverlayPorts();
    const providers = [
        {
            token: BASE_IMAGE_INFO_CAPABILITY,
            implementation: Object.freeze({
                getBaseImageScale: () => 1,
                getGeometryRevision: () => 0,
                getCanvasSize: () => Object.freeze({ width: 320, height: 240 }),
                getImageInfo: () =>
                    Object.freeze({
                        naturalWidth: 160,
                        naturalHeight: 120,
                        mimeType: 'image/png',
                    }),
                isImageLoaded: () => true,
            }),
        },
        {
            token: DOCUMENT_MUTATION_CAPABILITY,
            implementation: createDocumentMutationPort(),
        },
        {
            token: FABRIC_RUNTIME_CAPABILITY,
            implementation: Object.freeze({ fabric }),
            requiredPermission: 'fabric:objects',
        },
        {
            token: RASTER_MUTATION_CAPABILITY,
            implementation: Object.freeze({ replaceBaseImage: () => undefined }),
            requiredPermission: 'core:raster-mutation',
        },
        {
            token: SNAPSHOT_REGISTRATION_CAPABILITY,
            implementation: Object.freeze({
                definitions: slices,
                registerSlice: (definition) => removableRegistration(slices, definition),
                registerObjectProperties: (definition) =>
                    removableRegistration(new Set(), definition),
                registerTransientObject: (owner) => removableRegistration(new Set(), owner),
                registerExternalObject: (owner) => removableRegistration(new Set(), owner),
            }),
            verifyCleanup: () => assert.equal(slices.size, 0),
        },
        {
            token: OVERLAY_CAPABILITY,
            implementation: overlayPorts.overlay,
        },
        {
            token: OVERLAY_REGISTRATION_CAPABILITY,
            implementation: overlayPorts.registration,
            requiredPermission: 'fabric:custom-class',
            verifyCleanup: () => assert.equal(overlayPorts.definitions.size, 0),
        },
    ];
    return Object.freeze(providers);
}

function definitionsFromProviders(providers) {
    const provider = providers.find(
        (candidate) => candidate.token.id === OVERLAY_REGISTRATION_CAPABILITY.id,
    );
    return Object.freeze([...(provider?.implementation.definitions ?? [])]);
}

function globalMutationLifecycle(descriptor) {
    return Object.freeze({
        fabric,
        importModule: () => import(descriptor.specifier),
        createDefinition: (module) => descriptor.create(module),
        async setup(definition) {
            const editor = new ImageEditorCore(fabric);
            if (descriptor.overlay) editor.use(overlayFoundationPlugin());
            editor.use(definition);
            return editor;
        },
        dispose: (editor) => disposeEditor(editor),
    });
}

function stateAdapter(key) {
    if (key === 'watermark') {
        return {
            capture: (api) => api.getConfiguration(),
            mutate: (api) => api.configure({ defaultOpacity: 0.2 }),
            restore: (api, state) => api.configure(state),
        };
    }
    if (key === 'metadata') {
        return {
            capture: (api) => api.getAll(),
            mutate: (api) => api.set('conformance', 'changed'),
            restore: (api, state) => api.replace(state),
        };
    }
    return 'not-applicable';
}

const descriptors = Object.freeze([
    Object.freeze({
        key: 'watermark',
        specifier: '@bensitu/reference-watermark',
        overlay: true,
        create: (module) => module.createWatermarkPlugin(),
        inspectKinds: true,
    }),
    Object.freeze({
        key: 'metadata',
        specifier: '@bensitu/reference-metadata',
        overlay: false,
        create: (module) => module.createMetadataPlugin(),
        inspectKinds: false,
    }),
    Object.freeze({
        key: 'gridGuide',
        specifier: '@bensitu/reference-grid-guide',
        overlay: true,
        create: (module) => module.createGridGuidePlugin(),
        inspectKinds: true,
    }),
    Object.freeze({
        key: 'blurRegion',
        specifier: '@bensitu/reference-blur-region',
        overlay: true,
        create: (module) =>
            module.createBlurRegionPlugin({
                rasterize: async () => {
                    throw new Error('Conformance does not execute the raster adapter.');
                },
            }),
        inspectKinds: true,
    }),
]);

export async function proveConformance(proofInput, behavior) {
    const reports = {};
    for (const descriptor of descriptors) {
        const module = await import(descriptor.specifier);
        const plugin = descriptor.create(module);
        const packageProof = proofInput.packages[descriptor.key];
        const report = await runPluginConformance(plugin, {
            profile: CONFORMANCE_PROFILE,
            createPlugin: () => descriptor.create(module),
            createHostCapabilities,
            lifecycleImage: Object.freeze({ width: 1, height: 1 }),
            stateRoundTrip: stateAdapter(descriptor.key),
            persistentKinds: descriptor.inspectKinds
                ? { inspect: (_api, providers) => definitionsFromProviders(providers) }
                : 'not-applicable',
            typeInferenceFixtures: () => {
                assert.equal(proofInput.typesPassed, true);
            },
            responsibilities: {
                bundleIsolation: packageProof.bundleIsolation,
                fabricGlobalMutation: globalMutationLifecycle(descriptor),
                multiInstanceIsolation: behavior.transactions.multiInstanceIsolation,
                peerDependencyContract: packageProof.manifest,
                packageModules: packageProof.packageModules,
                baseImageInvariant: behavior.topology.baseImageInvariant,
                overlayMutationHistory: behavior.watermarkMetadata.watermark.overlayMutationHistory,
                compoundTransaction: behavior.transactions.compoundTransaction,
                sliceMigration: behavior.watermarkMetadata.metadata.sliceMigration,
            },
        });
        assert.equal(report.result, 'PASS', `${descriptor.key} conformance failed.`);
        assert.equal(report.assertions.length, 18);
        assert.equal(
            report.assertions.filter((assertion) => assertion.status === 'NOT_AVAILABLE').length,
            0,
        );
        reports[descriptor.key] = report;
    }
    return Object.freeze(reports);
}
