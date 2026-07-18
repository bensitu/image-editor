import ImageEditorDefault, {
    ImageEditor,
    ImageEditorCore,
    type FabricModule,
} from '@bensitu/image-editor';
import { ImageEditorCore as CoreEntry } from '@bensitu/image-editor/core';
import {
    definePlugin,
    definePluginRef,
    type ConfigurablePluginApi,
} from '@bensitu/image-editor/sdk';
import {
    filtersPlugin,
    type FilterDefinition,
    type FiltersPluginApi,
    type FiltersState,
} from '@bensitu/image-editor/plugins/filters';
import { cropPlugin, type CropPluginApi, type CropRect } from '@bensitu/image-editor/plugins/crop';
import {
    historyPlugin,
    type HistoryPort,
    type HistoryStatus,
} from '@bensitu/image-editor/plugins/history';
import { maskPlugin, type MaskPluginApi } from '@bensitu/image-editor/plugins/mask';
import {
    overlayFoundationPlugin,
    type OverlayFoundationApi,
} from '@bensitu/image-editor/plugins/overlay';
import {
    annotationFoundationPlugin,
    type AnnotationPluginApi,
} from '@bensitu/image-editor/plugins/annotation';
import {
    textAnnotationPlugin,
    type TextAnnotationPluginApi,
} from '@bensitu/image-editor/plugins/annotation-text';
import {
    shapeAnnotationPlugin,
    type ShapeAnnotationPluginApi,
} from '@bensitu/image-editor/plugins/annotation-shape';
import {
    drawAnnotationPlugin,
    type DrawAnnotationPluginApi,
} from '@bensitu/image-editor/plugins/annotation-draw';
import { transformPlugin, type TransformPluginApi } from '@bensitu/image-editor/plugins/transform';
import {
    mosaicPlugin,
    type MosaicImagePoint,
    type MosaicPluginApi,
} from '@bensitu/image-editor/plugins/mosaic';
import {
    overlayStatePlugin,
    type OverlayStateDocument,
    type OverlayStatePluginApi,
} from '@bensitu/image-editor/plugins/overlay-state';
import {
    domControlsPlugin,
    type DomControlsPluginApi,
} from '@bensitu/image-editor/plugins/dom-controls';
import { createMinimalPreset } from '@bensitu/image-editor/presets/minimal';
import { createRedactionPreset } from '@bensitu/image-editor/presets/redaction';
import { createAnnotationPreset } from '@bensitu/image-editor/presets/annotation';
import { createFullPreset } from '@bensitu/image-editor/presets/full';
import { createPluginTestHost, type PluginConformanceReport } from '@bensitu/image-editor/testing';
import {
    detectSnapshotVersion,
    loadV2Snapshot,
    migrateV2Snapshot,
    v2SnapshotMigration,
    type SnapshotConversionOptions,
    type SnapshotMigrationLoadOptions,
    type SnapshotMigrationWarning,
    type SnapshotVersionDetection,
} from '@bensitu/image-editor/migrate-v2';

declare const fabric: FabricModule;

