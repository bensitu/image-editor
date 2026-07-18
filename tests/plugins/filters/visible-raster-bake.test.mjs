import assert from 'node:assert/strict';
import test from 'node:test';

import { ImageEditorCore } from '../../../src/core/index.js';
import { filtersPlugin } from '../../../src/plugins/filters/index.js';
import { historyPlugin } from '../../../src/plugins/history/index.js';
import {
    DOCUMENT_MUTATION_CAPABILITY,
    VISIBLE_RASTER_BAKE_CAPABILITY,
    definePlugin,
    definePluginRef,
} from '../../../src/sdk/index.js';
import { fabric, makeImageDataUrl, resetEditorDom } from '../../helpers/fabric-environment.mjs';

const parentOperationId = 'example:prepare-visible-raster';
const mutationDomains = ['document', 'base-image', 'geometry', 'raster', 'overlay', 'state'];

function installCommittedEventObserver(editor, id) {
    const ref = definePluginRef(id, '1.0.0');
    return editor.use(
        definePlugin({
            ref,
            manifest: {
                id: ref.id,
                version: '1.0.0',
                apiVersion: ref.apiVersion,
                engine: '^3.0.0',
            },
            setupMode: 'sync',
            setup(context) {
                const events = [];
                context.disposables.add(
                    context.events.on('document:committed', (descriptor) =>
                        events.push(descriptor),
                    ),
                );
                return Object.freeze({ events });
            },
        }),
    );
}

function installBakeProbe(editor, id) {
    const ref = definePluginRef(id, '1.0.0');
    let sequence = 0;
    return editor.use(
        definePlugin({
            ref,
            manifest: {
                id: ref.id,
                version: '1.0.0',
                apiVersion: ref.apiVersion,
                engine: '^3.0.0',
                requires: [{ token: DOCUMENT_MUTATION_CAPABILITY, range: '^1.0.0' }],
                optional: [{ token: VISIBLE_RASTER_BAKE_CAPABILITY, range: '^1.0.0' }],
            },
            setupMode: 'sync',
            setup(context) {
                const mutations = context.capabilities.require(DOCUMENT_MUTATION_CAPABILITY);
                const bake = context.capabilities.optional(VISIBLE_RASTER_BAKE_CAPABILITY);
                const status = context.capabilities.getOptionalStatus(
                    VISIBLE_RASTER_BAKE_CAPABILITY,
                );
                context.disposables.add(
                    context.operations.register({
                        id: parentOperationId,
                        mode: 'mutation',
                        conflictDomains: mutationDomains,
                        reentrancy: 'queue',
                    }),
                );
                return Object.freeze({
                    status,
                    hasVisibleState: () => bake?.hasVisibleState() ?? false,
                    run: (options = {}) =>
                        mutations.run({
                            id: `${parentOperationId}:${++sequence}`,
                            kind: 'compound',
                            operationId: parentOperationId,
                            conflictDomains: mutationDomains,
                            mutate: async (parent) => {
                                const result = bake
                                    ? await bake.bakeIntoBase(parent, options.bake)
                                    : Object.freeze({ didBake: false, mimeType: null });
                                if (options.failAfterBake) {
                                    throw new Error('synthetic parent mutation failure');
                                }
                                return result;
                            },
                            describeCommit: (result) => result,
                        }),
                });
            },
        }),
    );
}

async function createEditor({ filters = true, id }) {
    const elementIds = resetEditorDom({ containerWidth: 320, containerHeight: 240 });
    const editor = new ImageEditorCore(fabric, { canvasWidth: 320, canvasHeight: 240 });
    const history = editor.use(historyPlugin());
    const filtersApi = filters ? editor.use(filtersPlugin()) : null;
    const probe = installBakeProbe(editor, `example:${id}-probe`);
    const observer = installCommittedEventObserver(editor, `example:${id}-observer`);
    await editor.init({
        canvas: elementIds.canvas,
        canvasContainer: elementIds.canvasContainer,
    });
    await editor.loadImage(makeImageDataUrl({ width: 96, height: 64 }));
    return { editor, filtersApi, history, observer, probe };
}

async function dispose(editor) {
    await editor.disposeAsync();
    document.body.innerHTML = '';
}

test('optional visible-raster bake is absent-safe and no-ops without committed Filters', async (t) => {
    await t.test('provider absent', async () => {
        const { editor, probe } = await createEditor({ filters: false, id: 'bake-absent' });
        assert.equal(probe.status, 'missing');
        assert.equal(probe.hasVisibleState(), false);
        assert.deepEqual(await probe.run(), { didBake: false, mimeType: null });
        await dispose(editor);
    });

    await t.test('provider present without visible state', async () => {
        const { editor, probe } = await createEditor({ id: 'bake-empty' });
        const baseImage = editor.getCanvas().getObjects()[0];
        assert.equal(probe.status, 'available');
        assert.equal(probe.hasVisibleState(), false);
        assert.deepEqual(await probe.run(), { didBake: false, mimeType: 'image/png' });
        assert.equal(editor.getCanvas().getObjects()[0], baseImage);
        await dispose(editor);
    });
});

test('visible-raster bake joins one parent History and committed-event boundary', async () => {
    const { editor, filtersApi, history, observer, probe } = await createEditor({
        id: 'bake-parent',
    });
    await filtersApi.commit([{ type: 'grayscale' }]);
    history.clear();
    observer.events.length = 0;

    assert.equal(probe.hasVisibleState(), true);
    assert.deepEqual(await probe.run(), { didBake: true, mimeType: 'image/png' });

    assert.deepEqual(filtersApi.getState().filters, []);
    assert.equal(history.length, 1);
    assert.equal(observer.events.length, 1);
    assert.equal(observer.events[0].operationId, parentOperationId);
    assert.equal(
        observer.events.some((descriptor) => descriptor.operationId === 'filters:bake'),
        false,
    );
    await dispose(editor);
});

test('visible-raster bake failures and parent rollback restore Raster and Filters state', async (t) => {
    await t.test('provider failure', async () => {
        const { editor, filtersApi, history, observer, probe } = await createEditor({
            id: 'bake-provider-failure',
        });
        await filtersApi.commit([{ type: 'contrast', value: 0.4 }]);
        history.clear();
        observer.events.length = 0;
        const beforeState = filtersApi.getState();
        const beforeExport = await editor.exportImageBase64({ format: 'png' });
        const baseImage = editor.getCanvas().getObjects()[0];
        baseImage.clone = async () => {
            throw new Error('synthetic visible-raster provider failure');
        };

        await assert.rejects(probe.run(), /synthetic visible-raster provider failure/);
        assert.deepEqual(filtersApi.getState(), beforeState);
        assert.equal(await editor.exportImageBase64({ format: 'png' }), beforeExport);
        assert.equal(history.length, 0);
        assert.equal(observer.events.length, 0);
        await dispose(editor);
    });

    await t.test('parent failure after provider success', async () => {
        const { editor, filtersApi, history, observer, probe } = await createEditor({
            id: 'bake-parent-failure',
        });
        await filtersApi.commit([{ type: 'sepia' }]);
        history.clear();
        observer.events.length = 0;
        const beforeState = filtersApi.getState();
        const beforeExport = await editor.exportImageBase64({ format: 'png' });

        await assert.rejects(
            probe.run({ failAfterBake: true }),
            /synthetic parent mutation failure/,
        );
        assert.deepEqual(filtersApi.getState(), beforeState);
        assert.equal(await editor.exportImageBase64({ format: 'png' }), beforeExport);
        assert.equal(history.length, 0);
        assert.equal(observer.events.length, 0);
        await dispose(editor);
    });
});
