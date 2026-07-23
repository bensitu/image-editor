import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

import {
    EditorAlreadyInitializedError,
    EditorDisposedError,
    EditorDisposingError,
    EditorFaultedError,
    EditorInitializationInProgressError,
    ImageEditorCore,
    definePluginRef,
} from '../../src/core/index.js';
import { CORE_PRESENTATION_CAPABILITY } from '../../src/sdk/index.js';
import {
    disposeEditor,
    fabric,
    makeImageDataUrl,
    resetEditorDom,
} from '../helpers/fabric-environment.mjs';

function createCore(injectedFabric = fabric) {
    const ids = resetEditorDom();
    const editor = new ImageEditorCore(injectedFabric, {
        canvasWidth: 320,
        canvasHeight: 240,
    });
    return { editor, ids };
}

function lifecycleProbePlugin(onInit) {
    return {
        ref: definePluginRef(`example-test:lifecycle-${crypto.randomUUID()}`, '1.0.0'),
        version: '1.0.0',
        setupMode: 'sync',
        setup: () => Object.freeze({}),
        onInit,
    };
}

async function readTypeScriptTree(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const sources = await Promise.all(
        entries.map(async (entry) => {
            const target = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
            if (entry.isDirectory()) return readTypeScriptTree(target);
            if (!entry.isFile() || !entry.name.endsWith('.ts')) return '';
            return readFile(target, 'utf8');
        }),
    );
    return sources.join('\n');
}

test('Core lifecycle transitions through initializing to initialized', async (t) => {
    const { editor, ids } = createCore();
    t.after(() => disposeEditor(editor));
    const observed = [];
    let nestedInitialization;
    editor.use(
        lifecycleProbePlugin(() => {
            observed.push(editor.getLifecycleState());
            nestedInitialization = editor.init({ canvas: ids.canvas });
            void nestedInitialization.catch(() => undefined);
        }),
    );

    assert.equal(editor.getLifecycleState(), 'configured');
    await editor.init({ canvas: ids.canvas });
    assert.deepEqual(observed, ['initializing']);
    await assert.rejects(nestedInitialization, EditorInitializationInProgressError);
    assert.equal(editor.getLifecycleState(), 'initialized');
});

test('recoverable init failure returns Core to configured and permits retry', async (t) => {
    const { editor, ids } = createCore();
    t.after(() => disposeEditor(editor));

    await assert.rejects(editor.init({ canvas: 'missing-canvas' }), /canvas element/i);
    assert.equal(editor.getLifecycleState(), 'configured');

    await editor.init({ canvas: ids.canvas });
    assert.equal(editor.getLifecycleState(), 'initialized');
});

test('init cleanup failure enters faulted and blocks ordinary calls', async (t) => {
    const BaseCanvas = fabric.Canvas;
    const injectedFabric = {
        ...fabric,
        Canvas: class CleanupFailingCanvas extends BaseCanvas {
            dispose() {
                throw new Error('synthetic Canvas cleanup failure');
            }
        },
    };
    const { editor, ids } = createCore(injectedFabric);
    t.after(() => {
        try {
            editor.dispose();
        } catch {
            // The test intentionally installs a Canvas whose disposal fails.
        }
    });
    editor.use(
        lifecycleProbePlugin(() => {
            throw new Error('synthetic init failure');
        }),
    );

    await assert.rejects(
        editor.init({ canvas: ids.canvas }),
        (error) => error.cause?.message === 'synthetic init failure',
    );
    assert.equal(editor.getLifecycleState(), 'faulted');
    await assert.rejects(editor.loadImage(makeImageDataUrl()), EditorFaultedError);
});

test('invalid double init uses EditorAlreadyInitializedError', async (t) => {
    const { editor, ids } = createCore();
    t.after(() => disposeEditor(editor));
    await editor.init({ canvas: ids.canvas });

    await assert.rejects(editor.init({ canvas: ids.canvas }), EditorAlreadyInitializedError);
});

test('disposing and disposed states reject init with typed errors', async () => {
    const ids = resetEditorDom();
    const BaseCanvas = fabric.Canvas;
    let releaseCanvasDispose;
    const canvasDisposeGate = new Promise((resolve) => {
        releaseCanvasDispose = resolve;
    });
    const injectedFabric = {
        ...fabric,
        Canvas: class DeferredDisposeCanvas extends BaseCanvas {
            async dispose() {
                await canvasDisposeGate;
                return super.dispose();
            }
        },
    };
    const editor = new ImageEditorCore(injectedFabric);
    await editor.init({ canvas: ids.canvas });

    const disposal = editor.disposeAsync();
    assert.equal(editor.getLifecycleState(), 'disposing');
    await assert.rejects(editor.init({ canvas: ids.canvas }), EditorDisposingError);
    releaseCanvasDispose();
    await disposal;

    assert.equal(editor.getLifecycleState(), 'disposed');
    await assert.rejects(editor.init({ canvas: ids.canvas }), EditorDisposedError);
    assert.equal(editor.disposeAsync(), editor.disposeAsync());
});

