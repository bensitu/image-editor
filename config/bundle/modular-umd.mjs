/**
 * Defines the single source of truth for Full and modular UMD build artifacts.
 *
 * @module
 */

function freezeModuleDefinition(definition) {
    return Object.freeze({
        ...definition,
        dependencies: Object.freeze([...definition.dependencies]),
    });
}

export function createUmdArtifactFiles(fileBase) {
    return Object.freeze([
        `${fileBase}.umd.js`,
        `${fileBase}.umd.js.map`,
        `${fileBase}.umd.min.js`,
        `${fileBase}.umd.min.js.map`,
    ]);
}

export const FULL_UMD = freezeModuleDefinition({
    id: 'full',
    input: 'dist/esm/umd/full.js',
    fileBase: 'dist/umd/image-editor.full',
    globalName: 'ImageEditorFull',
    dependencies: ['fabric'],
    sourceKind: 'full',
});

export const MODULAR_UMD_CORE = freezeModuleDefinition({
    id: 'core',
    input: 'dist/esm/umd/core.js',
    fileBase: 'dist/umd/image-editor.core',
    globalName: 'ImageEditor',
    dependencies: ['fabric'],
    sourceKind: 'core',
});

export const MODULAR_UMD_PLUGINS = Object.freeze(
    [
        {
            id: 'overlay',
            input: 'dist/esm/foundations/overlay/index.js',
            globalName: 'ImageEditorPlugins.Overlay',
            dependencies: ['core'],
            sourceKind: 'foundation',
            guardExport: 'overlayFoundationPlugin',
        },
        {
            id: 'annotation',
            input: 'dist/esm/foundations/annotation/index.js',
            globalName: 'ImageEditorPlugins.Annotation',
            dependencies: ['core', 'overlay'],
            sourceKind: 'foundation',
            guardExport: 'annotationFoundationPlugin',
        },
        {
            id: 'transform',
            input: 'dist/esm/plugins/transform/index.js',
            globalName: 'ImageEditorPlugins.Transform',
            dependencies: ['core'],
            sourceKind: 'plugin',
            guardExport: 'transformPlugin',
        },
        {
            id: 'history',
            input: 'dist/esm/plugins/history/index.js',
            globalName: 'ImageEditorPlugins.History',
            dependencies: ['core'],
            sourceKind: 'plugin',
            guardExport: 'historyPlugin',
        },
        {
            id: 'mask',
            input: 'dist/esm/plugins/mask/index.js',
            globalName: 'ImageEditorPlugins.Mask',
            dependencies: ['core', 'overlay'],
            sourceKind: 'plugin',
            guardExport: 'maskPlugin',
        },
        {
            id: 'filters',
            input: 'dist/esm/plugins/filters/index.js',
            globalName: 'ImageEditorPlugins.Filters',
            dependencies: ['core'],
            sourceKind: 'plugin',
            guardExport: 'filtersPlugin',
        },
        {
            id: 'crop',
            input: 'dist/esm/plugins/crop/index.js',
            globalName: 'ImageEditorPlugins.Crop',
            dependencies: ['core', 'overlay'],
            sourceKind: 'plugin',
            guardExport: 'cropPlugin',
        },
        {
            id: 'mosaic',
            input: 'dist/esm/plugins/mosaic/index.js',
            globalName: 'ImageEditorPlugins.Mosaic',
            dependencies: ['core'],
            sourceKind: 'plugin',
            guardExport: 'mosaicPlugin',
        },
        {
            id: 'annotation-text',
            input: 'dist/esm/plugins/annotation-text/index.js',
            globalName: 'ImageEditorPlugins.AnnotationText',
            dependencies: ['core', 'overlay', 'annotation'],
            sourceKind: 'plugin',
            guardExport: 'textAnnotationPlugin',
        },
        {
            id: 'annotation-shape',
            input: 'dist/esm/plugins/annotation-shape/index.js',
            globalName: 'ImageEditorPlugins.AnnotationShape',
            dependencies: ['core', 'overlay', 'annotation'],
            sourceKind: 'plugin',
            guardExport: 'shapeAnnotationPlugin',
        },
        {
            id: 'annotation-draw',
            input: 'dist/esm/plugins/annotation-draw/index.js',
            globalName: 'ImageEditorPlugins.AnnotationDraw',
            dependencies: ['core', 'overlay', 'annotation'],
            sourceKind: 'plugin',
            guardExport: 'drawAnnotationPlugin',
        },
        {
            id: 'overlay-state',
            input: 'dist/esm/plugins/overlay-state/index.js',
            globalName: 'ImageEditorPlugins.OverlayState',
            dependencies: ['core', 'overlay'],
            sourceKind: 'plugin',
            guardExport: 'overlayStatePlugin',
        },
        {
            id: 'dom-controls',
            input: 'dist/esm/plugins/dom-controls/index.js',
            globalName: 'ImageEditorPlugins.DomControls',
            dependencies: ['core'],
            sourceKind: 'plugin',
            guardExport: 'domControlsPlugin',
        },
    ].map((definition) =>
        freezeModuleDefinition({
            ...definition,
            fileBase: `dist/umd/plugins/image-editor.plugin.${definition.id}`,
        }),
    ),
);

export const MODULAR_UMD_MODULES = Object.freeze([MODULAR_UMD_CORE, ...MODULAR_UMD_PLUGINS]);

export const MODULAR_UMD_BOUNDARIES = Object.freeze([
    Object.freeze({
        input: 'dist/esm/core/index.js',
        externalId: '@bensitu/image-editor/core',
        globalName: 'ImageEditor',
    }),
    Object.freeze({
        input: 'dist/esm/sdk/index.js',
        externalId: '@bensitu/image-editor/sdk',
        globalName: 'ImageEditor',
    }),
    Object.freeze({
        input: 'dist/esm/foundations/overlay/index.js',
        externalId: '@bensitu/image-editor/plugins/overlay',
        globalName: 'ImageEditorPlugins.Overlay',
    }),
    Object.freeze({
        input: 'dist/esm/foundations/annotation/index.js',
        externalId: '@bensitu/image-editor/plugins/annotation',
        globalName: 'ImageEditorPlugins.Annotation',
    }),
]);

export const MODULAR_UMD_GLOBALS = Object.freeze({
    fabric: 'fabric',
    ...Object.fromEntries(
        MODULAR_UMD_BOUNDARIES.map((boundary) => [boundary.externalId, boundary.globalName]),
    ),
});

export const FULL_UMD_ARTIFACTS = createUmdArtifactFiles(FULL_UMD.fileBase);
export const MODULAR_UMD_ARTIFACTS = Object.freeze(
    MODULAR_UMD_MODULES.flatMap((definition) => createUmdArtifactFiles(definition.fileBase)),
);
export const ALL_APPROVED_UMD_ARTIFACTS = Object.freeze([
    ...FULL_UMD_ARTIFACTS,
    ...MODULAR_UMD_ARTIFACTS,
]);

export const UMD_ESM_BUILD_INPUTS = Object.freeze(
    [FULL_UMD, MODULAR_UMD_CORE].flatMap((definition) => [
        definition.input,
        `${definition.input}.map`,
    ]),
);
