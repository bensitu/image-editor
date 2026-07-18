import { ImageEditorCore, type FabricModule } from '../../src/core/index.js';
import {
    annotationFoundationPlugin,
    annotationFoundationRef,
    type AnnotationPluginApi,
} from '../../src/foundations/annotation/index.js';
import {
    overlayFoundationPlugin,
    overlayFoundationRef,
    type OverlayFoundationApi,
} from '../../src/foundations/overlay/index.js';
import {
    cropPlugin,
    cropPluginRef,
    type CropPluginApi,
    type CropSessionState,
} from '../../src/plugins/crop/index.js';
import { maskPlugin, maskPluginRef, type MaskPluginApi } from '../../src/plugins/mask/index.js';
import {
    historyPlugin,
    historyPluginRef,
    type HistoryPort,
    type HistoryStatus,
} from '../../src/plugins/history/index.js';
import {
    filtersPlugin,
    filtersPluginRef,
    type FiltersPluginApi,
    type FiltersState,
} from '../../src/plugins/filters/index.js';
import {
    mosaicPlugin,
    mosaicPluginRef,
    type MosaicPluginApi,
    type MosaicSessionState,
} from '../../src/plugins/mosaic/index.js';
import {
    textAnnotationPlugin,
    textAnnotationPluginRef,
    type TextAnnotationPluginApi,
} from '../../src/plugins/annotation-text/index.js';
import {
    shapeAnnotationPlugin,
    shapeAnnotationPluginRef,
    type ShapeAnnotationPluginApi,
    type ShapeSessionState,
} from '../../src/plugins/annotation-shape/index.js';
import {
    drawAnnotationPlugin,
    drawAnnotationPluginRef,
    type DrawAnnotationPluginApi,
    type DrawSessionState,
} from '../../src/plugins/annotation-draw/index.js';
import {
    transformPlugin,
    transformPluginRef,
    type TransformPluginApi,
    type TransformPluginState,
} from '../../src/plugins/transform/index.js';
import {
    overlayStatePlugin,
    overlayStatePluginRef,
    type OverlayStateDocument,
    type OverlayStatePluginApi,
} from '../../src/plugins/overlay-state/index.js';

type Equal<TLeft, TRight> =
    (<TValue>() => TValue extends TLeft ? 1 : 2) extends <TValue>() => TValue extends TRight ? 1 : 2
        ? true
        : false;
type Expect<TValue extends true> = TValue;

declare const fabricModule: FabricModule;

const editor = new ImageEditorCore(fabricModule);
const overlay = editor.use(overlayFoundationPlugin());
const annotations = editor.use(annotationFoundationPlugin());
const textAnnotations = editor.use(textAnnotationPlugin());
const shapeAnnotations = editor.use(shapeAnnotationPlugin());
const drawAnnotations = editor.use(drawAnnotationPlugin());
const masks = editor.use(maskPlugin());
const history = editor.use(
    historyPlugin({
        enabled: false,
        maxSize: 25,
        onChange: (status) => {
            const current: HistoryStatus = status;
            void current;
        },
    }),
);
const installed = editor.use(transformPlugin({ animationDuration: 0 }));
const filters = editor.use(filtersPlugin({ maxFilterCount: 8 }));
const crop = editor.use(cropPlugin({ paddingPx: 0 }));
const mosaic = editor.use(mosaicPlugin({ brushSizePx: 24 }));
const overlayState = editor.use(overlayStatePlugin());
const optional = editor.getPlugin(transformPluginRef);
const optionalFilters = editor.getPlugin(filtersPluginRef);
const optionalCrop = editor.getPlugin(cropPluginRef);
const optionalMosaic = editor.getPlugin(mosaicPluginRef);
const state = installed.getState();
const filtersState = filters.getState();
const optionalOverlay = editor.getPlugin(overlayFoundationRef);
const optionalMasks = editor.getPlugin(maskPluginRef);
const optionalHistory = editor.getPlugin(historyPluginRef);
const optionalAnnotations = editor.getPlugin(annotationFoundationRef);
const optionalTextAnnotations = editor.getPlugin(textAnnotationPluginRef);
const optionalShapeAnnotations = editor.getPlugin(shapeAnnotationPluginRef);
const optionalDrawAnnotations = editor.getPlugin(drawAnnotationPluginRef);
const optionalOverlayState = editor.getPlugin(overlayStatePluginRef);
const overlayDocument = overlayState.exportState();

