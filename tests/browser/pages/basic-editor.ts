import * as fabric from 'fabric';
import { ImageEditor, ImageEditorCore } from '@bensitu/image-editor';
import {
    annotationFoundationPlugin,
    type AnnotationPluginApi,
} from '@bensitu/image-editor/plugins/annotation';
import {
    drawAnnotationPlugin,
    type DrawAnnotationPluginApi,
} from '@bensitu/image-editor/plugins/annotation-draw';
import {
    shapeAnnotationPlugin,
    type ShapeAnnotationPluginApi,
} from '@bensitu/image-editor/plugins/annotation-shape';
import {
    textAnnotationPlugin,
    type TextAnnotationPluginApi,
} from '@bensitu/image-editor/plugins/annotation-text';
import { cropPlugin, type CropPluginApi } from '@bensitu/image-editor/plugins/crop';
import { historyPlugin, type HistoryPort } from '@bensitu/image-editor/plugins/history';
import {
    maskPlugin,
    type MaskObject,
    type MaskPluginApi,
} from '@bensitu/image-editor/plugins/mask';
import { mosaicPlugin, type MosaicPluginApi } from '@bensitu/image-editor/plugins/mosaic';
import {
    overlayFoundationPlugin,
    type OverlayFoundationApi,
} from '@bensitu/image-editor/plugins/overlay';
import { transformPlugin, type TransformPluginApi } from '@bensitu/image-editor/plugins/transform';
import { createFixtureDataUrl, type FixtureName } from '../fixtures/images';

type HarnessState = Readonly<{
    classIdentity: boolean;
    lifecycle: string;
    imageInfo: ReturnType<ImageEditor['getImageInfo']>;
    transform: ReturnType<TransformPluginApi['getState']> | null;
    history: ReturnType<HistoryPort['getState']> | null;
    cropActive: boolean;
    mosaicActive: boolean;
    maskCount: number;
    annotationCount: number;
}>;

type CancelResult = Readonly<{
    previewChanged: boolean;
    restoredExactly: boolean;
}>;

type CropResult = Readonly<{
    imageWidth: number;
    imageHeight: number;
    maskCount: number;
    maskIdentityPreserved: boolean;
    persistentIdPreserved: boolean;
    historyRecords: number;
}>;

type MosaicResult = Readonly<{
    outputChanged: boolean;
    imageWidth: number;
    imageHeight: number;
    historyRecords: number;
}>;

type TextAnnotationResult = Readonly<{
    editedText: string;
    preserveReadableDeterminantPositive: boolean;
    mirrorDeterminantNegative: boolean;
    historyRecords: number;
}>;

type AnnotationSceneResult = Readonly<{
    annotationCount: number;
    kinds: readonly string[];
    shapeKinds: readonly string[];
    drawCount: number;
    curvedDraw: boolean;
}>;

type EraserResult = Readonly<{
    beforeDrawCount: number;
    afterDrawCount: number;
    nonDrawMutations: number;
    historyRecords: number;
}>;

type AnnotationLifecycleResult = Readonly<{
    cropPreservedCount: number;
    hiddenPreservedByDefaultFlatten: boolean;
    lockedRestored: boolean;
    layerRestored: boolean;
    maskPreserved: boolean;
    remainingAfterDefaultFlatten: number;
    remainingAfterInclusiveFlatten: number;
    exportWidth: number;
    exportHeight: number;
}>;

export type CoreBrowserHarness = Readonly<{
    create(): Promise<void>;
    dispose(): Promise<void>;
    loadFixture(name: FixtureName): Promise<void>;
    zoomIn(): Promise<void>;
    rotate(degrees: number): Promise<void>;
    undo(): Promise<void>;
    redo(): Promise<void>;
    cancelCropPreview(): Promise<CancelResult>;
    cancelMosaicPreview(): Promise<CancelResult>;
    applyCropWithOverlay(): Promise<CropResult>;
    commitMosaicStrokes(): Promise<MosaicResult>;
    exerciseTextAnnotation(): Promise<TextAnnotationResult>;
    createAnnotationScene(): Promise<AnnotationSceneResult>;
    eraseDrawStroke(): Promise<EraserResult>;
    exerciseAnnotationLifecycle(): Promise<AnnotationLifecycleResult>;
    exportToPreview(): Promise<Readonly<{ width: number; height: number }>>;
    getState(): HarnessState;
}>;

