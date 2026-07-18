/**
 * Verifies the Full UMD browser contract and transactional failure behavior.
 *
 * @module
 */

import { expect, test } from '@playwright/test';
import path from 'node:path';

import type { ImageEditorCore } from '../../../src/core/index.js';
import type { domControlsPlugin } from '../../../src/plugins/dom-controls/index.js';
import type { createFullPreset } from '../../../src/presets/full/index.js';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');
const fabricUmd = path.join(repositoryRoot, 'node_modules/fabric/dist/index.min.js');
const editorUmd = path.join(repositoryRoot, 'dist/umd/image-editor.full.umd.min.js');

test('script-tag Full UMD uses the supplied Fabric global and preserves rollback', async ({
    page,
}) => {
    await page.setContent(`
        <main>
            <div id="canvas-container" style="width:320px;height:240px">
                <canvas id="editor-canvas"></canvas>
            </div>
        </main>
    `);
    await page.addScriptTag({ path: fabricUmd });
    await page.addScriptTag({ path: editorUmd });

    const result = await page.evaluate(async () => {
        const browser = window as unknown as typeof window & {
            fabric: Parameters<typeof createFullPreset>[0];
            ImageEditorFull: {
                ImageEditorCore: typeof ImageEditorCore;
                createFullPreset: typeof createFullPreset;
                domControlsPlugin: typeof domControlsPlugin;
            };
        };
        const api = browser.ImageEditorFull;
        const preset = api.createFullPreset(browser.fabric, {
            transform: { animationDuration: 0 },
        });
        await preset.editor.init({
            canvas: 'editor-canvas',
            canvasContainer: 'canvas-container',
        });
        const image = document.createElement('canvas');
        image.width = 120;
        image.height = 80;
        const context = image.getContext('2d');
        if (!context) throw new Error('Canvas context is unavailable.');
        context.fillStyle = '#2764a5';
        context.fillRect(0, 0, image.width, image.height);
        await preset.editor.loadImage(image.toDataURL('image/png'));

        await preset.transform.rotate(90);
        const edited = preset.transform.getState().rotationDegrees;
        await preset.history.undo();
        const undone = preset.transform.getState().rotationDegrees;
        await preset.history.redo();
        const redone = preset.transform.getState().rotationDegrees;
        const exported = await preset.editor.exportImageBase64({ format: 'png' });
        const beforeFailure = preset.editor.saveState();
        let rejected = false;
        try {
            await preset.editor.loadFromState({ schemaVersion: 3, document: null });
        } catch {
            rejected = true;
        }
        const rolledBack = preset.editor.saveState() === beforeFailure;
        const usesPublicCore = preset.editor instanceof api.ImageEditorCore;
        const domAbsent = preset.domControls === null;
        await preset.editor.disposeAsync();

        const withDom = api.createFullPreset(browser.fabric, {
            domControls: () => api.domControlsPlugin(),
        });
        const domInstalled = typeof withDom.domControls?.getStatus === 'function';
        await withDom.editor.disposeAsync();
        return {
            globalName: typeof api.createFullPreset,
            edited,
            undone,
            redone,
            exported: exported.startsWith('data:image/png;base64,'),
            rejected,
            rolledBack,
            usesPublicCore,
            domAbsent,
            domInstalled,
            facadeAbsent: !('ImageEditor' in api),
        };
    });

    expect(result).toEqual({
        globalName: 'function',
        edited: 90,
        undone: 0,
        redone: 90,
        exported: true,
        rejected: true,
        rolledBack: true,
        usesPublicCore: true,
        domAbsent: true,
        domInstalled: true,
        facadeAbsent: true,
    });
});