type InstalledApiInference = Expect<Equal<typeof installed, TransformPluginApi>>;
type OptionalApiInference = Expect<Equal<typeof optional, TransformPluginApi | null>>;
type StateInference = Expect<Equal<typeof state, TransformPluginState>>;
type OverlayApiInference = Expect<Equal<typeof overlay, OverlayFoundationApi>>;
type MaskApiInference = Expect<Equal<typeof masks, MaskPluginApi>>;
type OptionalOverlayInference = Expect<Equal<typeof optionalOverlay, OverlayFoundationApi | null>>;
type OptionalMaskInference = Expect<Equal<typeof optionalMasks, MaskPluginApi | null>>;
type HistoryApiInference = Expect<Equal<typeof history, HistoryPort>>;
type OptionalHistoryInference = Expect<Equal<typeof optionalHistory, HistoryPort | null>>;
type HistoryStatusInference = Expect<Equal<ReturnType<HistoryPort['getState']>, HistoryStatus>>;
type FiltersApiInference = Expect<Equal<typeof filters, FiltersPluginApi>>;
type OptionalFiltersInference = Expect<Equal<typeof optionalFilters, FiltersPluginApi | null>>;
type FiltersStateInference = Expect<Equal<typeof filtersState, FiltersState>>;
type CropApiInference = Expect<Equal<typeof crop, CropPluginApi>>;
type OptionalCropInference = Expect<Equal<typeof optionalCrop, CropPluginApi | null>>;
type CropSessionInference = Expect<
    Equal<ReturnType<CropPluginApi['getSession']>, Readonly<CropSessionState> | null>
>;
type MosaicApiInference = Expect<Equal<typeof mosaic, MosaicPluginApi>>;
type OptionalMosaicInference = Expect<Equal<typeof optionalMosaic, MosaicPluginApi | null>>;
type MosaicSessionInference = Expect<
    Equal<ReturnType<MosaicPluginApi['getSession']>, Readonly<MosaicSessionState> | null>
>;
type AnnotationApiInference = Expect<Equal<typeof annotations, AnnotationPluginApi>>;
type OptionalAnnotationInference = Expect<
    Equal<typeof optionalAnnotations, AnnotationPluginApi | null>
>;
type TextAnnotationApiInference = Expect<Equal<typeof textAnnotations, TextAnnotationPluginApi>>;
type OptionalTextAnnotationInference = Expect<
    Equal<typeof optionalTextAnnotations, TextAnnotationPluginApi | null>
>;
type ShapeAnnotationApiInference = Expect<Equal<typeof shapeAnnotations, ShapeAnnotationPluginApi>>;
type OptionalShapeAnnotationInference = Expect<
    Equal<typeof optionalShapeAnnotations, ShapeAnnotationPluginApi | null>
>;
type ShapeSessionInference = Expect<
    Equal<ReturnType<ShapeAnnotationPluginApi['getSession']>, Readonly<ShapeSessionState> | null>
>;
type DrawAnnotationApiInference = Expect<Equal<typeof drawAnnotations, DrawAnnotationPluginApi>>;
type OptionalDrawAnnotationInference = Expect<
    Equal<typeof optionalDrawAnnotations, DrawAnnotationPluginApi | null>
>;
type DrawSessionInference = Expect<
    Equal<ReturnType<DrawAnnotationPluginApi['getSession']>, Readonly<DrawSessionState> | null>
