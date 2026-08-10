/**
 * Verifies modular Plugin UMD composition, shared runtime identity, and dependency failures.
 *
 * @module
 */

import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

import type { FabricModule } from '../../../src/core/index.js';
import type * as AnnotationUmd from '../../../src/foundations/annotation/index.js';
import type * as OverlayUmd from '../../../src/foundations/overlay/index.js';
import type * as AnnotationDrawUmd from '../../../src/plugins/annotation-draw/index.js';
import type * as AnnotationShapeUmd from '../../../src/plugins/annotation-shape/index.js';
import type * as AnnotationTextUmd from '../../../src/plugins/annotation-text/index.js';
import type * as CanvasInteractionsUmd from '../../../src/plugins/canvas-interactions/index.js';
import type * as CropUmd from '../../../src/plugins/crop/index.js';
import type * as DomControlsUmd from '../../../src/plugins/dom-controls/index.js';
import type * as FiltersUmd from '../../../src/plugins/filters/index.js';
import type * as HistoryUmd from '../../../src/plugins/history/index.js';
import type * as MaskUmd from '../../../src/plugins/mask/index.js';
import type * as MosaicUmd from '../../../src/plugins/mosaic/index.js';
import type * as OverlayStateUmd from '../../../src/plugins/overlay-state/index.js';
import type * as TransformUmd from '../../../src/plugins/transform/index.js';
import type * as CoreUmd from '../../../src/umd/core.js';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');
const fabricUmd = path.join(repositoryRoot, 'node_modules/fabric/dist/index.min.js');
const coreUmd = path.join(repositoryRoot, 'dist/umd/image-editor.core.umd.min.js');

const pluginUmd = (id: string): string =>
    path.join(repositoryRoot, `dist/umd/plugins/image-editor.plugin.${id}.umd.min.js`);

interface ModularPluginGlobals {
    readonly Overlay: typeof OverlayUmd;
    readonly Annotation: typeof AnnotationUmd;
    readonly Transform: typeof TransformUmd;
    readonly History: typeof HistoryUmd;
    readonly Mask: typeof MaskUmd;
    readonly Filters: typeof FiltersUmd;
    readonly Crop: typeof CropUmd;
    readonly Mosaic: typeof MosaicUmd;
    readonly AnnotationText: typeof AnnotationTextUmd;
    readonly AnnotationShape: typeof AnnotationShapeUmd;
    readonly AnnotationDraw: typeof AnnotationDrawUmd;
    readonly OverlayState: typeof OverlayStateUmd;
    readonly DomControls: typeof DomControlsUmd;
    readonly CanvasInteractions: typeof CanvasInteractionsUmd;
}

type ModularBrowser = typeof window & {
    readonly fabric: FabricModule;
    readonly ImageEditor: typeof CoreUmd;
    readonly ImageEditorPlugins: ModularPluginGlobals;
};

async function prepareEditorPage(page: Page): Promise<void> {
    await page.setContent(`
        <main>
            <div id="canvas-container" style="width:320px;height:240px">
                <canvas id="editor-canvas"></canvas>
            </div>
        </main>
    `);
}

async function loadCore(page: Page): Promise<void> {
    await page.addScriptTag({ path: fabricUmd });
    await page.addScriptTag({ path: coreUmd });
}

async function loadPlugins(page: Page, pluginIds: readonly string[]): Promise<void> {
    for (const pluginId of pluginIds) {
        await page.addScriptTag({ path: pluginUmd(pluginId) });
    }
}

