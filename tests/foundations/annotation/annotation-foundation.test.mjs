import assert from 'node:assert/strict';
import test from 'node:test';

import { ImageEditorCore } from '../../../src/core/index.js';
import {
    ANNOTATION_AUTHORING_CAPABILITY,
    annotationFoundationPlugin,
    annotationFoundationRef,
} from '../../../src/foundations/annotation/index.js';
import { AnnotationController } from '../../../src/foundations/annotation/annotation-controller.js';
import { overlayFoundationPlugin } from '../../../src/foundations/overlay/index.js';
import { historyPlugin } from '../../../src/plugins/history/index.js';
import {
    FABRIC_RUNTIME_CAPABILITY,
    definePlugin,
    definePluginRef,
} from '../../../src/sdk/index.js';
import { fabric, makeImageDataUrl, resetEditorDom } from '../../helpers/fabric-environment.mjs';

const featureKind = 'annotation:test';

function testAnnotationPlugin(id = 'annotation:test-fixture') {
    const ref = definePluginRef(id, '1.0.0');
    let failUpdate = false;
    return definePlugin({
        ref,
        manifest: {
            id: ref.id,
            version: '1.0.0',
            apiVersion: ref.apiVersion,
            engine: '^3.0.0',
            requiresPlugins: [annotationFoundationRef],
            requires: [
                { token: ANNOTATION_AUTHORING_CAPABILITY, range: '^1.0.0' },
                { token: FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' },
            ],
            permissions: ['fabric:objects'],
        },
        setupMode: 'sync',
        setup(context) {
            const annotations = context.capabilities.require(ANNOTATION_AUTHORING_CAPABILITY);
            const runtime = context.capabilities.require(FABRIC_RUNTIME_CAPABILITY);
            for (const operationId of ['annotation-test:create', 'annotation-test:update']) {
                context.disposables.add(
                    context.operations.register({
                        id: operationId,
                        mode: 'mutation',
                        conflictDomains: ['document', 'overlay', 'selection', 'state'],
                        reentrancy: 'reject',
                    }),
                );
            }
            context.disposables.add(
                annotations.registerFeature({
                    kind: featureKind,
                    ownerPluginId: ref.id,
                    classify: (object) => object.type?.toLowerCase() === 'rect',
                    codec: {
                        type: 'annotation:test-rect',
                        version: '1.0.0',
                        serialize: (object) => object.toObject(),
                        validate: (value) =>
                            value !== null &&
                            typeof value === 'object' &&
                            Number.isFinite(value.left) &&
                            Number.isFinite(value.top) &&
                            Number.isFinite(value.width) &&
                            Number.isFinite(value.height),
                        deserialize: (value, serializerContext) =>
                            new serializerContext.fabric.Rect(value),
                    },
                    normalizeUpdate: (patch) => {
                        if (
                            patch === null ||
                            typeof patch !== 'object' ||
                            !Number.isFinite(patch.left)
                        ) {
                            throw new TypeError('Test Annotation update is malformed.');
                        }
                        return Object.freeze({ left: patch.left });
                    },
                    hasUpdate: (object, patch) => object.left !== patch.left,
                    applyUpdate: (object, patch) => {
                        object.set({ left: patch.left });
                        if (failUpdate) throw new Error('synthetic Annotation update failure');
                    },
                }),
            );
            return Object.freeze({
                create: (options = {}) =>
                    annotations.create({
                        kind: featureKind,
                        object: new runtime.fabric.Rect({
                            left: options.left ?? 20,
                            top: options.top ?? 18,
                            width: 24,
                            height: 16,
                            fill: options.fill ?? '#ff3366',
                        }),
                        name: options.name ?? 'Test annotation',
                        metadata: options.metadata,
                        hidden: options.hidden,
                        locked: options.locked,
                        operationId: 'annotation-test:create',
                    }),
                updateLeft: (annotationId, left) =>
                    annotations.updateFeature({
                        id: annotationId,
                        kind: featureKind,
                        patch: { left },
                        operationId: 'annotation-test:update',
                    }),
                getObject: (annotationId) => annotations.getObject(annotationId, featureKind),
                setFailUpdate: (value) => {
                    failUpdate = value;
                },
            });
        },
    });
}

async function createEditor({
    annotationOptions = {},
    feature = true,
    historyEnabled = true,
    listOrder,
} = {}) {
    const ids = resetEditorDom({ containerWidth: 320, containerHeight: 240 });
    const editor = new ImageEditorCore(fabric, { canvasWidth: 320, canvasHeight: 240 });
    const overlay = editor.use(overlayFoundationPlugin());
    const annotations = editor.use(annotationFoundationPlugin({ ...annotationOptions, listOrder }));
    const history = editor.use(historyPlugin({ enabled: historyEnabled }));
    const featureApi = feature ? editor.use(testAnnotationPlugin()) : null;
    await editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
    return { annotations, editor, featureApi, history, ids, overlay };
}

async function load(editor) {
    await editor.loadImage(makeImageDataUrl({ width: 120, height: 80 }));
}

async function dispose(editor) {
    await editor.disposeAsync();
    document.body.innerHTML = '';
}

test('Annotation Foundation requires Overlay before setup side effects', () => {
    const editor = new ImageEditorCore(fabric);
    assert.throws(
        () => editor.use(annotationFoundationPlugin()),
        /foundation\.overlay|foundation:annotation|dependency/i,
    );
});

test('Feature registration builders retain atomic cleanup and registration order', () => {
    const events = [];
    const definitions = {};
    const failure = new Error('synthetic export registration failure');
    let failExportRegistration = true;
    const disposable = (label) => ({
        dispose() {
            events.push(`dispose:${label}`);
        },
    });
    const overlay = {
        registerKind(definition) {
            events.push(`register:${definition.id}`);
            definitions.kind = definition;
            return disposable(definition.id);
        },
        registerGeometryPolicy(definition) {
            events.push(`register:${definition.id}`);
            definitions.geometry = definition;
            return disposable(definition.id);
        },
        registerExportRenderer(definition) {
            events.push(`register:${definition.id}`);
            definitions.export = definition;
            if (failExportRegistration) throw failure;
            return disposable(definition.id);
        },
        registerInteractionPolicy(definition) {
            events.push(`register:${definition.id}`);
            definitions.interaction = definition;
            return disposable(definition.id);
        },
        onSelectionChange() {
            return disposable('selection');
        },
        list() {
            return [];
        },
    };
    const host = {
        fabric,
        getCanvas: () => null,
        requireCanvas: () => {
            throw new Error('Canvas is unavailable in the registration fixture.');
        },
        requestRender: () => undefined,
        reportWarning: () => undefined,
        reportError: () => undefined,
    };
    const controller = new AnnotationController(host, overlay, { exportByDefault: false });
    const definition = {
        kind: 'annotation:builder-test',
        ownerPluginId: 'example-test:annotation-builder',
        classify: () => true,
        codec: {
            type: 'annotation:builder-test',
            version: '1.0.0',
            serialize: () => ({}),
            validate: () => true,
            deserialize: () => new fabric.Rect(),
        },
    };
    events.length = 0;

    assert.throws(() => controller.registerFeature(definition), failure);
    assert.deepEqual(events, [
        'register:annotation:builder-test',
        'register:annotation:builder-test-geometry',
        'register:annotation:builder-test-export',
        'dispose:annotation:builder-test-geometry',
        'dispose:annotation:builder-test',
    ]);

    events.length = 0;
    failExportRegistration = false;
    const registration = controller.registerFeature(definition);
    assert.deepEqual(events, [
        'register:annotation:builder-test',
        'register:annotation:builder-test-geometry',
        'register:annotation:builder-test-export',
        'register:annotation:builder-test-interaction',
    ]);
    assert.equal(definitions.kind.persistence.codec.type, definition.codec.type);
    assert.equal(definitions.kind.exportByDefault, false);
    assert.equal(definitions.geometry.kind, definition.kind);
    assert.equal(definitions.export.order, 200);
    assert.equal(definitions.interaction.kind, definition.kind);

    events.length = 0;
    registration.dispose();
    assert.deepEqual(events, [
        'dispose:annotation:builder-test-interaction',
        'dispose:annotation:builder-test-export',
        'dispose:annotation:builder-test-geometry',
        'dispose:annotation:builder-test',
    ]);
    controller.dispose();
});

test('Foundation-only installation captures and restores an empty document', async () => {
    const { annotations, editor } = await createEditor({ feature: false });
    await load(editor);
    assert.deepEqual(annotations.list(), []);
    const snapshot = editor.saveState();
    await editor.loadFromState(snapshot);
    assert.deepEqual(annotations.list(), []);
    await dispose(editor);
});

test('descriptors reuse Overlay identity and validate shared state', async () => {
    const { annotations, editor, featureApi, overlay } = await createEditor();
    await load(editor);
    const firstId = await featureApi.create({
        name: 'Review box',
        metadata: { author: 'Ada', tags: ['review'] },
    });
    const secondId = await featureApi.create({ left: 70, name: 'Second box' });
    assert.match(firstId, /^annotation:/);
    assert.equal(overlay.classify(featureApi.getObject(firstId)).persistentId, firstId);
    assert.deepEqual(annotations.get(firstId), {
        id: firstId,
        kind: featureKind,
        name: 'Review box',
        hidden: false,
        locked: false,
        selected: false,
        layerIndex: 0,
        metadata: { author: 'Ada', tags: ['review'] },
    });

    await annotations.update(firstId, {
        name: 'Reviewed box',
        metadata: { status: 'done' },
        hidden: true,
        locked: true,
    });
    assert.equal(annotations.get(firstId).hidden, true);
    assert.equal(featureApi.getObject(firstId).visible, false);
    assert.equal(featureApi.getObject(firstId).selectable, false);
    await assert.rejects(annotations.select([firstId]), /hidden or locked/i);
    await annotations.update(firstId, { hidden: false, locked: false });
    await annotations.select([firstId, secondId]);
    assert.deepEqual(overlay.getSelection().ids, [firstId, secondId]);
    await dispose(editor);
});

test('Annotation lists support front-to-back and back-to-front ordering', async () => {
    for (const [listOrder, expected] of [
        [undefined, ['second', 'first']],
        ['front-to-back', ['second', 'first']],
        ['back-to-front', ['first', 'second']],
    ]) {
        const { annotations, editor, featureApi } = await createEditor({ listOrder });
        await load(editor);
        const firstId = await featureApi.create({ name: 'First' });
        const secondId = await featureApi.create({ name: 'Second' });

        assert.deepEqual(
            annotations
                .list()
                .map(({ id }) =>
                    id === firstId ? 'first' : id === secondId ? 'second' : 'unexpected',
                ),
            expected,
        );
        await dispose(editor);
    }
});

test('removeAll preserves locked Annotations until force is explicit', async () => {
    const { annotations, editor, featureApi } = await createEditor();
    await load(editor);
    const unlockedId = await featureApi.create({ name: 'Unlocked' });
    const lockedId = await featureApi.create({ left: 72, name: 'Locked', locked: true });
    const lockedObject = featureApi.getObject(lockedId);
    const indicator = editor
        .getCanvas()
        .getObjects()
        .find((object) => object.sessionObjectType === 'annotationLockIndicator');
    assert.ok(indicator);
    const originalIndicatorLeft = indicator.left;

    await featureApi.updateLeft(lockedId, 108);
    assert.notEqual(indicator.left, originalIndicatorLeft);
    await annotations.removeAll();
    assert.equal(annotations.get(unlockedId), null);
    assert.equal(annotations.get(lockedId)?.locked, true);
    assert.equal(editor.getCanvas().getObjects().includes(lockedObject), true);

    await annotations.removeAll({ force: true });
    assert.equal(annotations.get(lockedId), null);
    assert.equal(
        editor
            .getCanvas()
            .getObjects()
            .some((object) => object.sessionObjectType === 'annotationLockIndicator'),
        false,
    );
    await dispose(editor);
});

test('Annotation presentation options customize controls, hover, and transient labels', async () => {
    const { editor, featureApi } = await createEditor({
        annotationOptions: {
            controlStyle: {
                borderColor: '#123456',
                cornerColor: '#abcdef',
                cornerSize: 14,
            },
            hoverStyle: { opacity: 0.4, stroke: '#00ff00', strokeWidth: 3 },
            label: {
                showOn: 'always',
                offset: 6,
                getText: (annotation) => `Label: ${annotation.name}`,
            },
        },
    });
    await load(editor);
    const id = await featureApi.create({ name: 'Review' });
    const object = featureApi.getObject(id);
    assert.equal(object.borderColor, '#123456');
    assert.equal(object.cornerColor, '#abcdef');
    assert.equal(object.cornerSize, 14);
    const label = editor
        .getCanvas()
        .getObjects()
        .find((candidate) => candidate.sessionObjectType === 'annotationLabel');
    assert.equal(label?.text, 'Label: Review');
    const normalStyle = {
        opacity: object.opacity,
        stroke: object.stroke,
        strokeWidth: object.strokeWidth,
    };

    object.fire('mouseover');
    assert.equal(object.opacity, 0.4);
    assert.equal(object.stroke, '#00ff00');
    assert.equal(object.strokeWidth, 3);
    object.fire('mouseout');
    assert.equal(object.opacity, normalStyle.opacity);
    assert.equal(object.stroke, normalStyle.stroke);
    assert.equal(object.strokeWidth, normalStyle.strokeWidth);
    await dispose(editor);
});

test('State round trip restores metadata, interaction, selection, and layer', async () => {
    const { annotations, editor, featureApi } = await createEditor();
    await load(editor);
    const firstId = await featureApi.create({ left: 12, name: 'First' });
    const secondId = await featureApi.create({ left: 72, name: 'Second' });
    await annotations.sendToBack(secondId);
    await annotations.update(firstId, { locked: true, metadata: { revision: 3 } });
    await annotations.select([secondId]);
    const snapshot = editor.saveState();
    await annotations.removeAll();
    await editor.loadFromState(snapshot);
    assert.deepEqual(
        annotations.list({ includeHidden: true, includeLocked: true }).map((entry) => entry.id),
        [firstId, secondId],
    );
    assert.equal(annotations.get(firstId).locked, true);
    assert.deepEqual(annotations.get(firstId).metadata, { revision: 3 });
    assert.deepEqual(
        annotations
            .list({ includeHidden: true, includeLocked: true })
            .filter((entry) => entry.selected)
            .map((entry) => entry.id),
        [secondId],
    );
    await dispose(editor);
});

test('missing Feature codecs reject restore before document mutation', async () => {
    const source = await createEditor();
    await load(source.editor);
    const id = await source.featureApi.create({ name: 'Portable' });
    const snapshot = source.editor.saveState();
    await dispose(source.editor);

    const target = await createEditor({ feature: false });
    await load(target.editor);
    await assert.rejects(target.editor.loadFromState(snapshot), /has no installed Object Codec/i);
    assert.equal(target.annotations.get(id), null);
    assert.deepEqual(target.annotations.list(), []);
    await dispose(target.editor);
});

test('changed updates produce one History record while no-op and failure produce zero', async () => {
    const { editor, featureApi, history } = await createEditor();
    await load(editor);
    const id = await featureApi.create({ left: 20 });
    history.clear();
    await featureApi.updateLeft(id, 20);
    assert.equal(history.length, 0);
    await featureApi.updateLeft(id, 44);
    assert.equal(history.length, 1);
    featureApi.setFailUpdate(true);
    await assert.rejects(featureApi.updateLeft(id, 70), /synthetic Annotation update failure/);
    assert.equal(featureApi.getObject(id).left, 44);
    assert.equal(history.length, 1);
    await dispose(editor);
});

test('export and flatten omit hidden Annotations and preserve unrelated Overlay objects', async () => {
    const { annotations, editor, featureApi, history } = await createEditor();
    await load(editor);
    const visibleId = await featureApi.create({ left: 20, fill: '#ff0000' });
    const hiddenId = await featureApi.create({ left: 70, fill: '#0000ff' });
    await annotations.update(hiddenId, { hidden: true });
    const beforeExport = editor.saveState();
    const exported = await editor.exportImageBase64({ area: 'canvas', format: 'png' });
    assert.match(exported, /^data:image\/png;base64,/);
    assert.equal(editor.saveState(), beforeExport);
    history.clear();
    await annotations.flatten();
    assert.equal(annotations.get(visibleId), null);
    assert.ok(annotations.get(hiddenId));
    assert.equal(history.length, 1);
    await annotations.flatten({ includeHidden: true });
    assert.equal(annotations.get(hiddenId), null);
    assert.equal(history.length, 2);
    await dispose(editor);
});

test('History-disabled mutations retain Core rollback and publish no timeline records', async () => {
    const { annotations, editor, featureApi, history } = await createEditor({
        historyEnabled: false,
    });
    await load(editor);
    const id = await featureApi.create();
    await annotations.update(id, { name: 'No timeline' });
    await annotations.remove(id);
    assert.equal(history.length, 0);
    assert.deepEqual(annotations.list(), []);
    await dispose(editor);
});
