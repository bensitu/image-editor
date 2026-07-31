/**
 * Verifies that each current documentation demo loads and installs its focused modular UMD plan.
 *
 * Image Editor scripts load directly from the repository build so local testing exercises dist.
 * The external Fabric request is fulfilled from node_modules to keep the test deterministic.
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
}

const fabricLocalPath = '/node_modules/fabric/dist/index.min.js';
const imageEditorLocalPathBase = '/dist/umd';

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
        const browserSecurityMessages: string[] = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));
        page.on('console', (message) => {
            if (/Content Security Policy|Tracking Prevention/iu.test(message.text())) {
                browserSecurityMessages.push(message.text());
            }
        });

        const response = await page.goto(plan.path);
        expect(response?.ok()).toBe(true);
        await expect.poll(() => page.locator('body').getAttribute('data-demo-ready')).toBe('true');

        const result = await page.evaluate(
            ({ fabricPath, localPathBase }) => {
                const browser = window as unknown as DemoBrowser;
                const scriptUrls = Array.from(document.scripts).map(
                    (script) => new URL(script.src),
                );
                const imageEditorScripts = scriptUrls
                    .map(({ pathname }) => pathname)
                    .filter((pathname) => pathname.startsWith(`${localPathBase}/`));
                return {
                    pluginGlobals: Object.keys(browser.ImageEditorPlugins ?? {}).sort(),
                    coreAvailable:
                        typeof browser.ImageEditor?.ImageEditorCore === 'function' &&
                        typeof browser.ImageEditor?.composePlugins === 'function',
                    fullAbsent: browser.ImageEditorFull === undefined,
                    hasDemoError: document.body.dataset.demoError === 'true',
                    fabricScripts: scriptUrls
                        .map(({ pathname }) => pathname)
                        .filter((pathname) => pathname === fabricPath),
                    imageEditorScripts,
                    externalScripts: scriptUrls
                        .filter(({ origin }) => origin !== window.location.origin)
                        .map(({ href }) => href),
                };
            },
            { fabricPath: fabricLocalPath, localPathBase: imageEditorLocalPathBase },
        );

        expect(result.pluginGlobals).toEqual(plan.globals);
        expect(result.coreAvailable).toBe(true);
        expect(result.fullAbsent).toBe(true);
        expect(result.hasDemoError).toBe(false);
        expect(result.fabricScripts).toEqual([fabricLocalPath]);
        expect(result.imageEditorScripts).toEqual([
            `${imageEditorLocalPathBase}/image-editor.core.umd.min.js`,
            ...plan.pluginIds.map(
                (pluginId) =>
                    `${imageEditorLocalPathBase}/plugins/image-editor.plugin.${pluginId}.umd.min.js`,
            ),
        ]);
        expect(result.externalScripts).toEqual([]);
        expect(pageErrors).toEqual([]);
        expect(browserSecurityMessages).toEqual([]);
    });
}