let editor: ImageEditor | null = null;
let transform: TransformPluginApi | null = null;
let history: HistoryPort | null = null;
let overlay: OverlayFoundationApi | null = null;
let masks: MaskPluginApi | null = null;
let crop: CropPluginApi | null = null;
let mosaic: MosaicPluginApi | null = null;
let annotations: AnnotationPluginApi | null = null;
let textAnnotations: TextAnnotationPluginApi | null = null;
let shapeAnnotations: ShapeAnnotationPluginApi | null = null;
let drawAnnotations: DrawAnnotationPluginApi | null = null;

type AnnotationSceneIds = Readonly<{
    text: string;
    rect: string;
    line: string;
    arrow: string;
    firstDraw: string;
    secondDraw: string;
}>;

let annotationSceneIds: AnnotationSceneIds | null = null;

function statusElement(): HTMLElement {
    const element = document.getElementById('status');
    if (!element) throw new Error('Status element is missing.');
    return element;
}

function requireEditor(): ImageEditor {
    if (!editor) throw new Error('Editor is not initialized.');
    return editor;
}

function requireTransform(): TransformPluginApi {
    if (!transform) throw new Error('Transform Plugin is not installed.');
    return transform;
}

function requireHistory(): HistoryPort {
    if (!history) throw new Error('History Plugin is not installed.');
    return history;
}

function requireMasks(): MaskPluginApi {
    if (!masks) throw new Error('Mask Plugin is not installed.');
    return masks;
}

function requireOverlay(): OverlayFoundationApi {
    if (!overlay) throw new Error('Overlay Foundation is not installed.');
    return overlay;
}

function requireCrop(): CropPluginApi {
    if (!crop) throw new Error('Crop Plugin is not installed.');
    return crop;
}

function requireMosaic(): MosaicPluginApi {
    if (!mosaic) throw new Error('Mosaic Plugin is not installed.');
    return mosaic;
}

function requireAnnotations(): AnnotationPluginApi {
    if (!annotations) throw new Error('Annotation Foundation is not installed.');
    return annotations;
}

function requireTextAnnotations(): TextAnnotationPluginApi {
    if (!textAnnotations) throw new Error('Text Annotation Plugin is not installed.');
    return textAnnotations;
}

function requireShapeAnnotations(): ShapeAnnotationPluginApi {
    if (!shapeAnnotations) throw new Error('Shape Annotation Plugin is not installed.');
    return shapeAnnotations;
}

function requireDrawAnnotations(): DrawAnnotationPluginApi {
    if (!drawAnnotations) throw new Error('Draw Annotation Plugin is not installed.');
    return drawAnnotations;
}

function annotationObject(id: string): fabric.FabricObject {
    const object = requireEditor()
        .getCanvas()
        .getObjects()
        .find((candidate) => candidate.editorOverlayId === id);
    if (!object) throw new Error(`Annotation object "${id}" is missing.`);
    return object;
}

function transformDeterminant(object: fabric.FabricObject): number {
    const [a, b, c, d] = object.calcTransformMatrix();
    return a * d - b * c;
}

async function drawStroke(points: readonly { x: number; y: number }[]): Promise<string> {
    const drawApi = requireDrawAnnotations();
    const [first, ...rest] = points;
    if (!first) throw new Error('Draw stroke requires at least one point.');
    await drawApi.beginStroke(first);
    for (const point of rest) await drawApi.appendStroke(point);
    const id = await drawApi.endStroke();
    if (!id) throw new Error('Draw stroke produced no Annotation.');
    return id;
}

