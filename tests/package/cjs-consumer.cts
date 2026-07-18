/* eslint-disable @typescript-eslint/no-require-imports */

import core = require('@bensitu/image-editor/core');
import root = require('@bensitu/image-editor');
import sdk = require('@bensitu/image-editor/sdk');
import filtersEntry = require('@bensitu/image-editor/plugins/filters');
import cropEntry = require('@bensitu/image-editor/plugins/crop');
import historyEntry = require('@bensitu/image-editor/plugins/history');
import maskEntry = require('@bensitu/image-editor/plugins/mask');
import overlayEntry = require('@bensitu/image-editor/plugins/overlay');
import annotationEntry = require('@bensitu/image-editor/plugins/annotation');
import annotationTextEntry = require('@bensitu/image-editor/plugins/annotation-text');
import annotationShapeEntry = require('@bensitu/image-editor/plugins/annotation-shape');
import annotationDrawEntry = require('@bensitu/image-editor/plugins/annotation-draw');
import transformEntry = require('@bensitu/image-editor/plugins/transform');
import mosaicEntry = require('@bensitu/image-editor/plugins/mosaic');
import overlayStateEntry = require('@bensitu/image-editor/plugins/overlay-state');
import domControlsEntry = require('@bensitu/image-editor/plugins/dom-controls');
import minimalPresetEntry = require('@bensitu/image-editor/presets/minimal');
import redactionPresetEntry = require('@bensitu/image-editor/presets/redaction');
import annotationPresetEntry = require('@bensitu/image-editor/presets/annotation');
import fullPresetEntry = require('@bensitu/image-editor/presets/full');
import testing = require('@bensitu/image-editor/testing');
import migrationEntry = require('@bensitu/image-editor/migrate-v2');

declare const fabric: core.FabricModule;

const editor = new root.ImageEditor(fabric);
const coreEditor: root.ImageEditorCore = new core.ImageEditorCore(fabric);
const overlay: overlayEntry.OverlayFoundationApi = editor.use(
    overlayEntry.overlayFoundationPlugin(),
);
const annotations: annotationEntry.AnnotationPluginApi = editor.use(
    annotationEntry.annotationFoundationPlugin(),
);
const textAnnotations: annotationTextEntry.TextAnnotationPluginApi = editor.use(
    annotationTextEntry.textAnnotationPlugin(),
);
const shapeAnnotations: annotationShapeEntry.ShapeAnnotationPluginApi = editor.use(
    annotationShapeEntry.shapeAnnotationPlugin(),
);
const drawAnnotations: annotationDrawEntry.DrawAnnotationPluginApi = editor.use(
    annotationDrawEntry.drawAnnotationPlugin(),
);
const masks: maskEntry.MaskPluginApi = editor.use(maskEntry.maskPlugin());
const history: historyEntry.HistoryPort = editor.use(
    historyEntry.historyPlugin({ enabled: false, maxSize: 25 }),
);
const historyStatus: historyEntry.HistoryStatus = history.getState();
const enablingHistory: Promise<void> = history.enable({ baseline: 'current' });
const disablingHistory: Promise<void> = history.disable({ clear: false });
const transform: transformEntry.TransformPluginApi = editor.use(transformEntry.transformPlugin());
const filters: filtersEntry.FiltersPluginApi = editor.use(
    filtersEntry.filtersPlugin({ maxFilterCount: 8 }),
);
const crop: cropEntry.CropPluginApi = editor.use(cropEntry.cropPlugin({ paddingPx: 0 }));
const mosaic: mosaicEntry.MosaicPluginApi = editor.use(
    mosaicEntry.mosaicPlugin({ brushSizePx: 20 }),
);
const overlayState: overlayStateEntry.OverlayStatePluginApi = editor.use(
    overlayStateEntry.overlayStatePlugin(),
);
const overlayDocument: overlayStateEntry.OverlayStateDocument = overlayState.exportState();
const domControls: domControlsEntry.DomControlsPluginApi = editor.use(
    domControlsEntry.domControlsPlugin(),
);
const minimalPreset = minimalPresetEntry.createMinimalPreset(fabric);
const minimalHistoryPreset = minimalPresetEntry.createMinimalPreset(fabric, { history: {} });
const redactionPreset = redactionPresetEntry.createRedactionPreset(fabric);
const annotationPreset = annotationPresetEntry.createAnnotationPreset(fabric);
const fullPreset = fullPresetEntry.createFullPreset(fabric, {
    domControls: () => domControlsEntry.domControlsPlugin(),
});
const cropRect: cropEntry.CropRect = {
    leftPx: 0,
    topPx: 0,
    widthPx: 10,
    heightPx: 10,
};
const mosaicPoint: mosaicEntry.MosaicImagePoint = { xPx: 5, yPx: 5 };
const definitions = [
    { type: 'contrast', value: 0.25 },
] as const satisfies readonly filtersEntry.FilterDefinition[];
const filtersState: filtersEntry.FiltersState = filters.getState();
const previewingFilters: Promise<void> = filters.preview(definitions);
const committingFilters: Promise<void> = filters.commit(definitions);
const configuringFilters: Promise<void> = filters.configure({ maxFilterCount: 4 });
const bakingFilters: Promise<void> = filters.bake({ format: 'jpeg', quality: 0.8 });
interface ExamplePluginApi {
    readonly status: 'ready';
}
const exampleRef = sdk.definePluginRef<ExamplePluginApi>('example:package-types-cjs', '1.0.0');
const examplePlugin = sdk.definePlugin({
    ref: exampleRef,
    manifest: {
        id: exampleRef.id,
        version: '1.0.0',
        apiVersion: exampleRef.apiVersion,
        engine: '^3.0.0',
    },
    setupMode: 'sync',
    setup: (): ExamplePluginApi => ({ status: 'ready' }),
});
const exampleApi: ExamplePluginApi = editor.use(examplePlugin);
const testHost = testing.createPluginTestHost();
const testApi: Promise<ExamplePluginApi> = testHost.install(examplePlugin);
declare const report: testing.PluginConformanceReport;
declare const migrationInput: unknown;
declare const warning: migrationEntry.SnapshotMigrationWarning;
const migrationOptions: migrationEntry.SnapshotConversionOptions = {
    unsupportedFieldPolicy: 'warn-and-skip',
    onWarning: (value) => void value.path,
};
const migrationLoadOptions: migrationEntry.SnapshotMigrationLoadOptions = {
    ...migrationOptions,
    missingPluginPolicy: 'error',
};
const detection: migrationEntry.SnapshotVersionDetection =
    migrationEntry.detectSnapshotVersion(migrationInput);
const migratedSnapshot = migrationEntry.migrateV2Snapshot(migrationInput, migrationOptions);
const migration = migrationEntry.v2SnapshotMigration(migrationOptions);
const loadingMigration: Promise<void> = migrationEntry.loadV2Snapshot(
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
void coreEditor;
void exampleApi;
void testApi;
void report;
void warning;
void detection;
void migratedSnapshot;
void migration;
void loadingMigration;
