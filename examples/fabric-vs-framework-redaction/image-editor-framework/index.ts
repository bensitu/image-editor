/**
 * Implements redaction behavior through the public Redaction Preset APIs.
 *
 * @module
 */

import * as fabric from 'fabric';
import { createRedactionPreset } from '@bensitu/image-editor/presets/redaction';

import type { RedactionComparisonAdapter } from '../shared-scenarios/index.js';

export async function createFrameworkRedactionAdapter(
    canvas: HTMLCanvasElement,
    container: HTMLElement,
): Promise<RedactionComparisonAdapter> {
    const preset = createRedactionPreset(fabric, {
        core: { canvasWidth: 320, canvasHeight: 240, defaultLayoutMode: 'fit' },
        transform: { animationDuration: 0 },
        history: { maxSize: 30 },
        masks: { label: false },
    });
    await preset.editor.init({ canvas, canvasContainer: container });

    return Object.freeze({
        name: 'Image Editor Framework',
        loadImage: (source: string) => preset.editor.loadImage(source),
        rotate: (degrees: number) => preset.transform.rotate(degrees),
        getRotation: () => preset.transform.getState().rotationDegrees,
        async addMask(): Promise<void> {
            await preset.masks.create({ left: 112, top: 84, width: 80, height: 48 });
        },
        getMaskCount: () => preset.masks.getAll().length,
        undo: () => preset.history.undo(),
        async snapshot(): Promise<string> {
            return preset.editor.saveState();
        },
        async verifyFailedLoadRollback(source: string): Promise<boolean> {
            const before = preset.editor.saveState();
            try {
                await preset.editor.loadImage(source);
                return false;
            } catch {
                return preset.editor.saveState() === before;
            }
        },
        dispose: () => preset.editor.disposeAsync(),
    });
}
