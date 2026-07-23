/**
 * Demonstrates direct Core and Feature Plugin composition in a browser.
 *
 * @module
 */

import * as fabric from 'fabric';
import { ImageEditorCore } from '@bensitu/image-editor/core';
import { historyPlugin } from '@bensitu/image-editor/plugins/history';
import { transformPlugin } from '@bensitu/image-editor/plugins/transform';

import './style.css';

function requireElement<TElement extends Element>(selector: string): TElement {
    const element = document.querySelector<TElement>(selector);
    if (!element) throw new Error(`Required element "${selector}" was not found.`);
    return element;
}

function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') resolve(reader.result);
            else reject(new Error('FileReader did not return a data URL.'));
        };
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read the file.'));
        reader.readAsDataURL(file);
    });
}

function describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

const canvas = requireElement<HTMLCanvasElement>('#editor-canvas');
const container = requireElement<HTMLElement>('#editor-container');
const input = requireElement<HTMLInputElement>('#image-input');
const rotateButton = requireElement<HTMLButtonElement>('#rotate');
const undoButton = requireElement<HTMLButtonElement>('#undo');
const exportButton = requireElement<HTMLButtonElement>('#export');
const status = requireElement<HTMLElement>('#status');

const editor = new ImageEditorCore(fabric, {
    defaultLayoutMode: 'fit',
    onError(error, detail) {
        console.error(detail, error);
        status.textContent = `Error: ${detail}`;
    },
});
const [transform, history] = editor.install([
    transformPlugin({ animationDuration: 0 }),
    historyPlugin({ maxSize: 30 }),
]);

let disposed = false;

async function run(action: () => Promise<unknown>): Promise<void> {
    try {
        await action();
        status.textContent = 'Ready';
    } catch (error) {
        status.textContent = `Action failed: ${describeError(error)}`;
    }
}

input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    run(async () => {
        await editor.loadImage(await readFileAsDataUrl(file));
        input.value = '';
    }).catch(console.error);
});
rotateButton.addEventListener('click', () => {
    run(() => transform.rotate(90)).catch(console.error);
});
undoButton.addEventListener('click', () => {
    run(() => history.undo()).catch(console.error);
});
exportButton.addEventListener('click', () => {
    run(async () => {
        const anchor = document.createElement('a');
        anchor.href = await editor.exportImageBase64({ format: 'png', area: 'image' });
        anchor.download = 'edited-image.png';
        anchor.click();
    }).catch(console.error);
});

window.addEventListener(
    'pagehide',
    () => {
        if (disposed) return;
        disposed = true;
        editor.disposeAsync().catch((error: unknown) => {
            console.error('Editor disposal failed.', error);
        });
    },
    { once: true },
);

void editor
    .init({ canvas, canvasContainer: container })
    .then(() => {
        status.textContent = 'Ready — choose an image.';
    })
    .catch(async (error: unknown) => {
        status.textContent = `Initialization failed: ${describeError(error)}`;
        if (!disposed) {
            disposed = true;
            await editor.disposeAsync().catch(() => undefined);
        }
    });