const editor = new ImageEditor(fabric);
const defaultEditor: ImageEditorCore = new ImageEditorDefault(fabric);
const coreEditor: CoreEntry = new CoreEntry(fabric);
const overlay: OverlayFoundationApi = editor.use(overlayFoundationPlugin());
const annotations: AnnotationPluginApi = editor.use(annotationFoundationPlugin());
const textAnnotations: TextAnnotationPluginApi = editor.use(textAnnotationPlugin());
const shapeAnnotations: ShapeAnnotationPluginApi = editor.use(shapeAnnotationPlugin());
const drawAnnotations: DrawAnnotationPluginApi = editor.use(drawAnnotationPlugin());
const masks: MaskPluginApi = editor.use(maskPlugin());
const history: HistoryPort = editor.use(historyPlugin({ enabled: false, maxSize: 25 }));
const historyStatus: HistoryStatus = history.getState();
const enablingHistory: Promise<void> = history.enable({ baseline: 'current' });
const disablingHistory: Promise<void> = history.disable({ clear: false });
const transform: TransformPluginApi = editor.use(transformPlugin());
const filters: FiltersPluginApi = editor.use(filtersPlugin({ maxFilterCount: 8 }));
const crop: CropPluginApi = editor.use(cropPlugin({ paddingPx: 0 }));
const mosaic: MosaicPluginApi = editor.use(mosaicPlugin({ brushSizePx: 20 }));
const overlayState: OverlayStatePluginApi = editor.use(overlayStatePlugin());
const overlayDocument: OverlayStateDocument = overlayState.exportState();
const domControls: DomControlsPluginApi = editor.use(domControlsPlugin());
const minimalPreset = createMinimalPreset(fabric);
const minimalHistoryPreset = createMinimalPreset(fabric, { history: {} });
const redactionPreset = createRedactionPreset(fabric);
const annotationPreset = createAnnotationPreset(fabric);
const fullPreset = createFullPreset(fabric, {
    domControls: () => domControlsPlugin(),
});
const cropRect: CropRect = { leftPx: 0, topPx: 0, widthPx: 10, heightPx: 10 };
const mosaicPoint: MosaicImagePoint = { xPx: 5, yPx: 5 };
const definitions = [
    { type: 'brightness', value: 0.25 },
] as const satisfies readonly FilterDefinition[];
const filtersState: FiltersState = filters.getState();
const previewingFilters: Promise<void> = filters.preview(definitions);
const committingFilters: Promise<void> = filters.commit(definitions);
const configuringFilters: Promise<void> = filters.configure({ maxFilterCount: 4 });
const bakingFilters: Promise<void> = filters.bake({ format: 'png' });
interface ExamplePluginApi extends ConfigurablePluginApi<{ readonly enabled: boolean }> {
    readonly status: 'ready';
}
const exampleRef = definePluginRef<ExamplePluginApi>('example:package-types', '1.0.0');
const examplePlugin = definePlugin({
    ref: exampleRef,
    manifest: {
        id: exampleRef.id,
        version: '1.0.0',
        apiVersion: exampleRef.apiVersion,
        engine: '^3.0.0',
    },
    setupMode: 'sync',
    setup: (): ExamplePluginApi => ({
        status: 'ready',
        configure: () => undefined,
        getConfiguration: () => Object.freeze({ enabled: true }),
    }),
});
const exampleApi: ExamplePluginApi = editor.use(examplePlugin);
const testHost = createPluginTestHost();
const testApi: Promise<ExamplePluginApi> = testHost.install(examplePlugin);
declare const report: PluginConformanceReport;
declare const migrationInput: unknown;
declare const warning: SnapshotMigrationWarning;
const migrationOptions: SnapshotConversionOptions = {
    unsupportedFieldPolicy: 'warn-and-skip',
    onWarning: (value) => void value.code,
};
const migrationLoadOptions: SnapshotMigrationLoadOptions = {
    ...migrationOptions,
    missingPluginPolicy: 'error',
};
const detection: SnapshotVersionDetection = detectSnapshotVersion(migrationInput);
const migratedSnapshot = migrateV2Snapshot(migrationInput, migrationOptions);
const migration = v2SnapshotMigration(migrationOptions);
const loadingMigration: Promise<void> = loadV2Snapshot(
    editor,
    migrationInput,
    migrationLoadOptions,
);

void overlay;
void annotations;
void textAnnotations;
void shapeAnnotations;
void drawAnnotations;
void masks;
void history;
void historyStatus;
void enablingHistory;
void disablingHistory;
void transform;
void filters;
void crop;
void mosaic;
void overlayState;
void overlayDocument;
void domControls;
void minimalPreset;
void minimalHistoryPreset.history;
void redactionPreset.masks;
void annotationPreset.annotations;
void fullPreset.domControls;
void cropRect;
void mosaicPoint;
void filtersState;
void previewingFilters;
void committingFilters;
void configuringFilters;
void bakingFilters;
void defaultEditor;
void coreEditor;
void exampleApi;
void testApi;
void report;
void warning;
void detection;
void migratedSnapshot;
void migration;
void loadingMigration;
