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

export const MODULAR_UMD_PLUGINS = Object.freeze([]);

export const FULL_UMD_ARTIFACTS = createUmdArtifactFiles(FULL_UMD.fileBase);
export const MODULAR_UMD_ARTIFACTS = createUmdArtifactFiles(MODULAR_UMD_CORE.fileBase);
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
