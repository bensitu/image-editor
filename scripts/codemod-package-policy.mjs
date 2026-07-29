/**
 * Defines the independently publishable Codemod package contract.
 *
 * @module
 */

const CODEMOD_PACKAGE_NAME = '@bensitu/image-editor-codemod';
const REQUIRED_PACKED_FILES = Object.freeze([
    'dist/cli.js',
    'dist/index.js',
    'dist/index.d.ts',
    'README.md',
    'LICENSE',
]);

function assertCondition(condition, message) {
    if (!condition) throw new Error(message);
}

export function assertCodemodPackagePolicy(rootManifest, codemodManifest, packedFiles = null) {
    assertCondition(
        codemodManifest.name === CODEMOD_PACKAGE_NAME,
        `Codemod package name must be ${CODEMOD_PACKAGE_NAME}.`,
    );
    assertCondition(
        codemodManifest.version === rootManifest.version,
        `Codemod version ${String(codemodManifest.version)} must match root version ${String(rootManifest.version)}.`,
    );
    assertCondition(
        codemodManifest.main === './dist/index.js',
        'Codemod main entry must be ./dist/index.js.',
    );
    assertCondition(
        codemodManifest.types === './dist/index.d.ts',
        'Codemod types entry must be ./dist/index.d.ts.',
    );
    assertCondition(
        codemodManifest.bin?.['image-editor-codemod'] === './dist/cli.js',
        'Codemod CLI entry must be ./dist/cli.js.',
    );
    assertCondition(
        codemodManifest.exports?.['.']?.types === './dist/index.d.ts' &&
            codemodManifest.exports['.'].import === './dist/index.js' &&
            codemodManifest.exports['.'].default === './dist/index.js',
        'Codemod exports must align with the runtime and declaration entries.',
    );
    assertCondition(codemodManifest.sideEffects === false, 'Codemod must be side-effect free.');
    assertCondition(
        codemodManifest.publishConfig?.access === 'public' &&
            codemodManifest.publishConfig?.provenance === true,
        'Codemod publishing must require public access and npm provenance.',
    );

    if (packedFiles === null) return;
    assertCondition(
        !packedFiles.some((filePath) => filePath.startsWith('src/') || filePath.includes('/test')),
        'Codemod tarball must not contain source or test files.',
    );
    for (const requiredFile of REQUIRED_PACKED_FILES) {
        assertCondition(
            packedFiles.includes(requiredFile),
            `Codemod tarball is missing ${requiredFile}.`,
        );
    }
}
