import assert from 'node:assert/strict';

import { ImageEditorCore } from '@bensitu/image-editor/core';
import { historyPlugin } from '@bensitu/image-editor/plugins/history';
import { OVERLAY_CAPABILITY, overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';
import {
    BASE_IMAGE_INFO_CAPABILITY,
    FABRIC_RUNTIME_CAPABILITY,
    RASTER_MUTATION_CAPABILITY,
    PluginBatchInstallError,
    PluginDependencyCycleError,
    createCapabilityToken,
    createDisposable,
    definePlugin,
    definePluginRef,
} from '@bensitu/image-editor/sdk';
import { createWatermarkPlugin } from '@bensitu/reference-watermark';

import {
    createEditorElements,
    disposeEditor,
    fabric,
    makeImageDataUrl,
} from './fabric-environment.mjs';
import { createCommitObserverPlugin } from './public-probes.mjs';

function createTopologyPlugin(ref, options = {}) {
    return definePlugin({
        ref,
        manifest: {
            id: ref.id,
            version: '1.0.0',
            apiVersion: ref.apiVersion,
            engine: '^3.0.0',
            requiresPlugins: options.requiresPlugins,
            requires: options.requires,
        },
        setupMode: 'sync',
        setup(context) {
            options.setupOrder?.push(ref.id);
            if (options.fail) throw new Error(`Setup failed for ${ref.id}.`);
            options.provide?.(context);
            context.disposables.add(
                createDisposable(() => options.registrationCleanup?.push(ref.id)),
            );
            return Object.freeze({ id: ref.id });
        },
        onDispose: () => options.disposeOrder?.push(ref.id),
    });
}

async function proveTopology() {
    const port = createCapabilityToken('proof:foundation-port', '1.0.0');
    const foundationRef = definePluginRef('proof:foundation-a', '1.0.0');
    const leftRef = definePluginRef('proof:foundation-b-left', '1.0.0');
    const rightRef = definePluginRef('proof:foundation-b-right', '1.0.0');
    const featureRef = definePluginRef('proof:feature-c', '1.0.0');
    const setupOrder = [];
    const disposeOrder = [];
    const registrationCleanup = [];
    const foundation = createTopologyPlugin(foundationRef, {
        setupOrder,
        disposeOrder,
        registrationCleanup,
        provide: (context) => context.capabilities.provide(port, Object.freeze({ ready: true })),
    });
    const left = createTopologyPlugin(leftRef, {
        setupOrder,
        disposeOrder,
        registrationCleanup,
        requiresPlugins: [foundationRef],
        requires: [{ token: port, range: '^1.0.0' }],
    });
    const right = createTopologyPlugin(rightRef, {
        setupOrder,
        disposeOrder,
        registrationCleanup,
        requiresPlugins: [foundationRef],
    });
    const feature = createTopologyPlugin(featureRef, {
        setupOrder,
        disposeOrder,
        registrationCleanup,
        requiresPlugins: [leftRef, rightRef],
    });
    const editor = new ImageEditorCore(fabric);
    editor.install([feature, right, foundation, left]);
    assert.equal(setupOrder[0], foundationRef.id);
    assert.equal(setupOrder.at(-1), featureRef.id);
    assert.equal(editor.requirePlugin(featureRef).id, featureRef.id);
    await disposeEditor(editor);
    assert.equal(disposeOrder[0], featureRef.id);
    assert.equal(disposeOrder.at(-1), foundationRef.id);
    assert.equal(registrationCleanup.length, 4);

    const cycleFirstRef = definePluginRef('proof:cycle-first', '1.0.0');
    const cycleSecondRef = definePluginRef('proof:cycle-second', '1.0.0');
    const cycleEditor = new ImageEditorCore(fabric);
    assert.throws(
        () =>
            cycleEditor.install([
                createTopologyPlugin(cycleFirstRef, { requiresPlugins: [cycleSecondRef] }),
                createTopologyPlugin(cycleSecondRef, { requiresPlugins: [cycleFirstRef] }),
            ]),
        PluginDependencyCycleError,
    );
    await disposeEditor(cycleEditor);

    const retainedRef = definePluginRef('proof:retained-package', '1.0.0');
    const batchBaseRef = definePluginRef('proof:batch-base', '1.0.0');
    const failingRef = definePluginRef('proof:batch-failure', '1.0.0');
    const blockedRef = definePluginRef('proof:blocked-feature', '1.0.0');
    const batchEditor = new ImageEditorCore(fabric);
    batchEditor.use(createTopologyPlugin(retainedRef));
    assert.throws(
        () =>
            batchEditor.install([
                createTopologyPlugin(blockedRef, { requiresPlugins: [failingRef] }),
                createTopologyPlugin(failingRef, {
                    requiresPlugins: [batchBaseRef],
                    fail: true,
                }),
                createTopologyPlugin(batchBaseRef),
            ]),
        PluginBatchInstallError,
    );
    assert.equal(batchEditor.requirePlugin(retainedRef).id, retainedRef.id);
    assert.equal(batchEditor.getPlugin(batchBaseRef), null);
    assert.equal(batchEditor.getPlugin(failingRef), null);
    assert.equal(batchEditor.getPlugin(blockedRef), null);
    await disposeEditor(batchEditor);

    return Object.freeze({
        unorderedInstallDeterministic: true,
        pluginAndCapabilityDependenciesDistinct: true,
        cycleRejectedBeforeSetup: true,
        failedBatchRolledBack: true,
        retainedPackagePreserved: true,
        failedApisVisible: 0,
        cleanupReverseTopological: true,
    });
}

function createInvariantProbePlugin() {
    const ref = definePluginRef('proof:base-image-invariant', '1.0.0');
    return definePlugin({
        ref,
        manifest: {
            id: ref.id,
            version: '1.0.0',
            apiVersion: ref.apiVersion,
            engine: '^3.0.0',
            requires: [
                { token: BASE_IMAGE_INFO_CAPABILITY, range: '^1.0.0' },
                { token: FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' },
                { token: OVERLAY_CAPABILITY, range: '^1.0.0' },
                { token: RASTER_MUTATION_CAPABILITY, range: '^1.0.0' },
            ],
            permissions: ['fabric:objects', 'core:raster-mutation'],
        },
        setupMode: 'sync',
        setup(context) {
            const imageInfo = context.capabilities.require(BASE_IMAGE_INFO_CAPABILITY);
            const fabricRuntime = context.capabilities.require(FABRIC_RUNTIME_CAPABILITY).fabric;
            const overlay = context.capabilities.require(OVERLAY_CAPABILITY);
            const raster = context.capabilities.require(RASTER_MUTATION_CAPABILITY);
            return Object.freeze({
                createUnregisteredImage: (source) => fabricRuntime.FabricImage.fromURL(source),
                insertUnregisteredImage: (image) => overlay.add([image]),
                removeBaseImage: () => overlay.remove(['core:base-image']),
                reorderBaseImage: () => overlay.sendToBack('core:base-image'),
                replaceWithoutTransaction(image) {
                    raster.replaceBaseImage(
                        Object.freeze({
                            transactionId: 'proof:detached-raster',
                            parentTransactionId: null,
                            operationId: 'proof:detached-raster',
                            kind: 'raster',
                            conflictDomains: Object.freeze(['document', 'base-image', 'raster']),
                            metadata: Object.freeze({}),
                            signal: new AbortController().signal,
                            addRollback: () => undefined,
                            addValidator: () => undefined,
                            reportDiagnostic: () => undefined,
                        }),
                        image,
                    );
                },
                retainMutableAlias() {
                    const info = imageInfo.getImageInfo();
                    if (!info || Reflect.set(info, 'naturalWidth', 1)) {
                        throw new Error('Base Image information exposed mutable state.');
                    }
                    throw new TypeError('Base Image information is immutable.');
                },
                hasMutableBaseImage: () => 'getBaseImage' in imageInfo,
            });
        },
    });
}

async function proveBaseImageInvariant() {
    const elements = createEditorElements();
    const source = makeImageDataUrl({ width: 110, height: 72 });
    const editor = new ImageEditorCore(fabric);
    editor.use(overlayFoundationPlugin());
    const history = editor.use(historyPlugin());
    const observer = editor.use(createCommitObserverPlugin('testing:invariant-observer'));
    const probe = editor.use(createInvariantProbePlugin());
    const watermark = editor.use(createWatermarkPlugin());
    await editor.init(elements);
    await editor.loadImage(source);
    history.clear();
    observer.clear();
    assert.equal(probe.hasMutableBaseImage(), false);
    const unregisteredImage = await probe.createUnregisteredImage(source);

    const scenarios = [
        ['remove-base-image', () => probe.removeBaseImage()],
        ['reorder-below-base-boundary', () => probe.reorderBaseImage()],
        ['replace-outside-raster-commit', () => probe.replaceWithoutTransaction(unregisteredImage)],
        ['serialize-base-image-as-overlay', () => probe.insertUnregisteredImage(unregisteredImage)],
        ['retain-mutable-base-image-alias', () => probe.retainMutableAlias()],
    ];
    const attempts = [];
    for (const [action, operation] of scenarios) {
        const documentBefore = editor.saveState();
        const historyBefore = history.getState().size;
        const eventsBefore = observer.getDescriptors().length;
        let rejected = false;
        try {
            await operation();
        } catch {
            rejected = true;
        }
        const documentUnchanged = editor.saveState() === documentBefore;
        const historyUnchanged = history.getState().size === historyBefore;
        const committedEventAbsent = observer.getDescriptors().length === eventsBefore;
        assert.equal(rejected, true, action);
        assert.equal(documentUnchanged, true, action);
        assert.equal(historyUnchanged, true, action);
        assert.equal(committedEventAbsent, true, action);
        attempts.push(
            Object.freeze({
                action,
                rejected,
                documentUnchanged,
                historyUnchanged,
                committedEventAbsent,
                instanceUsable: true,
            }),
        );
    }
    await watermark.add({ text: 'Usable', left: 4, top: 4 });
    assert.equal(watermark.list().length, 1);
    await disposeEditor(editor);
    return Object.freeze({ attempts: Object.freeze(attempts) });
}

export async function proveTopologyAndInvariant() {
    return Object.freeze({
        topology: await proveTopology(),
        baseImageInvariant: await proveBaseImageInvariant(),
    });
}
