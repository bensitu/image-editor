/**
 * Implements transactional redaction state directly with Fabric primitives.
 *
 * @module
 */

import * as fabric from 'fabric';

import type { RedactionComparisonAdapter } from '../shared-scenarios/index.js';

function isImageDataUrl(source: string): boolean {
    return /^data:image\/(?:png|jpeg|webp);base64,/u.test(source);
}

export async function createPureFabricRedactionAdapter(
    canvasElement: HTMLCanvasElement,
): Promise<RedactionComparisonAdapter> {
    const canvas = new fabric.Canvas(canvasElement, {
        width: 320,
        height: 240,
        preserveObjectStacking: true,
    });
    const history: string[] = [];
    let baseImage: fabric.FabricImage | null = null;
    let disposed = false;

    const requireActive = (): void => {
        if (disposed) throw new Error('Pure Fabric adapter is disposed.');
    };
    const requireBaseImage = (): fabric.FabricImage => {
        requireActive();
        if (!baseImage) throw new Error('Load an image before editing.');
        return baseImage;
    };
    const snapshot = (): string => JSON.stringify(canvas.toJSON());
    const restore = async (state: string): Promise<void> => {
        await canvas.loadFromJSON(state);
        baseImage =
            canvas
                .getObjects()
                .find(
                    (object): object is fabric.FabricImage => object instanceof fabric.FabricImage,
                ) ?? null;
        canvas.requestRenderAll();
    };
    const record = (): void => {
        history.push(snapshot());
    };

    return Object.freeze({
        name: 'Pure Fabric',
        async loadImage(source: string): Promise<void> {
            requireActive();
            const before = snapshot();
            try {
                if (!isImageDataUrl(source)) {
                    throw new TypeError('Pure Fabric comparison accepts image data URLs only.');
                }
                const image = await fabric.FabricImage.fromURL(source);
                image.set({ left: 80, top: 60, originX: 'center', originY: 'center' });
                image.scaleToWidth(160);
                canvas.clear();
                canvas.add(image);
                baseImage = image;
                history.splice(0, history.length);
                record();
                canvas.requestRenderAll();
            } catch (error) {
                await restore(before);
                throw error;
            }
        },
        async rotate(degrees: number): Promise<void> {
            const image = requireBaseImage();
            image.rotate((Number(image.angle) + degrees) % 360);
            image.setCoords();
            record();
            canvas.requestRenderAll();
        },
        getRotation(): number {
            return Number(requireBaseImage().angle) || 0;
        },
        async addMask(): Promise<void> {
            requireBaseImage();
            canvas.add(
                new fabric.Rect({
                    left: 112,
                    top: 84,
                    width: 80,
                    height: 48,
                    fill: '#111827',
                    stroke: '#ffffff',
                    strokeWidth: 1,
                }),
            );
            record();
            canvas.requestRenderAll();
        },
        getMaskCount(): number {
            requireActive();
            return canvas.getObjects().filter((object) => object instanceof fabric.Rect).length;
        },
        async undo(): Promise<void> {
            requireActive();
            if (history.length < 2) return;
            history.pop();
            const previous = history.at(-1);
            if (!previous) throw new Error('Pure Fabric history lost its baseline.');
            await restore(previous);
        },
        async snapshot(): Promise<string> {
            requireActive();
            return snapshot();
        },
        async verifyFailedLoadRollback(source: string): Promise<boolean> {
            requireActive();
            const before = snapshot();
            try {
                await this.loadImage(source);
                return false;
            } catch {
                return snapshot() === before;
            }
        },
        async dispose(): Promise<void> {
            if (disposed) return;
            disposed = true;
            history.splice(0, history.length);
            baseImage = null;
            await canvas.dispose();
        },
    });
}
