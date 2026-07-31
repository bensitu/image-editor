/**
 * Verifies that each current documentation demo loads and installs its focused modular UMD plan.
 *
 * CDN requests are fulfilled with the repository build so the browser test remains deterministic.
 *
 * @module
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

interface DemoBrowser extends Window {
    readonly ImageEditor?: {
        readonly ImageEditorCore?: unknown;
        readonly composePlugins?: unknown;
    };
    readonly ImageEditorFull?: unknown;
    readonly ImageEditorPlugins?: Readonly<Record<string, unknown>>;
}

const repositoryRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const fabricCdnUrl = 'https://cdn.jsdelivr.net/npm/fabric@7.4.0/dist/index.min.js';
const imageEditorCdnBase = 'https://cdn.jsdelivr.net/npm/@bensitu/image-editor@latest/dist/umd';
const imageEditorCdnRequest =
    /^https:\/\/cdn\.jsdelivr\.net\/npm\/@bensitu\/image-editor@latest\/dist\/umd\/.+\.js$/u;

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

test.beforeEach(async ({ page }) => {
    await page.route(fabricCdnUrl, async (route) => {
        await route.fulfill({
            path: resolve(repositoryRoot, 'node_modules/fabric/dist/index.min.js'),
            contentType: 'text/javascript; charset=utf-8',
        });
    });
    await page.route(imageEditorCdnRequest, async (route) => {
        const pathname = new URL(route.request().url()).pathname;
        const relativePath = pathname.split('/dist/umd/')[1];
        if (!relativePath || relativePath.split('/').includes('..')) {
            await route.abort('blockedbyclient');
            return;
        }
        await route.fulfill({
            path: resolve(repositoryRoot, 'dist/umd', ...relativePath.split('/')),
            contentType: 'text/javascript; charset=utf-8',
        });
    });
});

for (const plan of demoPlans) {
    test(`${plan.name} demo uses its focused modular UMD plan`, async ({ page }) => {
        const pageErrors: string[] = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));

        const response = await page.goto(plan.path);
        expect(response?.ok()).toBe(true);
        await expect.poll(() => page.locator('body').getAttribute('data-demo-ready')).toBe('true');

        const result = await page.evaluate((cdnBase) => {
            const browser = window as unknown as DemoBrowser;
            const imageEditorScripts = Array.from(document.scripts)
                .map((script) => script.src)
                .filter((src) => src.startsWith(`${cdnBase}/`));
            return {
                pluginGlobals: Object.keys(browser.ImageEditorPlugins ?? {}).sort(),
                coreAvailable:
                    typeof browser.ImageEditor?.ImageEditorCore === 'function' &&
                    typeof browser.ImageEditor?.composePlugins === 'function',
                fullAbsent: browser.ImageEditorFull === undefined,
                hasDemoError: document.body.dataset.demoError === 'true',
                imageEditorScripts,
            };
        }, imageEditorCdnBase);

        expect(result.pluginGlobals).toEqual(plan.globals);
        expect(result.coreAvailable).toBe(true);
        expect(result.fullAbsent).toBe(true);
        expect(result.hasDemoError).toBe(false);
        expect(result.imageEditorScripts).toEqual([
            `${imageEditorCdnBase}/image-editor.core.umd.min.js`,
            ...plan.pluginIds.map(
                (pluginId) =>
                    `${imageEditorCdnBase}/plugins/image-editor.plugin.${pluginId}.umd.min.js`,
            ),
        ]);
        expect(pageErrors).toEqual([]);
    });
}
