/**
 * Demonstrates typed DOM bindings layered over a Minimal Preset.
 *
 * @module
 */

import * as fabric from 'fabric';
import { domControlsPlugin } from '@bensitu/image-editor/plugins/dom-controls';
import { createMinimalPreset } from '@bensitu/image-editor/presets/minimal';

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
const exportButton = requireElement<HTMLButtonElement>('#export');
const message = requireElement<HTMLElement>('#message');

const preset = createMinimalPreset(fabric, {
    core: { defaultLayoutMode: 'fit' },
    transform: { animationDuration: 0 },
    history: { maxSize: 30 },
    domControls: (bindings) => {
        if (!bindings.history) throw new Error('History binding was not created.');
        return domControlsPlugin({
            ownerDocument: document,
            transform: {
                plugin: bindings.transform,
                zoomInButton: '#zoom-in',
                zoomOutButton: '#zoom-out',
                rotateRightButton: '#rotate-right',
                status: {
                    target: '#transform-status',
                    render(target, state) {
                        target.textContent = `Scale ${state.scale.toFixed(2)}, rotation ${state.rotationDegrees}°`;
                    },
                },
            },
            history: {
                plugin: bindings.history,
                undoButton: '#undo',
                redoButton: '#redo',
                status: {
                    target: '#history-status',
                    render(target, state) {
                        target.textContent = `History ${state.position}/${state.size}`;
                    },
                },
            },
            keyboard: { historyActions: true },
            onActionError(event) {
                message.textContent = `${event.action} failed: ${describeError(event.error)}`;
            },
        });
    },
});

let disposed = false;

input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    void readFileAsDataUrl(file)
        .then((source) => preset.editor.loadImage(source))
        .then(() => {
            input.value = '';
            preset.domControls.refresh();
            message.textContent = 'Image loaded.';
        })
        .catch((error: unknown) => {
            message.textContent = `Image load failed: ${describeError(error)}`;
        });
});

exportButton.addEventListener('click', () => {
    void preset.editor
        .exportImageBase64({ format: 'png', area: 'image' })
        .then((dataUrl) => {
            const anchor = document.createElement('a');
            anchor.href = dataUrl;
            anchor.download = 'edited-image.png';
            anchor.click();
        })
        .catch((error: unknown) => {
            message.textContent = `Export failed: ${describeError(error)}`;
        });
});

window.addEventListener(
    'pagehide',
    () => {
        if (disposed) return;
        disposed = true;
        void preset.editor.disposeAsync().catch((error: unknown) => {
            console.error('Editor disposal failed.', error);
        });
    },
    { once: true },
);

void preset.editor
    .init({ canvas, canvasContainer: container })
    .then(() => {
        message.textContent = 'Ready — choose an image.';
    })
    .catch(async (error: unknown) => {
        message.textContent = `Initialization failed: ${describeError(error)}`;
        if (!disposed) {
            disposed = true;
            await preset.editor.disposeAsync().catch(() => undefined);
        }
    });