test('Core, Transform, and History form a complete minimal editor', async ({ page }) => {
    await prepareEditorPage(page);
    await loadCore(page);
    await loadPlugins(page, ['transform', 'history']);

    const result = await page.evaluate(async () => {
        const browser = window as ModularBrowser;
        const core = browser.ImageEditor;
        const plugins = browser.ImageEditorPlugins;
        const editor = new core.ImageEditorCore(browser.fabric);
        const apis = editor.install(
            core.composePlugins({
                transform: plugins.Transform.transformPlugin({ animationDuration: 0 }),
                history: plugins.History.historyPlugin(),
            }),
        );
        await editor.init({
            canvas: 'editor-canvas',
            canvasContainer: 'canvas-container',
        });
        const image = document.createElement('canvas');
        image.width = 120;
        image.height = 80;
        image.getContext('2d')?.fillRect(0, 0, image.width, image.height);
        await editor.loadImage(image.toDataURL('image/png'));

        await apis.transform.rotate(90);
        const edited = apis.transform.getState().rotationDegrees;
        await apis.history.undo();
        const undone = apis.transform.getState().rotationDegrees;
        await apis.history.redo();
        const redone = apis.transform.getState().rotationDegrees;
        const exported = await editor.exportImageBase64({ format: 'png' });
        const beforeFailure = editor.saveState();
        let rejected = false;
        try {
            await editor.loadFromState({ schemaVersion: 3, document: null });
        } catch {
            rejected = true;
        }
        const rolledBack = editor.saveState() === beforeFailure;
        const instance = editor instanceof core.ImageEditorCore;
        await editor.disposeAsync();
        return {
            transformFactory: typeof plugins.Transform.transformPlugin,
            historyFactory: typeof plugins.History.historyPlugin,
            edited,
            undone,
            redone,
            exported: exported.startsWith('data:image/png;base64,'),
            rejected,
            rolledBack,
            instance,
            unrelatedModulesAbsent:
                !('Mask' in plugins) && !('Annotation' in plugins) && !('Crop' in plugins),
        };
    });

    expect(result).toEqual({
        transformFactory: 'function',
        historyFactory: 'function',
        edited: 90,
        undone: 0,
        redone: 90,
        exported: true,
        rejected: true,
        rolledBack: true,
        instance: true,
        unrelatedModulesAbsent: true,
    });
});

test('Overlay and Mask share Plugin Ref and Capability identities', async ({ page }) => {
    await prepareEditorPage(page);
    await loadCore(page);
    await loadPlugins(page, ['overlay', 'mask']);

    const result = await page.evaluate(async () => {
        const browser = window as ModularBrowser;
        const core = browser.ImageEditor;
        const plugins = browser.ImageEditorPlugins;
        const editor = new core.ImageEditorCore(browser.fabric);
        const apis = editor.install(
            core.composePlugins({
                overlay: plugins.Overlay.overlayFoundationPlugin(),
                mask: plugins.Mask.maskPlugin({ label: false }),
            }),
        );
        await editor.init({
            canvas: 'editor-canvas',
            canvasContainer: 'canvas-container',
        });
        const image = document.createElement('canvas');
        image.width = 160;
        image.height = 100;
        await editor.loadImage(image.toDataURL('image/png'));
        const mask = await apis.mask.create({ left: 24, top: 18, width: 40, height: 30 });
        const created = apis.mask.getAll().length;
        await apis.mask.remove(mask.maskUid);
        const removed = apis.mask.getAll().length;
        const overlayIdentity =
            editor.getPlugin(plugins.Overlay.overlayFoundationRef) === apis.overlay;
        const maskIdentity = editor.getPlugin(plugins.Mask.maskPluginRef) === apis.mask;
        await editor.disposeAsync();
        return {
            created,
            removed,
            overlayIdentity,
            maskIdentity,
            unrelatedModulesAbsent: !('Annotation' in plugins) && !('Transform' in plugins),
        };
    });

    expect(result).toEqual({
        created: 1,
        removed: 0,
        overlayIdentity: true,
        maskIdentity: true,
        unrelatedModulesAbsent: true,
    });
});

