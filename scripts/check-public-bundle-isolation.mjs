/**
 * Validates public-entry bundle attribution and feature isolation.
 *
 * @module
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsDirectory, '..');
const measurementPath = path.join(
    repositoryRoot,
    'tests',
    'bundle',
    'baselines',
    'platform-anchor.json',
);
const expectedFixtures = [
    'sdk/core-only',
    'sdk/sdk-runtime',
    'sdk/testing',
    'sdk/migrate-v2',
    'sdk/core-transform',
    'sdk/core-history',
    'sdk/core-filters',
    'sdk/core-crop',
    'sdk/core-mosaic',
    'sdk/core-history-overlay-mask-filters-crop',
    'sdk/core-history-overlay-mask-filters-mosaic',
    'sdk/core-overlay',
    'sdk/core-mask',
    'sdk/core-transform-history-overlay',
    'sdk/core-annotation',
    'sdk/core-annotation-text',
    'sdk/core-annotation-shape',
    'sdk/core-annotation-draw',
    'sdk/core-transform-history-overlay-annotation-text',
    'sdk/core-transform-history-overlay-annotation-shape',
    'sdk/core-transform-history-overlay-annotation-draw',
    'sdk/core-transform-history-overlay-annotation-all',
    'sdk/overlay-state-only',
    'sdk/dom-controls-only',
    'preset-minimal',
    'preset-minimal-history',
    'preset-redaction',
    'preset-annotation',
    'preset-full',
    'preset-full-dom',
];
const runtimeFixtures = expectedFixtures.filter((name) => name !== 'sdk/testing');
const applicationRuntimeFixtures = runtimeFixtures.filter((name) => name !== 'sdk/migrate-v2');
const featureCategories = new Set([
    'HISTORY_PLUGIN',
    'MASK_PLUGIN',
    'MASK_SHARED',
    'OVERLAY_FOUNDATION',
    'TRANSFORM_PLUGIN',
    'FILTERS_PLUGIN',
    'CROP_PLUGIN',
    'MOSAIC_PLUGIN',
    'ANNOTATION_FOUNDATION',
    'ANNOTATION_TEXT',
    'ANNOTATION_SHAPE',
    'ANNOTATION_DRAW',
    'OVERLAY_STATE',
    'DOM_CONTROLS',
]);

function classifyModule(moduleName) {
    if (moduleName === 'commonjsHelpers.js') return 'BUNDLER_HELPER';
    if (moduleName.startsWith('tests/bundle/fixtures/sdk/')) return 'MEASUREMENT_FIXTURE';
    if (moduleName.startsWith('tests/bundle/fixtures/preset-')) return 'MEASUREMENT_FIXTURE';
    if (moduleName.startsWith('dist/esm/plugin-kernel/')) return 'SDK_KERNEL';
    if (moduleName.startsWith('dist/esm/sdk/')) return 'SDK';
    if (moduleName.startsWith('dist/esm/testing/')) return 'TESTING';
    if (moduleName.startsWith('dist/esm/migrate-v2/')) return 'MIGRATION';
    if (moduleName.startsWith('dist/esm/plugins/transform/')) return 'TRANSFORM_PLUGIN';
    if (moduleName.startsWith('dist/esm/plugins/history/')) return 'HISTORY_PLUGIN';
    if (moduleName.startsWith('dist/esm/plugins/filters/')) return 'FILTERS_PLUGIN';
    if (moduleName.startsWith('dist/esm/plugins/crop/')) return 'CROP_PLUGIN';
    if (moduleName.startsWith('dist/esm/plugins/mosaic/')) return 'MOSAIC_PLUGIN';
    if (moduleName.startsWith('dist/esm/plugins/mask/')) return 'MASK_PLUGIN';
    if (moduleName.startsWith('dist/esm/plugins/annotation-text/')) return 'ANNOTATION_TEXT';
    if (moduleName.startsWith('dist/esm/plugins/annotation-shape/')) return 'ANNOTATION_SHAPE';
    if (moduleName.startsWith('dist/esm/plugins/annotation-draw/')) return 'ANNOTATION_DRAW';
    if (moduleName.startsWith('dist/esm/plugins/overlay-state/')) return 'OVERLAY_STATE';
    if (moduleName.startsWith('dist/esm/plugins/dom-controls/')) return 'DOM_CONTROLS';
    if (moduleName === 'dist/esm/presets/preset-support.js') return 'PRESET_SUPPORT';
    if (moduleName.startsWith('dist/esm/presets/minimal/')) return 'PRESET_MINIMAL';
    if (moduleName.startsWith('dist/esm/presets/redaction/')) return 'PRESET_REDACTION';
    if (moduleName.startsWith('dist/esm/presets/annotation/')) return 'PRESET_ANNOTATION';
    if (moduleName.startsWith('dist/esm/presets/full/')) return 'PRESET_FULL';
    if (moduleName.startsWith('dist/esm/foundations/annotation/')) {
        return 'ANNOTATION_FOUNDATION';
    }
    if (moduleName.startsWith('dist/esm/foundations/overlay/')) return 'OVERLAY_FOUNDATION';
    if (moduleName.startsWith('dist/esm/mask/')) return 'MASK_SHARED';
    if (moduleName.startsWith('dist/esm/fabric/')) return 'PUBLIC_SAFE_UTILITY';
    if (moduleName.startsWith('dist/esm/utils/')) return 'SHARED_UTILITY';
    if (
        moduleName.startsWith('dist/esm/core-runtime/') ||
        moduleName.startsWith('dist/esm/core/') ||
        moduleName === 'dist/esm/image/layout-manager.js'
    ) {
        return 'CORE';
    }
    return 'UNKNOWN';
}

function duplicateModules(modules) {
    const counts = new Map();
    for (const moduleName of modules) counts.set(moduleName, (counts.get(moduleName) ?? 0) + 1);
    return [...counts]
        .filter(([, count]) => count > 1)
        .map(([moduleName, count]) => Object.freeze({ module: moduleName, count }))
        .sort((left, right) => left.module.localeCompare(right.module));
}

function assertCondition(condition, message) {
    if (!condition) throw new Error(message);
}

export async function inspectPublicBundleIsolation() {
    const measurement = JSON.parse(await readFile(measurementPath, 'utf8'));
    const fixtures = {};
    let unknownModules = 0;
    let testingRuntimeLeakage = 0;
    let featureCoreLeakage = 0;
    let fabricBundledModules = 0;
    let unattributedDuplicateHelpers = 0;

    for (const name of expectedFixtures) {
        const fixture = measurement.fixtures?.[name];
        assertCondition(fixture, `Bundle measurement is missing fixture "${name}".`);
        const classifiedModules = fixture.modules.map((moduleName) =>
            Object.freeze({ module: moduleName, category: classifyModule(moduleName) }),
        );
        const unknown = classifiedModules.filter((entry) => entry.category === 'UNKNOWN');
        const duplicates = duplicateModules(fixture.modules);
        const attributedDuplicates = [];
        const unattributedDuplicates = duplicates;
        const categories = new Set(classifiedModules.map((entry) => entry.category));
        const bundledFabric = fixture.modules.filter((moduleName) =>
            moduleName.startsWith('node_modules/fabric/'),
        );
        const testingLeakage =
            name === 'sdk/testing'
                ? []
                : classifiedModules.filter((entry) => entry.category === 'TESTING');
        const coreFeatures =
            name === 'sdk/core-only'
                ? classifiedModules.filter((entry) => featureCategories.has(entry.category))
                : [];

        unknownModules += unknown.length;
        testingRuntimeLeakage += testingLeakage.length;
        featureCoreLeakage += coreFeatures.length;
        fabricBundledModules += bundledFabric.length;
        unattributedDuplicateHelpers += unattributedDuplicates.length;
        assertCondition(
            fixture.externalDependencies.every((dependency) => dependency === 'fabric'),
            `${name} records an unexpected external dependency.`,
        );

        fixtures[name] = Object.freeze({
            rawBytes: fixture.rawBytes,
            minifiedBytes: fixture.minifiedBytes,
            gzipBytes: fixture.gzipBytes,
            brotliBytes: fixture.brotliBytes,
            moduleCount: fixture.moduleCount,
            categories: Object.freeze([...categories].sort()),
            externalDependencies: Object.freeze([...fixture.externalDependencies]),
            unknownModules: unknown.length,
            testingRuntimeLeakage: testingLeakage.length,
            featureCoreLeakage: coreFeatures.length,
            fabricBundledModules: bundledFabric.length,
            attributedDuplicateHelpers: Object.freeze(attributedDuplicates),
            unattributedDuplicateHelpers: Object.freeze(unattributedDuplicates),
        });
    }

    for (const name of runtimeFixtures) {
        assertCondition(
            fixtures[name].testingRuntimeLeakage === 0,
            `${name} contains Testing or Conformance modules.`,
        );
    }
    for (const name of applicationRuntimeFixtures) {
        assertCondition(
            fixtures[name].categories.includes('MIGRATION') === false,
            `${name} contains the isolated migration parser.`,
        );
    }
    assertCondition(
        fixtures['sdk/migrate-v2'].categories.includes('MIGRATION'),
        'Migration bundle fixture does not contain the migration parser.',
    );
    assertCondition(
        fixtures['sdk/migrate-v2'].categories.filter((category) =>
            [
                'CORE',
                'SDK',
                'SDK_KERNEL',
                'TESTING',
                'PRESET_SUPPORT',
                'PRESET_MINIMAL',
                'PRESET_REDACTION',
                'PRESET_ANNOTATION',
                'PRESET_FULL',
                ...featureCategories,
            ].includes(category),
        ).length === 0,
        'Migration bundle contains Core, SDK, Preset, Testing, or Feature runtime modules.',
    );
    assertCondition(featureCoreLeakage === 0, 'Core-only bundle contains Feature modules.');
    assertCondition(
        fixtures['sdk/core-filters'].categories.includes('FILTERS_PLUGIN'),
        'Filters bundle fixture does not contain the Filters Plugin.',
    );
    assertCondition(
        fixtures['sdk/core-filters'].categories.filter(
            (category) => featureCategories.has(category) && category !== 'FILTERS_PLUGIN',
        ).length === 0,
        'Filters bundle fixture contains another Feature implementation.',
    );
    assertCondition(
        fixtures['sdk/core-crop'].categories.includes('CROP_PLUGIN'),
        'Crop bundle fixture does not contain the Crop Plugin.',
    );
    assertCondition(
        fixtures['sdk/core-crop'].categories.filter(
            (category) =>
                featureCategories.has(category) &&
                category !== 'CROP_PLUGIN' &&
                category !== 'OVERLAY_FOUNDATION',
        ).length === 0,
        'Crop-only bundle fixture contains another concrete Feature implementation.',
    );
    assertCondition(
        measurement.fixtures['sdk/core-crop'].modules.filter(
            (moduleName) =>
                moduleName.startsWith('dist/esm/foundations/overlay/') &&
                moduleName !== 'dist/esm/foundations/overlay/index.js',
        ).length === 0,
        'Crop-only bundle fixture contains Overlay implementation modules.',
    );
    assertCondition(
        fixtures['sdk/core-mosaic'].categories.includes('MOSAIC_PLUGIN'),
        'Mosaic bundle fixture does not contain the Mosaic Plugin.',
    );
    assertCondition(
        fixtures['sdk/core-mosaic'].categories.filter(
            (category) => featureCategories.has(category) && category !== 'MOSAIC_PLUGIN',
        ).length === 0,
        'Mosaic-only bundle fixture contains another Feature implementation.',
    );
    assertCondition(
        fixtures['sdk/overlay-state-only'].categories.includes('OVERLAY_STATE'),
        'Overlay State bundle fixture does not contain Overlay State.',
    );
    assertCondition(
        fixtures['sdk/overlay-state-only'].categories.filter(
            (category) =>
                featureCategories.has(category) &&
                category !== 'OVERLAY_STATE' &&
                category !== 'OVERLAY_FOUNDATION',
        ).length === 0,
        'Overlay State bundle fixture contains a concrete Feature implementation.',
    );
    assertCondition(
        fixtures['sdk/dom-controls-only'].categories.includes('DOM_CONTROLS'),
        'DOM Controls bundle fixture does not contain DOM Controls.',
    );
    assertCondition(
        fixtures['sdk/dom-controls-only'].categories.filter(
            (category) => featureCategories.has(category) && category !== 'DOM_CONTROLS',
        ).length === 0,
        'DOM Controls bundle fixture contains a concrete Feature implementation.',
    );
    for (const name of ['preset-minimal', 'preset-minimal-history']) {
        const categories = fixtures[name].categories;
        assertCondition(categories.includes('PRESET_MINIMAL'), `${name} is missing its Preset.`);
        assertCondition(categories.includes('TRANSFORM_PLUGIN'), `${name} is missing Transform.`);
        assertCondition(
            categories.filter((category) =>
                [
                    'MASK_PLUGIN',
                    'FILTERS_PLUGIN',
                    'CROP_PLUGIN',
                    'MOSAIC_PLUGIN',
                    'ANNOTATION_FOUNDATION',
                    'ANNOTATION_TEXT',
                    'ANNOTATION_SHAPE',
                    'ANNOTATION_DRAW',
                    'OVERLAY_STATE',
                    'DOM_CONTROLS',
                ].includes(category),
            ).length === 0,
            `${name} contains an excluded Feature or DOM Controls.`,
        );
    }
    assertCondition(
        fixtures['preset-minimal-history'].categories.includes('HISTORY_PLUGIN'),
        'History-enabled Minimal Preset is missing History.',
    );
    for (const expected of [
        'PRESET_REDACTION',
        'TRANSFORM_PLUGIN',
        'HISTORY_PLUGIN',
        'OVERLAY_FOUNDATION',
        'MASK_PLUGIN',
        'FILTERS_PLUGIN',
        'CROP_PLUGIN',
        'MOSAIC_PLUGIN',
        'OVERLAY_STATE',
    ]) {
        assertCondition(
            fixtures['preset-redaction'].categories.includes(expected),
            `Redaction Preset is missing ${expected}.`,
        );
    }
    assertCondition(
        fixtures['preset-redaction'].categories.filter((category) =>
            [
                'ANNOTATION_FOUNDATION',
                'ANNOTATION_TEXT',
                'ANNOTATION_SHAPE',
                'ANNOTATION_DRAW',
                'DOM_CONTROLS',
            ].includes(category),
        ).length === 0,
        'Redaction Preset contains Annotation or DOM Controls.',
    );
    for (const expected of [
        'PRESET_ANNOTATION',
        'TRANSFORM_PLUGIN',
        'HISTORY_PLUGIN',
        'OVERLAY_FOUNDATION',
        'ANNOTATION_FOUNDATION',
        'ANNOTATION_TEXT',
        'ANNOTATION_SHAPE',
        'ANNOTATION_DRAW',
        'OVERLAY_STATE',
    ]) {
        assertCondition(
            fixtures['preset-annotation'].categories.includes(expected),
            `Annotation Preset is missing ${expected}.`,
        );
    }
    assertCondition(
        fixtures['preset-annotation'].categories.filter((category) =>
            [
                'MASK_PLUGIN',
                'FILTERS_PLUGIN',
                'CROP_PLUGIN',
                'MOSAIC_PLUGIN',
                'DOM_CONTROLS',
            ].includes(category),
        ).length === 0,
        'Annotation Preset contains an excluded Feature or DOM Controls.',
    );
    const fullFeatures = [
        'TRANSFORM_PLUGIN',
        'HISTORY_PLUGIN',
        'OVERLAY_FOUNDATION',
        'MASK_PLUGIN',
        'FILTERS_PLUGIN',
        'CROP_PLUGIN',
        'MOSAIC_PLUGIN',
        'ANNOTATION_FOUNDATION',
        'ANNOTATION_TEXT',
        'ANNOTATION_SHAPE',
        'ANNOTATION_DRAW',
        'OVERLAY_STATE',
    ];
    for (const name of ['preset-full', 'preset-full-dom']) {
        assertCondition(
            fixtures[name].categories.includes('PRESET_FULL'),
            `${name} is missing its Preset.`,
        );
        for (const expected of fullFeatures) {
            assertCondition(
                fixtures[name].categories.includes(expected),
                `${name} is missing ${expected}.`,
            );
        }
    }
    assertCondition(
        fixtures['preset-full'].categories.includes('DOM_CONTROLS') === false,
        'Full Preset contains DOM Controls by default.',
    );
    assertCondition(
        fixtures['preset-full-dom'].categories.includes('DOM_CONTROLS'),
        'DOM-enabled Full Preset is missing DOM Controls.',
    );
    assertCondition(
        fixtures['sdk/core-annotation'].categories.includes('ANNOTATION_FOUNDATION'),
        'Annotation bundle fixture does not contain Annotation Foundation.',
    );
    assertCondition(
        fixtures['sdk/core-annotation'].categories.filter((category) =>
            ['ANNOTATION_TEXT', 'ANNOTATION_SHAPE', 'ANNOTATION_DRAW', 'MASK_PLUGIN'].includes(
                category,
            ),
        ).length === 0,
        'Annotation Foundation bundle contains a concrete Annotation Feature or Mask.',
    );
    for (const [name, ownCategory] of [
        ['sdk/core-annotation-text', 'ANNOTATION_TEXT'],
        ['sdk/core-annotation-shape', 'ANNOTATION_SHAPE'],
        ['sdk/core-annotation-draw', 'ANNOTATION_DRAW'],
    ]) {
        const categories = fixtures[name].categories;
        assertCondition(categories.includes(ownCategory), `${name} is missing ${ownCategory}.`);
        assertCondition(
            categories.filter(
                (category) =>
                    [
                        'ANNOTATION_TEXT',
                        'ANNOTATION_SHAPE',
                        'ANNOTATION_DRAW',
                        'MASK_PLUGIN',
                    ].includes(category) && category !== ownCategory,
            ).length === 0,
            `${name} contains a sibling Annotation Feature or Mask.`,
        );
    }
    for (const [name, ownCategory] of [
        ['sdk/core-transform-history-overlay-annotation-text', 'ANNOTATION_TEXT'],
        ['sdk/core-transform-history-overlay-annotation-shape', 'ANNOTATION_SHAPE'],
        ['sdk/core-transform-history-overlay-annotation-draw', 'ANNOTATION_DRAW'],
    ]) {
        const categories = fixtures[name].categories;
        for (const expected of [
            ownCategory,
            'ANNOTATION_FOUNDATION',
            'HISTORY_PLUGIN',
            'OVERLAY_FOUNDATION',
            'TRANSFORM_PLUGIN',
        ]) {
            assertCondition(categories.includes(expected), `${name} is missing ${expected}.`);
        }
        assertCondition(
            categories.filter(
                (category) =>
                    [
                        'ANNOTATION_TEXT',
                        'ANNOTATION_SHAPE',
                        'ANNOTATION_DRAW',
                        'MASK_PLUGIN',
                    ].includes(category) && category !== ownCategory,
            ).length === 0,
            `${name} contains a sibling Annotation Feature or Mask.`,
        );
    }
    for (const expected of [
        'ANNOTATION_FOUNDATION',
        'ANNOTATION_TEXT',
        'ANNOTATION_SHAPE',
        'ANNOTATION_DRAW',
        'HISTORY_PLUGIN',
        'OVERLAY_FOUNDATION',
        'TRANSFORM_PLUGIN',
    ]) {
        assertCondition(
            fixtures['sdk/core-transform-history-overlay-annotation-all'].categories.includes(
                expected,
            ),
            `Combined Annotation bundle fixture is missing ${expected}.`,
        );
    }
    assertCondition(
        fixtures['sdk/core-transform-history-overlay-annotation-all'].categories.includes(
            'MASK_PLUGIN',
        ) === false,
        'Combined Annotation bundle fixture contains Mask.',
    );
    for (const [name, ownCategory] of [
        ['sdk/core-history-overlay-mask-filters-crop', 'CROP_PLUGIN'],
        ['sdk/core-history-overlay-mask-filters-mosaic', 'MOSAIC_PLUGIN'],
    ]) {
        const categories = fixtures[name].categories;
        for (const expected of [
            ownCategory,
            'HISTORY_PLUGIN',
            'OVERLAY_FOUNDATION',
            'MASK_PLUGIN',
            'FILTERS_PLUGIN',
        ]) {
            assertCondition(categories.includes(expected), `${name} is missing ${expected}.`);
        }
        assertCondition(
            categories.filter(
                (category) =>
                    featureCategories.has(category) &&
                    ![
                        ownCategory,
                        'HISTORY_PLUGIN',
                        'OVERLAY_FOUNDATION',
                        'MASK_PLUGIN',
                        'MASK_SHARED',
                        'FILTERS_PLUGIN',
                    ].includes(category),
            ).length === 0,
            `${name} contains an unexpected Feature implementation.`,
        );
    }
    assertCondition(unknownModules === 0, 'Bundle module classification contains UNKNOWN entries.');
    assertCondition(fabricBundledModules === 0, 'Fabric was bundled instead of externalized.');
    assertCondition(
        unattributedDuplicateHelpers === 0,
        'Bundle contains an unattributed duplicate helper.',
    );

    return Object.freeze({
        schemaVersion: 1,
        result: 'PASS',
        measurement: path.relative(repositoryRoot, measurementPath).replaceAll('\\', '/'),
        fixtures: Object.freeze(fixtures),
        summary: Object.freeze({
            fixturesMeasured: expectedFixtures.length,
            featureCoreLeakage,
            testingRuntimeLeakage,
            conformancePluginRuntimeLeakage: testingRuntimeLeakage,
            fabricBundledModules,
            unattributedDuplicateHelpers,
            unknownModules,
        }),
    });
}

async function main() {
    if ((process.argv[2] ?? '--check') !== '--check' || process.argv.length > 3) {
        throw new Error('Use --check.');
    }
    const result = await inspectPublicBundleIsolation();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    main().catch((error) => {
        process.stderr.write(`${error.stack ?? error}\n`);
        process.exitCode = 1;
    });
}
