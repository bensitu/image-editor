/**
 * Verifies that each current documentation demo loads only its declared modular UMD plan.
 *
 * @module
 */

import { expect, test } from '@playwright/test';

interface DemoBrowser extends Window {
    readonly ImageEditor?: {
        readonly ImageEditorCore?: unknown;
        readonly composePlugins?: unknown;
    };
    readonly ImageEditorFull?: unknown;
    readonly ImageEditorPlugins?: Readonly<Record<string, unknown>>;
    readonly __imageEditorDemoRuntime?: {
        readonly pluginIds?: readonly string[];
    };
}

const demoPlans = [
    {
        name: 'landing',
        path: '/docs/index.html',
        pluginIds: [
            'overlay',
            'annotation',
            'filters',
            'mask',
            'annotation-text',
            'annotation-shape',
        ],
        globals: ['Annotation', 'AnnotationShape', 'AnnotationText', 'Filters', 'Mask', 'Overlay'],
    },
    {
        name: 'basic',
        path: '/docs/basic.html',
        pluginIds: ['overlay', 'transform', 'history', 'filters', 'crop'],
        globals: ['Crop', 'Filters', 'History', 'Overlay', 'Transform'],
    },
    {
        name: 'annotation',
        path: '/docs/annotation.html',
        pluginIds: [
            'overlay',
            'annotation',
            'history',
            'annotation-text',
            'annotation-shape',
            'annotation-draw',
        ],
        globals: [
            'Annotation',
            'AnnotationDraw',
            'AnnotationShape',
            'AnnotationText',
            'History',
            'Overlay',
        ],
    },
    {
        name: 'mask and mosaic',
        path: '/docs/mask-mosaic.html',
        pluginIds: ['overlay', 'mask', 'mosaic'],
        globals: ['Mask', 'Mosaic', 'Overlay'],
    },
    {
        name: 'integrated editor',
        path: '/docs/integrated-editor.html',
        pluginIds: [
            'overlay',
            'annotation',
            'transform',
            'history',
            'mask',
            'annotation-text',
            'annotation-shape',
            'annotation-draw',
        ],
        globals: [
            'Annotation',
            'AnnotationDraw',
            'AnnotationShape',
            'AnnotationText',
            'History',
            'Mask',
            'Overlay',
            'Transform',
        ],
    },
] as const;

for (const plan of demoPlans) {
    test(`${plan.name} demo uses its focused modular UMD plan`, async ({ page }) => {
        const pageErrors: string[] = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));

        const response = await page.goto(plan.path);
        expect(response?.ok()).toBe(true);
        await expect.poll(() => page.locator('body').getAttribute('data-demo-ready')).toBe('true');

        const result = await page.evaluate(() => {
            const browser = window as unknown as DemoBrowser;
            const imageEditorScripts = Array.from(document.scripts)
                .map((script) => script.src)
                .filter((src) => src.includes('/dist/umd/'))
                .map((src) => new URL(src).pathname);
            return {
                pluginIds: browser.__imageEditorDemoRuntime?.pluginIds ?? [],
                pluginGlobals: Object.keys(browser.ImageEditorPlugins ?? {}).sort(),
                coreAvailable:
                    typeof browser.ImageEditor?.ImageEditorCore === 'function' &&
                    typeof browser.ImageEditor?.composePlugins === 'function',
                fullAbsent: browser.ImageEditorFull === undefined,
                hasDemoError: document.body.dataset.demoError === 'true',
                imageEditorScripts,
            };
        });

        expect(result.pluginIds).toEqual(plan.pluginIds);
        expect(result.pluginGlobals).toEqual(plan.globals);
        expect(result.coreAvailable).toBe(true);
        expect(result.fullAbsent).toBe(true);
        expect(result.hasDemoError).toBe(false);
        expect(result.imageEditorScripts).toEqual([
            '/dist/umd/image-editor.core.umd.min.js',
            ...plan.pluginIds.map(
                (pluginId) => `/dist/umd/plugins/image-editor.plugin.${pluginId}.umd.min.js`,
            ),
        ]);
        expect(pageErrors).toEqual([]);
    });
}
