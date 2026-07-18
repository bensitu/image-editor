import assert from 'node:assert/strict';
import test from 'node:test';

import { DocumentMutationInvariantError, ImageEditorCore } from '../../src/core/index.js';
import { historyPlugin } from '../../src/plugins/history/index.js';
import {
    BASE_IMAGE_INFO_CAPABILITY,
    DOCUMENT_MUTATION_CAPABILITY,
    RASTER_MUTATION_CAPABILITY,
    definePlugin,
    definePluginRef,
} from '../../src/sdk/index.js';
import { fabric, makeImageDataUrl, resetEditorDom } from '../helpers/fabric-environment.mjs';

const rasterProbeRef = definePluginRef('testing:raster-probe', '1.0.0');

function rasterProbePlugin() {
    let sequence = 0;
    const committed = [];
    return definePlugin({
        ref: rasterProbeRef,
        manifest: {
            id: rasterProbeRef.id,
            version: '1.0.0',
            apiVersion: rasterProbeRef.apiVersion,
            engine: '^3.0.0',
            requires: [
                { token: BASE_IMAGE_INFO_CAPABILITY, range: '^1.0.0' },
                { token: DOCUMENT_MUTATION_CAPABILITY, range: '^1.0.0' },
                { token: RASTER_MUTATION_CAPABILITY, range: '^1.0.0' },
            ],
            permissions: ['core:raster-mutation'],
        },
        setupMode: 'sync',
        setup(context) {
            const imageInfo = context.capabilities.require(BASE_IMAGE_INFO_CAPABILITY);
            const mutations = context.capabilities.require(DOCUMENT_MUTATION_CAPABILITY);
            const raster = context.capabilities.require(RASTER_MUTATION_CAPABILITY);
            context.operations.register({
                id: 'testing:raster-commit',
                mode: 'mutation',
                conflictDomains: ['document', 'base-image', 'raster', 'state'],
                reentrancy: 'reject',
            });
            context.disposables.add(
                context.events.on('document:committed', (descriptor) => {
                    if (descriptor.operationId === 'testing:raster-commit') {
                        committed.push(descriptor);
                    }
                }),
            );
            return Object.freeze({
                getCommittedCount: () => committed.length,
                getImageInfo: () => imageInfo.getImageInfo(),
                replaceWithoutTransaction(image) {
                    const signal = new AbortController().signal;
                    raster.replaceBaseImage(
                        Object.freeze({
                            transactionId: 'testing:detached-raster-context',
                            parentTransactionId: null,
                            operationId: 'testing:raster-commit',
                            kind: 'raster',
                            conflictDomains: Object.freeze(['document', 'base-image', 'raster']),
                            metadata: Object.freeze({}),
                            signal,
                            addRollback: () => undefined,
                            addValidator: () => undefined,
                            reportDiagnostic: () => undefined,
                        }),
                        image,
                    );
                },
                replace(image) {
                    return mutations.run({
                        id: `testing:raster-commit:${++sequence}`,
                        kind: 'raster',
                        operationId: 'testing:raster-commit',
                        conflictDomains: ['document', 'base-image', 'raster', 'state'],
                        mutate(transaction) {
                            raster.replaceBaseImage(transaction, image, {
                                baseScale: imageInfo.getBaseImageScale(),
                            });
                        },
                    });
                },
            });
        },
    });
}

test('Raster mutation requires an active document transaction', async () => {
    const ids = resetEditorDom();
    const editor = new ImageEditorCore(fabric);
    const history = editor.use(historyPlugin());
    const raster = editor.use(rasterProbePlugin());
    await editor.init({ canvas: ids.canvas });
    const source = makeImageDataUrl({ width: 96, height: 64 });
    await editor.loadImage(source);

    const detachedReplacement = await fabric.FabricImage.fromURL(source);
    const stateBefore = editor.saveState();
    assert.throws(
        () => raster.replaceWithoutTransaction(detachedReplacement),
        DocumentMutationInvariantError,
    );
    assert.equal(editor.saveState(), stateBefore);
    assert.equal(history.getState().size, 0);
    assert.equal(raster.getCommittedCount(), 0);

    const committedReplacement = await fabric.FabricImage.fromURL(source);
    await raster.replace(committedReplacement);
    assert.equal(raster.getImageInfo()?.naturalWidth, 96);
    assert.equal(raster.getImageInfo()?.naturalHeight, 64);
    assert.equal(raster.getImageInfo()?.mimeType, 'image/png');
    assert.equal(history.getState().size, 1);
    assert.equal(raster.getCommittedCount(), 1);

    await editor.disposeAsync();
});