test('synchronous dispose remains disposing until asynchronous Canvas cleanup settles', async () => {
    const ids = resetEditorDom();
    const BaseCanvas = fabric.Canvas;
    let releaseCanvasDispose;
    const canvasDisposeGate = new Promise((resolve) => {
        releaseCanvasDispose = resolve;
    });
    const injectedFabric = {
        ...fabric,
        Canvas: class DeferredDisposeCanvas extends BaseCanvas {
            async dispose() {
                await canvasDisposeGate;
                return super.dispose();
            }
        },
    };
    const editor = new ImageEditorCore(injectedFabric);
    await editor.init({ canvas: ids.canvas });

    editor.dispose();
    assert.equal(editor.getLifecycleState(), 'disposing');
    const disposal = editor.disposeAsync();
    releaseCanvasDispose();
    await disposal;
    assert.equal(editor.getLifecycleState(), 'disposed');
});

test('best-effort dispose records detached cleanup failures for later inspection', async () => {
    const { editor, ids } = createCore();
    await editor.init({ canvas: ids.canvas });
    editor.snapshots.dispose = () => {
        throw new Error('synthetic detached cleanup failure');
    };

    editor.dispose();
    await assert.rejects(editor.disposeAsync(), /cleanup error/i);

    assert.ok(
        editor
            .getDiagnostics()
            .some((diagnostic) => /detached Core disposal/i.test(diagnostic.message)),
    );
});

test('asynchronous disposal aggregates synchronous cleanup failures and still completes lifecycle', async () => {
    const { editor, ids } = createCore();
    await editor.init({ canvas: ids.canvas });
    editor.snapshots.dispose = () => {
        throw new Error('synthetic Snapshot cleanup failure');
    };

    await assert.rejects(
        editor.disposeAsync(),
        (error) =>
            error.code === 'CORE_DISPOSE_ERROR' &&
            error.cause.some((cause) => cause?.message === 'synthetic Snapshot cleanup failure'),
    );
    assert.equal(editor.getLifecycleState(), 'disposed');
});

test('Core Presentation capability reads the current layout mode', () => {
    const editor = new ImageEditorCore(fabric, { defaultLayoutMode: 'fit' });
    const plugin = {
        ref: definePluginRef('example-test:presentation-probe', '1.0.0'),
        version: '1.0.0',
        setupMode: 'sync',
        requires: [{ token: CORE_PRESENTATION_CAPABILITY, range: '^1.0.0' }],
        setup(context) {
            const presentation = context.capabilities.require(CORE_PRESENTATION_CAPABILITY);
            return Object.freeze({ getLayoutMode: () => presentation.layoutMode });
        },
    };
    const probe = editor.use(plugin);

    assert.equal(probe.getLayoutMode(), 'fit');
    editor.setLayoutMode('cover');
    assert.equal(probe.getLayoutMode(), 'cover');
    assert.throws(() => editor.setLayoutMode('stretch'), TypeError);
    assert.equal(probe.getLayoutMode(), 'cover');
    editor.dispose();
});

test('root cutover keeps one Canvas and Base Image owner with no EditorRuntime constructor', async () => {
    const [coreSource, rootSource, sourceTree] = await Promise.all([
        readFile(new URL('../../src/core-runtime/image-editor-core.ts', import.meta.url), 'utf8'),
        readFile(new URL('../../src/index.ts', import.meta.url), 'utf8'),
        readTypeScriptTree(new URL('../../src/', import.meta.url)),
    ]);

    assert.equal((coreSource.match(/new\s+this\.fabric\.Canvas\s*\(/g) ?? []).length, 1);
    assert.equal((sourceTree.match(/new\s+EditorRuntime\s*\(/g) ?? []).length, 0);
    assert.equal((coreSource.match(/private\s+baseImage\s*:/g) ?? []).length, 1);
    assert.match(rootSource, /ImageEditorCore\s+as\s+ImageEditor/);
    assert.doesNotMatch(rootSource, /image-editor\.js/);
});