async function createAnnotationScene(): Promise<AnnotationSceneResult> {
    const textId = await requireTextAnnotations().create({
        text: 'Review',
        left: 82,
        top: 48,
        width: 78,
        fontSize: 20,
        fill: '#1d4ed8',
        backgroundColor: 'rgba(219,234,254,0.82)',
        name: 'Review label',
    });
    const rectId = await requireShapeAnnotations().create({
        geometry: { kind: 'rect', left: 170, top: 48, width: 54, height: 34 },
        stroke: '#dc2626',
        strokeWidth: 4,
        fill: 'rgba(254,226,226,0.32)',
        name: 'Review box',
    });
    const lineId = await requireShapeAnnotations().create({
        geometry: { kind: 'line', start: { x: 82, y: 120 }, end: { x: 148, y: 102 } },
        stroke: '#7c3aed',
        strokeWidth: 4,
        name: 'Guide line',
    });
    const arrowId = await requireShapeAnnotations().create({
        geometry: { kind: 'arrow', start: { x: 168, y: 126 }, end: { x: 230, y: 96 } },
        stroke: '#059669',
        strokeWidth: 4,
        arrowHeadLength: 14,
        name: 'Direction arrow',
    });
    const drawApi = requireDrawAnnotations();
    await drawApi.enter();
    const firstDrawId = await drawStroke([
        { x: 88, y: 166 },
        { x: 140, y: 184 },
        { x: 198, y: 158 },
    ]);
    const secondDrawId = await drawStroke([
        { x: 102, y: 208 },
        { x: 152, y: 198 },
        { x: 218, y: 212 },
    ]);
    await drawApi.exit();
    annotationSceneIds = Object.freeze({
        text: textId,
        rect: rectId,
        line: lineId,
        arrow: arrowId,
        firstDraw: firstDrawId,
        secondDraw: secondDrawId,
    });
    const descriptors = requireAnnotations().list();
    const shapeKinds = [rectId, lineId, arrowId]
        .map((id) => annotationObject(id).editorShapeKind)
        .filter((kind): kind is string => typeof kind === 'string')
        .sort();
    const firstDraw = annotationObject(firstDrawId);
    await requireAnnotations().clearSelection();
    return Object.freeze({
        annotationCount: descriptors.length,
        kinds: descriptors.map((descriptor) => descriptor.kind).sort(),
        shapeKinds,
        drawCount: descriptors.filter((descriptor) => descriptor.kind === 'annotation:draw').length,
        curvedDraw:
            firstDraw instanceof fabric.Path &&
            firstDraw.path.some((command) => String(command[0]).toUpperCase() === 'Q'),
    });
}

async function liveCanvasDataUrl(): Promise<string> {
    const canvas = requireEditor().getCanvas();
    canvas.requestRenderAll();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return canvas.getElement().toDataURL('image/png');
}

async function createCropMask(): Promise<MaskObject> {
    const bounds = requireEditor().getCanvas().getObjects()[0]?.getBoundingRect();
    if (!bounds) throw new Error('Base Image is missing.');
    return requireMasks().create({
        left: bounds.left + bounds.width * 0.25,
        top: bounds.top + bounds.height * 0.5,
        width: 28,
        height: 34,
        color: '#111827',
        alpha: 0.72,
    });
}

function updateStatus(): void {
    const current = requireEditor();
    const image = current.getImageInfo();
    statusElement().textContent = image
        ? `${current.getLifecycleState()} · ${image.naturalWidth} × ${image.naturalHeight}`
        : current.getLifecycleState();
}

