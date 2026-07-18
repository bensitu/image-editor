import * as fabric from 'fabric';
import { ImageEditorCore } from '@bensitu/image-editor';
import { overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';
import { maskPlugin, type MaskPluginApi } from '@bensitu/image-editor/plugins/mask';
import {
    overlayStatePlugin,
    type OverlayStatePluginApi,
} from '@bensitu/image-editor/plugins/overlay-state';
import { createFixtureDataUrl } from '../fixtures/images';

interface OverlayStateBrowserResult {
    readonly schema: string;
    readonly version: number;
    readonly coordinateSpace: string;
    readonly kind: string;
    readonly countAfterRemoval: number;
    readonly imported: number;
    readonly skipped: number;
    readonly attributesMatch: boolean;
    readonly maxCoordinateDelta: number;
}

interface OverlayStateBrowserHarness {
    roundTrip(): Promise<OverlayStateBrowserResult>;
    dispose(): Promise<void>;
}

declare global {
    interface Window {
        __overlayStateTest: OverlayStateBrowserHarness;
    }
}

let editor: ImageEditorCore | null = null;
let masks: MaskPluginApi | null = null;
let overlayState: OverlayStatePluginApi | null = null;

async function createEditor(): Promise<void> {
    await editor?.disposeAsync();
    editor = new ImageEditorCore(fabric, { canvasWidth: 320, canvasHeight: 240 });
    const installed = editor.install([
        overlayFoundationPlugin(),
        maskPlugin({ label: false }),
        overlayStatePlugin(),
    ]);
    [, masks, overlayState] = installed;
    await editor.init({ canvas: 'editor-canvas', canvasContainer: 'canvas-container' });
    await editor.loadImage(createFixtureDataUrl('test-image-wide.png'));
}

window.__overlayStateTest = Object.freeze({
    async roundTrip() {
        await createEditor();
        if (!masks || !overlayState) throw new Error('Overlay State harness is not initialized.');
        await masks.create({ left: 42, top: 36, width: 72, height: 48 });
        const exported = overlayState.exportState({ metadata: { source: 'browser' } });
        await masks.removeAll();
        const countAfterRemoval = overlayState.exportState().overlays.length;
        const result = await overlayState.importState(exported);
        const imported = overlayState.exportState({ metadata: { source: 'browser' } });
        const exportedItem = exported.overlays[0]!;
        const importedItem = imported.overlays[0]!;
        const exportedCorners = (
            exportedItem.geometry as { readonly corners: readonly { x: number; y: number }[] }
        ).corners;
        const importedCorners = (
            importedItem.geometry as { readonly corners: readonly { x: number; y: number }[] }
        ).corners;
        const maxCoordinateDelta = Math.max(
            ...exportedCorners.flatMap((point, index) => [
                Math.abs(point.x - importedCorners[index]!.x),
                Math.abs(point.y - importedCorners[index]!.y),
            ]),
        );
        return Object.freeze({
            schema: imported.schema,
            version: imported.version,
            coordinateSpace: imported.coordinateSpace,
            kind: imported.overlays[0]?.kind ?? '',
            countAfterRemoval,
            imported: result.imported,
            skipped: result.skipped,
            attributesMatch:
                JSON.stringify({ ...importedItem, geometry: null }) ===
                JSON.stringify({ ...exportedItem, geometry: null }),
            maxCoordinateDelta,
        });
    },
    async dispose() {
        await editor?.disposeAsync();
        editor = null;
        masks = null;
        overlayState = null;
    },
});