test('Annotation Foundation and Feature modules coexist without namespace replacement', async ({
    page,
}) => {
    await prepareEditorPage(page);
    await loadCore(page);
    await loadPlugins(page, ['overlay']);
    await page.evaluate(() => {
        const browser = window as ModularBrowser & {
            __overlayModuleBefore?: typeof OverlayUmd;
        };
        browser.__overlayModuleBefore = browser.ImageEditorPlugins.Overlay;
    });
    await loadPlugins(page, [
        'annotation',
        'annotation-text',
        'annotation-shape',
        'annotation-draw',
    ]);

    const result = await page.evaluate(async () => {
        const browser = window as ModularBrowser & {
            __overlayModuleBefore?: typeof OverlayUmd;
        };
        const core = browser.ImageEditor;
        const plugins = browser.ImageEditorPlugins;
        const editor = new core.ImageEditorCore(browser.fabric);
        const apis = editor.install(
            core.composePlugins({
                overlay: plugins.Overlay.overlayFoundationPlugin(),
                annotation: plugins.Annotation.annotationFoundationPlugin(),
                text: plugins.AnnotationText.textAnnotationPlugin(),
                shape: plugins.AnnotationShape.shapeAnnotationPlugin(),
                draw: plugins.AnnotationDraw.drawAnnotationPlugin(),
            }),
        );
        await editor.init({
            canvas: 'editor-canvas',
            canvasContainer: 'canvas-container',
        });
        const image = document.createElement('canvas');
        image.width = 180;
        image.height = 120;
        await editor.loadImage(image.toDataURL('image/png'));
        const textId = await apis.text.create({ text: 'Modular UMD', left: 20, top: 16 });
        const annotationIdentity =
            editor.getPlugin(plugins.Annotation.annotationFoundationRef) === apis.annotation;
        await editor.disposeAsync();
        return {
            textCreated: typeof textId === 'string',
            annotationIdentity,
            overlayPreserved: browser.__overlayModuleBefore === plugins.Overlay,
            globals: [
                typeof plugins.Overlay.overlayFoundationPlugin,
                typeof plugins.Annotation.annotationFoundationPlugin,
                typeof plugins.AnnotationText.textAnnotationPlugin,
                typeof plugins.AnnotationShape.shapeAnnotationPlugin,
                typeof plugins.AnnotationDraw.drawAnnotationPlugin,
            ],
        };
    });

    expect(result).toEqual({
        textCreated: true,
        annotationIdentity: true,
        overlayPreserved: true,
        globals: ['function', 'function', 'function', 'function', 'function'],
    });
});

test('selected modular Plugins install as one explicit composition', async ({ page }) => {
    await prepareEditorPage(page);
    await loadCore(page);
    await loadPlugins(page, [
        'overlay',
        'annotation',
        'transform',
        'history',
        'mask',
        'filters',
        'crop',
        'mosaic',
        'annotation-text',
        'annotation-shape',
        'annotation-draw',
        'overlay-state',
        'dom-controls',
        'canvas-interactions',
    ]);

    const result = await page.evaluate(async () => {
        const browser = window as ModularBrowser;
        const core = browser.ImageEditor;
        const plugins = browser.ImageEditorPlugins;
        const editor = new core.ImageEditorCore(browser.fabric);
        const bind = <TApi>(ref: CoreUmd.PluginRef<TApi>) => ({
            ref,
            resolve: () => editor.requirePlugin(ref),
        });
        const apis = editor.install(
            core.composePlugins({
                transform: plugins.Transform.transformPlugin({ animationDuration: 0 }),
                history: plugins.History.historyPlugin(),
                overlay: plugins.Overlay.overlayFoundationPlugin(),
                mask: plugins.Mask.maskPlugin({ label: false }),
                filters: plugins.Filters.filtersPlugin(),
                crop: plugins.Crop.cropPlugin(),
                mosaic: plugins.Mosaic.mosaicPlugin(),
                annotation: plugins.Annotation.annotationFoundationPlugin(),
                text: plugins.AnnotationText.textAnnotationPlugin(),
                shape: plugins.AnnotationShape.shapeAnnotationPlugin(),
                draw: plugins.AnnotationDraw.drawAnnotationPlugin(),
                overlayState: plugins.OverlayState.overlayStatePlugin(),
                domControls: plugins.DomControls.domControlsPlugin(),
                canvasInteractions: plugins.CanvasInteractions.canvasInteractionsPlugin({
                    text: {
                        plugin: bind(plugins.AnnotationText.textAnnotationPluginRef),
                        overlays: bind(plugins.Overlay.overlayFoundationRef),
                        annotations: bind(plugins.Annotation.annotationFoundationRef),
                    },
                }),
            }),
        );
        await editor.init({
            canvas: 'editor-canvas',
            canvasContainer: 'canvas-container',
        });
        const image = document.createElement('canvas');
        image.width = 200;
        image.height = 140;
        await editor.loadImage(image.toDataURL('image/png'));
        await apis.transform.rotate(90);
        await apis.mask.create({ left: 30, top: 24, width: 36, height: 24 });
        await apis.text.create({ text: 'All modules', left: 18, top: 14 });
        const exported = await editor.exportImageBase64({ format: 'png' });
        const identityChecks = [
            editor.getPlugin(plugins.Transform.transformPluginRef) === apis.transform,
            editor.getPlugin(plugins.History.historyPluginRef) === apis.history,
            editor.getPlugin(plugins.Overlay.overlayFoundationRef) === apis.overlay,
            editor.getPlugin(plugins.Mask.maskPluginRef) === apis.mask,
            editor.getPlugin(plugins.Annotation.annotationFoundationRef) === apis.annotation,
            editor.getPlugin(plugins.OverlayState.overlayStatePluginRef) === apis.overlayState,
            editor.getPlugin(plugins.CanvasInteractions.canvasInteractionsPluginRef) ===
                apis.canvasInteractions,
        ];
        const domStatus = apis.domControls.getStatus();
        const canvasStatus = apis.canvasInteractions.getStatus();
        await editor.disposeAsync();
        return {
            identityChecks,
            exported: exported.startsWith('data:image/png;base64,'),
            domReady: typeof domStatus === 'object' && domStatus !== null,
            canvasBound: canvasStatus.isBound,
        };
    });

    expect(result).toEqual({
        identityChecks: [true, true, true, true, true, true, true],
        exported: true,
        domReady: true,
        canvasBound: true,
    });
});

