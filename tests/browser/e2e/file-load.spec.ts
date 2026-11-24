import { expect, test } from '@playwright/test';
import path from 'node:path';

import type { ImageEditorCore } from '../../../src/core/index.js';

const root = path.resolve(import.meta.dirname, '../../..');

test('a late file read cannot replace the last selected file in exported pixels', async ({
    page,
}) => {
    await page.setContent('<canvas id="editor"></canvas>');
    await page.addScriptTag({ path: path.join(root, 'node_modules/fabric/dist/index.min.js') });
    await page.addScriptTag({ path: path.join(root, 'dist/umd/image-editor.full.umd.min.js') });

    const result = await page.evaluate(async () => {
        const host = window as unknown as {
            fabric: ConstructorParameters<typeof ImageEditorCore>[0];
            ImageEditorFull: { ImageEditorCore: typeof ImageEditorCore };
        };
        const editor = new host.ImageEditorFull.ImageEditorCore(host.fabric);
        await editor.init({ canvas: 'editor' });

        const read = FileReader.prototype.readAsDataURL;
        try {
            const sample = document.createElement('canvas');
            sample.width = sample.height = 16;
            const ctx = sample.getContext('2d')!;
            async function makeFile(color: string) {
                ctx.fillStyle = color;
                ctx.fillRect(0, 0, 16, 16);
                const bytes = await (await fetch(sample.toDataURL())).blob();
                return new File([bytes], 'sample.png', { type: 'image/png' });
            }
            const first = await makeFile('red');
            const last = await makeFile('blue');
            let finishFirstRead: (() => void) | undefined;
            FileReader.prototype.readAsDataURL = function (blob) {
                if (blob === first) finishFirstRead = () => read.call(this, blob);
                else read.call(this, blob);
            };

            const firstResult = editor.loadImageFile(first).then(
                () => 'completed',
                (error: unknown) =>
                    error instanceof DOMException ? error.name : 'unexpected error',
            );
            await editor.loadImageFile(last);
            finishFirstRead!();
            const firstOutcome = await firstResult;
            const output = new Image();
            output.src = await editor.exportImageBase64({ area: 'image', format: 'png' });
            await output.decode();
            ctx.drawImage(output, 0, 0);
            return { firstOutcome, pixel: Array.from(ctx.getImageData(8, 8, 1, 1).data) };
        } finally {
            FileReader.prototype.readAsDataURL = read;
            await editor.disposeAsync();
        }
    });
    expect(result).toEqual({ firstOutcome: 'AbortError', pixel: [0, 0, 255, 255] });
});