>;
type OverlayStateApiInference = Expect<Equal<typeof overlayState, OverlayStatePluginApi>>;
type OptionalOverlayStateInference = Expect<
    Equal<typeof optionalOverlayState, OverlayStatePluginApi | null>
>;
type OverlayDocumentInference = Expect<Equal<typeof overlayDocument, OverlayStateDocument>>;

installed.scale(1.25);
installed.rotate(30);
const enabling: Promise<void> = history.enable({ baseline: 'current' });
const disabling: Promise<void> = history.disable({ clear: false });
const historyEnabled: boolean = history.isEnabled;
const historyLength: number = history.length;
const previewingFilters: Promise<void> = filters.preview([{ type: 'brightness', value: 0.25 }]);
const committingFilters: Promise<void> = filters.commit();
const configuringFilters: Promise<void> = filters.configure({ maxFilterCount: 4 });
const enteringCrop: Promise<void> = crop.enter({
    rect: { leftPx: 0, topPx: 0, widthPx: 10, heightPx: 10 },
});
const enteringMosaic: Promise<void> = mosaic.enter({
    configuration: { pixelBlockSizePx: 8 },
});

// @ts-expect-error Transform factors must be numeric.
installed.scale('1.25');
// @ts-expect-error Plugin APIs are retrieved with a typed PluginRef, not an arbitrary string.
editor.getPlugin(transformPluginRef.id);
// @ts-expect-error History supports only the current trusted baseline.
history.enable({ baseline: 'saved' });
// @ts-expect-error History installation state must be boolean.
historyPlugin({ enabled: 'no' });
// @ts-expect-error Filter types are a closed public union.
filters.preview([{ type: 'custom-filter' }]);
// @ts-expect-error Filters configuration accepts only declared properties.
filters.configure({ arbitraryLimit: 4 });
// @ts-expect-error Crop rectangles use natural image pixel field names.
crop.updateRect({ left: 0, top: 0, width: 10, height: 10 });
// @ts-expect-error Mosaic points use natural image pixel field names.
mosaic.beginStroke({ x: 2, y: 3 });
// @ts-expect-error Overlay State import modes are closed.
overlayState.importState({}, { mode: 'merge' });

void optional;
void overlay;
void masks;
void history;
void optionalOverlay;
void optionalMasks;
void optionalHistory;
void annotations;
void textAnnotations;
void shapeAnnotations;
void drawAnnotations;
void optionalAnnotations;
void optionalTextAnnotations;
void optionalShapeAnnotations;
void optionalDrawAnnotations;
void filters;
void optionalFilters;
void filtersState;
void state;
void enabling;
void disabling;
void historyEnabled;
void historyLength;
void previewingFilters;
void committingFilters;
void configuringFilters;
void crop;
void optionalCrop;
void mosaic;
void optionalMosaic;
void enteringCrop;
void enteringMosaic;
void overlayState;
void optionalOverlayState;
void overlayDocument;
export type Assertions =
    | InstalledApiInference
    | OptionalApiInference
    | StateInference
    | OverlayApiInference
    | MaskApiInference
    | OptionalOverlayInference
    | OptionalMaskInference
    | HistoryApiInference
    | OptionalHistoryInference
    | HistoryStatusInference
    | FiltersApiInference
    | OptionalFiltersInference
    | FiltersStateInference
    | CropApiInference
    | OptionalCropInference
    | CropSessionInference
    | MosaicApiInference
    | OptionalMosaicInference
    | MosaicSessionInference
    | AnnotationApiInference
    | OptionalAnnotationInference
    | TextAnnotationApiInference
    | OptionalTextAnnotationInference
    | ShapeAnnotationApiInference
    | OptionalShapeAnnotationInference
    | ShapeSessionInference
    | DrawAnnotationApiInference
    | OptionalDrawAnnotationInference
    | DrawSessionInference
    | OverlayStateApiInference
    | OptionalOverlayStateInference
    | OverlayDocumentInference;
