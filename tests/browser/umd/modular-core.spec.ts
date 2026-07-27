/**
 * Verifies the modular Core UMD global and its public Plugin SDK boundary.
 *
 * @module
 */

import { expect, test } from '@playwright/test';
import path from 'node:path';

import type * as CoreUmd from '../../../src/umd/core.js';
import type { FabricModule } from '../../../src/core/index.js';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');
const fabricUmd = path.join(repositoryRoot, 'node_modules/fabric/dist/index.min.js');
const coreUmd = path.join(repositoryRoot, 'dist/umd/image-editor.core.umd.min.js');

test('modular Core UMD exposes Core and SDK without Feature globals', async ({ page }) => {
    await page.addScriptTag({ path: fabricUmd });
    await page.addScriptTag({ path: coreUmd });

    const result = await page.evaluate(async () => {
        const browser = window as unknown as typeof window & {
            fabric: FabricModule;
            ImageEditor: typeof CoreUmd;
            ImageEditorPlugins?: unknown;
        };
        const api = browser.ImageEditor;
        const editor = new api.ImageEditorCore(browser.fabric);
        const values = {
            core: typeof api.ImageEditorCore,
            composePlugins: typeof api.composePlugins,
            definePlugin: typeof api.definePlugin,
            definePluginRef: typeof api.definePluginRef,
            createCapabilityToken: typeof api.createCapabilityToken,
            instance: editor instanceof api.ImageEditorCore,
            pluginNamespaceAbsent: browser.ImageEditorPlugins === undefined,
        };
        await editor.disposeAsync();
        return values;
    });

    expect(result).toEqual({
        core: 'function',
        composePlugins: 'function',
        definePlugin: 'function',
        definePluginRef: 'function',
        createCapabilityToken: 'function',
        instance: true,
        pluginNamespaceAbsent: true,
    });
});