const harness: CoreBrowserHarness = Object.freeze({
    async create() {
        if (editor) await editor.disposeAsync();
        editor = new ImageEditor(fabric, {
            canvasWidth: 320,
            canvasHeight: 240,
            defaultLayoutMode: 'fit',
        });
        transform = editor.use(transformPlugin({ animationDuration: 0 }));
        overlay = editor.use(overlayFoundationPlugin());
        annotations = editor.use(annotationFoundationPlugin());
        textAnnotations = editor.use(
            textAnnotationPlugin({
                bindToImageTransform: true,
                reflectionBehavior: 'preserve-readable',
            }),
        );
        shapeAnnotations = editor.use(shapeAnnotationPlugin());
        drawAnnotations = editor.use(
            drawAnnotationPlugin({ brush: { color: '#ea580c', width: 5 } }),
        );
        masks = editor.use(maskPlugin({ label: false }));
        history = editor.use(historyPlugin());
        crop = editor.use(cropPlugin({ paddingPx: 0 }));
        mosaic = editor.use(mosaicPlugin({ brushSizePx: 30, pixelBlockSizePx: 10 }));
        await editor.init({
            canvas: 'editor-canvas',
            canvasContainer: 'canvas-container',
        });
        updateStatus();
    },
    async dispose() {
        if (!editor) return;
        await editor.disposeAsync();
        editor = null;
        transform = null;
        history = null;
        overlay = null;
        masks = null;
        crop = null;
        mosaic = null;
        annotations = null;
        textAnnotations = null;
        shapeAnnotations = null;
        drawAnnotations = null;
        annotationSceneIds = null;
        statusElement().textContent = 'disposed';
    },
    async loadFixture(name) {
        await requireEditor().loadImage(createFixtureDataUrl(name));
        updateStatus();
    },
    async zoomIn() {
        await requireTransform().zoomIn();
        updateStatus();
    },
    async rotate(degrees) {
        await requireTransform().rotate(degrees);
        updateStatus();
    },
    async undo() {
        await requireHistory().undo();
        updateStatus();
    },
    async redo() {
        await requireHistory().redo();
        updateStatus();
    },
    async cancelCropPreview() {
        const before = await liveCanvasDataUrl();
        await requireCrop().enter({
            rect: { leftPx: 16, topPx: 18, widthPx: 112, heightPx: 104 },
        });
        const during = await liveCanvasDataUrl();
        await requireCrop().cancel();
        const after = await liveCanvasDataUrl();
        return Object.freeze({
            previewChanged: during !== before,
            restoredExactly: after === before,
        });
    },
    async cancelMosaicPreview() {
        const before = await liveCanvasDataUrl();
        await requireMosaic().enter();
        await requireMosaic().beginStroke({ xPx: 24, yPx: 28 });
        await requireMosaic().appendStroke({ xPx: 132, yPx: 96 });
        await requireMosaic().endStroke();
        const during = await liveCanvasDataUrl();
        await requireMosaic().cancel();
        const after = await liveCanvasDataUrl();
        return Object.freeze({
            previewChanged: during !== before,
            restoredExactly: after === before,
        });
    },
    async applyCropWithOverlay() {
        const mask = await createCropMask();
        const persistentId = mask.maskUid;
        requireHistory().clear();
        await requireCrop().enter({
            rect: { leftPx: 0, topPx: 0, widthPx: 120, heightPx: 160 },
        });
        await requireCrop().apply();
        updateStatus();
        const retained = requireMasks().getAll()[0] ?? null;
        const image = requireEditor().getImageInfo();
        if (!image) throw new Error('Cropped image information is missing.');
        return Object.freeze({
            imageWidth: image.naturalWidth,
            imageHeight: image.naturalHeight,
            maskCount: requireMasks().getAll().length,
            maskIdentityPreserved: retained === mask,
            persistentIdPreserved:
                requireOverlay().getByPersistentId(persistentId) === mask &&
                retained?.maskUid === persistentId,
            historyRecords: requireHistory().length,
        });
    },
    async commitMosaicStrokes() {
        const before = await requireEditor().exportImageBase64({ area: 'image', format: 'png' });
        const image = requireEditor().getImageInfo();
        if (!image) throw new Error('Mosaic source image information is missing.');
        const { naturalWidth: width, naturalHeight: height } = image;
        requireHistory().clear();
        await requireMosaic().enter();
        await requireMosaic().beginStroke({ xPx: width * 0.1, yPx: height * 0.2 });
        await requireMosaic().appendStroke({ xPx: width * 0.55, yPx: height * 0.45 });
        await requireMosaic().endStroke();
        await requireMosaic().beginStroke({ xPx: width * 0.15, yPx: height * 0.8 });
        await requireMosaic().appendStroke({ xPx: width * 0.525, yPx: height * 0.65 });
        await requireMosaic().endStroke();
        await requireMosaic().commit();
        updateStatus();
        const after = await requireEditor().exportImageBase64({ area: 'image', format: 'png' });
        const committedImage = requireEditor().getImageInfo();
        if (!committedImage) throw new Error('Mosaic image information is missing.');
        return Object.freeze({
            outputChanged: after !== before,
            imageWidth: committedImage.naturalWidth,
            imageHeight: committedImage.naturalHeight,
            historyRecords: requireHistory().length,
        });
    },
    async exerciseTextAnnotation() {
        const textApi = requireTextAnnotations();
        await textApi.configure({
            bindToImageTransform: true,
            reflectionBehavior: 'preserve-readable',
        });
        const id = await textApi.create({
            text: 'Readable',
            left: 104,
            top: 86,
            width: 120,
            fontSize: 24,
        });
        await requireTransform().flipHorizontal();
        const preserveReadableDeterminantPositive = transformDeterminant(annotationObject(id)) > 0;
        await requireTransform().flipHorizontal();
        await textApi.configure({ reflectionBehavior: 'mirror' });
        await requireTransform().flipHorizontal();
        const mirrorDeterminantNegative = transformDeterminant(annotationObject(id)) < 0;

        requireHistory().clear();
        await textApi.beginEditing(id);
        const preview = requireEditor()
            .getCanvas()
            .getObjects()
            .find((object) => object.editorAnnotationPreviewOwner === 'annotation:text');
        if (!(preview instanceof fabric.Textbox))
            throw new Error('Text editing preview is missing.');
        preview.set({ text: 'Edited in browser' });
        await textApi.commitEditing();
        const committed = annotationObject(id);
        if (!(committed instanceof fabric.Textbox)) throw new Error('Committed Text is missing.');
        return Object.freeze({
            editedText: committed.text,
            preserveReadableDeterminantPositive,
            mirrorDeterminantNegative,
            historyRecords: requireHistory().length,
        });
    },
    createAnnotationScene,
    async eraseDrawStroke() {
        await createAnnotationScene();
        const before = requireAnnotations().list();
        const beforeDrawCount = before.filter(
            (descriptor) => descriptor.kind === 'annotation:draw',
        ).length;
        const beforeNonDrawCount = before.length - beforeDrawCount;
        requireHistory().clear();
        const drawApi = requireDrawAnnotations();
        await drawApi.enter({ subMode: 'erase' });
        await drawApi.beginStroke({ x: 136, y: 180 });
        await drawApi.appendStroke({ x: 154, y: 178 });
        await drawApi.endStroke();
        await drawApi.exit();
        const after = requireAnnotations().list();
        const afterDrawCount = after.filter(
            (descriptor) => descriptor.kind === 'annotation:draw',
        ).length;
        const afterNonDrawCount = after.length - afterDrawCount;
        return Object.freeze({
            beforeDrawCount,
            afterDrawCount,
            nonDrawMutations: Math.abs(beforeNonDrawCount - afterNonDrawCount),
            historyRecords: requireHistory().length,
        });
    },
    async exerciseAnnotationLifecycle() {
        await createAnnotationScene();
        const ids = annotationSceneIds;
        if (!ids) throw new Error('Annotation scene identity is missing.');
        const mask = await createCropMask();
        await requireAnnotations().update(ids.text, { hidden: true });
        await requireAnnotations().update(ids.rect, { locked: true });
        await requireAnnotations().bringToFront(ids.arrow);
        const layerBeforeRestore = requireAnnotations().get(ids.arrow)?.layerIndex;
        const snapshot = requireEditor().saveState();
        await requireEditor().loadFromState(snapshot);
        const lockedRestored = requireAnnotations().get(ids.rect)?.locked === true;
        const layerRestored =
            requireAnnotations().get(ids.arrow)?.layerIndex === layerBeforeRestore;

        await requireCrop().enter({
            rect: { leftPx: 0, topPx: 0, widthPx: 150, heightPx: 150 },
        });
        await requireCrop().apply();
        const cropPreservedCount = requireAnnotations().list({
            includeHidden: true,
            includeLocked: true,
        }).length;
        const exported = await requireEditor().exportImageBase64({ area: 'image', format: 'png' });
        const exportImage = new Image();
        await new Promise<void>((resolve, reject) => {
            exportImage.onload = () => resolve();
            exportImage.onerror = () => reject(new Error('Annotation export failed to load.'));
            exportImage.src = exported;
        });

        await requireAnnotations().flatten();
        const remainingAfterDefaultFlatten = requireAnnotations().list({
            includeHidden: true,
            includeLocked: true,
        }).length;
        const hiddenPreservedByDefaultFlatten = requireAnnotations().get(ids.text)?.hidden === true;
        await requireAnnotations().flatten({ includeHidden: true });
        const remainingAfterInclusiveFlatten = requireAnnotations().list({
            includeHidden: true,
            includeLocked: true,
        }).length;
        return Object.freeze({
            cropPreservedCount,
            hiddenPreservedByDefaultFlatten,
            lockedRestored,
            layerRestored,
            maskPreserved: requireMasks()
                .getAll()
                .some((candidate) => candidate.maskUid === mask.maskUid),
            remainingAfterDefaultFlatten,
            remainingAfterInclusiveFlatten,
            exportWidth: exportImage.naturalWidth,
            exportHeight: exportImage.naturalHeight,
        });
    },
    async exportToPreview() {
        const dataUrl = await requireEditor().exportImageBase64({
            area: 'image',
            format: 'png',
        });
        const preview = document.getElementById('export-preview');
        if (!(preview instanceof HTMLImageElement)) throw new Error('Preview image is missing.');
        await new Promise<void>((resolve, reject) => {
            preview.onload = () => resolve();
            preview.onerror = () => reject(new Error('Export preview failed to load.'));
            preview.src = dataUrl;
        });
        preview.hidden = false;
        return Object.freeze({ width: preview.naturalWidth, height: preview.naturalHeight });
    },
    getState() {
        return Object.freeze({
            classIdentity: ImageEditor === ImageEditorCore,
            lifecycle: editor?.getLifecycleState() ?? 'configured',
            imageInfo: editor?.getImageInfo() ?? null,
            transform: transform?.getState() ?? null,
            history: history?.getState() ?? null,
            cropActive: crop?.isActive ?? false,
            mosaicActive: mosaic?.isActive ?? false,
            maskCount: masks?.getAll().length ?? 0,
            annotationCount:
                annotations?.list({ includeHidden: true, includeLocked: true }).length ?? 0,
        });
    },
});

declare global {
    interface Window {
        __imageEditorTest: CoreBrowserHarness;
    }
}

window.__imageEditorTest = harness;