test('missing modular dependencies fail instead of creating a damaged module', async ({ page }) => {
    await page.addScriptTag({ path: fabricUmd });
    const missingCoreError = page.waitForEvent('pageerror');
    await page.addScriptTag({ path: pluginUmd('transform') });
    expect((await missingCoreError).message).toContain('undefined');

    await page.goto('about:blank');
    await loadCore(page);
    await loadPlugins(page, ['mask']);
    const missingOverlay = await page.evaluate(() => {
        const browser = window as ModularBrowser;
        try {
            browser.ImageEditorPlugins.Mask.maskPlugin();
            return null;
        } catch (error) {
            return error instanceof Error ? error.message : String(error);
        }
    });
    expect(missingOverlay).toContain('undefined');

    await page.goto('about:blank');
    await loadCore(page);
    await loadPlugins(page, ['overlay', 'annotation-text']);
    const missingAnnotation = await page.evaluate(() => {
        const browser = window as ModularBrowser;
        try {
            browser.ImageEditorPlugins.AnnotationText.textAnnotationPlugin();
            return null;
        } catch (error) {
            return error instanceof Error ? error.message : String(error);
        }
    });
    expect(missingAnnotation).toContain('undefined');
});

test('reloading a Plugin UMD preserves existing module identities', async ({ page }) => {
    await loadCore(page);
    await loadPlugins(page, ['transform', 'history']);
    await page.evaluate(() => {
        const browser = window as ModularBrowser & {
            __transformFactoryBefore?: typeof TransformUmd.transformPlugin;
            __transformRefBefore?: typeof TransformUmd.transformPluginRef;
            __historyModuleBefore?: typeof HistoryUmd;
        };
        browser.__transformFactoryBefore = browser.ImageEditorPlugins.Transform.transformPlugin;
        browser.__transformRefBefore = browser.ImageEditorPlugins.Transform.transformPluginRef;
        browser.__historyModuleBefore = browser.ImageEditorPlugins.History;
    });
    await loadPlugins(page, ['transform']);

    const result = await page.evaluate(() => {
        const browser = window as ModularBrowser & {
            __transformFactoryBefore?: typeof TransformUmd.transformPlugin;
            __transformRefBefore?: typeof TransformUmd.transformPluginRef;
            __historyModuleBefore?: typeof HistoryUmd;
        };
        return {
            factory:
                browser.__transformFactoryBefore ===
                browser.ImageEditorPlugins.Transform.transformPlugin,
            ref:
                browser.__transformRefBefore ===
                browser.ImageEditorPlugins.Transform.transformPluginRef,
            sibling: browser.__historyModuleBefore === browser.ImageEditorPlugins.History,
        };
    });

    expect(result).toEqual({ factory: true, ref: true, sibling: true });
});
