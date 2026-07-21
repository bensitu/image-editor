/** Creates and validates the tracked platform bundle budget. */

import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { hashNormalizedText } from './bundle-measurement-config.mjs';

const execFileAsync = promisify(execFile);
const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsRoot, '..');
const policyPath = path.join(repositoryRoot, 'config', 'bundle', 'platform-budget.json');
const measurementPath = path.join(
    repositoryRoot,
    'tests',
    'bundle',
    'baselines',
    'platform-anchor.json',
);
const fixtureNames = Object.freeze([
    'core-only',
    'core-sdk',
    'core-platform',
    'overlay-foundation',
    'platform-anchor',
    'third-party-watermark',
    'third-party-blur-region',
]);
const targetLimit = 49 * 1024;
const hardLimit = 50 * 1024;
const minimumHeadroom = 1024;

function assertCondition(condition, message) {
    if (!condition) throw new Error(message);
}

function canonicalize(value) {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value === null || typeof value !== 'object') return value;
    return Object.fromEntries(
        Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, child]) => [key, canonicalize(child)]),
    );
}

function canonicalText(value) {
    return `${JSON.stringify(canonicalize(value), null, 4)}\n`;
}

async function git(args) {
    const { stdout } = await execFileAsync('git', args, {
        cwd: repositoryRoot,
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
    });
    return stdout.trim();
}

async function fixtureDefinitions() {
    const definitions = {};
    for (const name of fixtureNames) {
        const relativePath = `tests/bundle/fixtures/${name}/index.mjs`;
        definitions[name] = Object.freeze({
            entry: relativePath,
            sha256: hashNormalizedText(
                await readFile(path.join(repositoryRoot, ...relativePath.split('/')), 'utf8'),
            ),
        });
    }
    return Object.freeze(definitions);
}

function inspectModules(measurement) {
    const anchor = measurement.fixtures['platform-anchor'];
    const modules = anchor.modules.map((moduleId) => moduleId.replaceAll('\\', '/'));
    const fabricModules = modules.filter((moduleId) =>
        /(?:^|\/)node_modules\/fabric(?:\/|$)/u.test(moduleId),
    );
    const testingModules = modules.filter(
        (moduleId) =>
            moduleId.includes('/testing/') ||
            moduleId.includes('plugin-conformance') ||
            moduleId.includes('responsibility-assertions'),
    );
    const referenceModules = modules.filter((moduleId) =>
        moduleId.startsWith('examples/reference-plugins/'),
    );
    const filtersModules = modules.filter((moduleId) =>
        moduleId.startsWith('dist/esm/plugins/filters/'),
    );
    const cropModules = modules.filter((moduleId) => moduleId.startsWith('dist/esm/plugins/crop/'));
    const mosaicModules = modules.filter((moduleId) =>
        moduleId.startsWith('dist/esm/plugins/mosaic/'),
    );
    const annotationFoundationModules = modules.filter((moduleId) =>
        moduleId.startsWith('dist/esm/foundations/annotation/'),
    );
    const annotationTextModules = modules.filter((moduleId) =>
        moduleId.startsWith('dist/esm/plugins/annotation-text/'),
    );
    const annotationShapeModules = modules.filter((moduleId) =>
        moduleId.startsWith('dist/esm/plugins/annotation-shape/'),
    );
    const annotationDrawModules = modules.filter((moduleId) =>
        moduleId.startsWith('dist/esm/plugins/annotation-draw/'),
    );
    const overlayStateModules = modules.filter((moduleId) =>
        moduleId.startsWith('dist/esm/plugins/overlay-state/'),
    );
    const domControlsModules = modules.filter((moduleId) =>
        moduleId.startsWith('dist/esm/plugins/dom-controls/'),
    );
    const presetModules = modules.filter((moduleId) => moduleId.startsWith('dist/esm/presets/'));
    const unknownModules = modules.filter(
        (moduleId) =>
            !moduleId.startsWith('dist/esm/') &&
            moduleId !== 'tests/bundle/fixtures/platform-anchor/index.mjs',
    );
    return Object.freeze({
        fabricModules,
        testingModules,
        referenceModules,
        filtersModules,
        cropModules,
        mosaicModules,
        annotationFoundationModules,
        annotationTextModules,
        annotationShapeModules,
        annotationDrawModules,
        overlayStateModules,
        domControlsModules,
        presetModules,
        unknownModules,
    });
}

function validateMeasurement(measurement) {
    assertCondition(measurement.schemaVersion === 1, 'Platform measurement schema is invalid.');
    for (const fixtureName of fixtureNames) {
        assertCondition(
            measurement.fixtures?.[fixtureName],
            `Platform measurement is missing ${fixtureName}.`,
        );
    }
    const anchor = measurement.fixtures['platform-anchor'];
    assertCondition(anchor.gzipBytes <= hardLimit, 'Platform anchor exceeds the hard limit.');
    assertCondition(anchor.gzipBytes <= targetLimit, 'Platform anchor exceeds the target limit.');
    assertCondition(
        hardLimit - anchor.gzipBytes >= minimumHeadroom,
        'Platform anchor does not preserve the required release headroom.',
    );
    const inspection = inspectModules(measurement);
    assertCondition(inspection.fabricModules.length === 0, 'Platform anchor bundles Fabric.');
    assertCondition(
        inspection.testingModules.length === 0,
        'Platform anchor includes testing code.',
    );
    assertCondition(
        inspection.referenceModules.length === 0,
        'Platform anchor includes a Reference Plugin.',
    );
    assertCondition(
        inspection.filtersModules.length === 0,
        'Platform anchor includes the Filters Plugin.',
    );
    assertCondition(
        inspection.cropModules.length === 0,
        'Platform anchor includes the Crop Plugin.',
    );
    assertCondition(
        inspection.mosaicModules.length === 0,
        'Platform anchor includes the Mosaic Plugin.',
    );
    assertCondition(
        inspection.annotationFoundationModules.length === 0,
        'Platform anchor includes Annotation Foundation.',
    );
    assertCondition(
        inspection.annotationTextModules.length === 0,
        'Platform anchor includes the Text Annotation Plugin.',
    );
    assertCondition(
        inspection.annotationShapeModules.length === 0,
        'Platform anchor includes the Shape Annotation Plugin.',
    );
    assertCondition(
        inspection.annotationDrawModules.length === 0,
        'Platform anchor includes the Draw Annotation Plugin.',
    );
    assertCondition(
        inspection.overlayStateModules.length === 0,
        'Platform anchor includes Overlay State.',
    );
    assertCondition(
        inspection.domControlsModules.length === 0,
        'Platform anchor includes DOM Controls.',
    );
    assertCondition(inspection.presetModules.length === 0, 'Platform anchor includes a Preset.');
    assertCondition(inspection.unknownModules.length === 0, 'Platform anchor has unknown modules.');
    return inspection;
}

async function createPolicy() {
    const measurement = JSON.parse(await readFile(measurementPath, 'utf8'));
    validateMeasurement(measurement);
    const commit = await git(['rev-parse', 'HEAD']);
    const tree = await git(['rev-parse', 'HEAD^{tree}']);
    assertCondition(
        measurement.metadata.gitCommit === commit,
        'Regenerate the platform measurement from the committed package artifact.',
    );
    const anchor = measurement.fixtures['platform-anchor'];
    const corePlatform = measurement.fixtures['core-platform'];
    const lockedBudget = Math.min(targetLimit, Math.ceil(anchor.gzipBytes * 1.1));
    return Object.freeze({
        schemaVersion: 1,
        source: Object.freeze({ commit, tree }),
        measurement: Object.freeze({
            path: 'tests/bundle/baselines/platform-anchor.json',
            sha256: hashNormalizedText(await readFile(measurementPath, 'utf8')),
            corePlatformGzipBytes: corePlatform.gzipBytes,
            overlayDeltaGzipBytes: anchor.gzipBytes - corePlatform.gzipBytes,
            platformAnchorGzipBytes: anchor.gzipBytes,
        }),
        budget: Object.freeze({
            targetGzipBytes: targetLimit,
            lockedGzipBytes: lockedBudget,
            hardLimitGzipBytes: hardLimit,
            minimumHeadroomGzipBytes: minimumHeadroom,
            maximumHeadroomRatio: 0.1,
        }),
        fixtures: await fixtureDefinitions(),
        toolchain: Object.freeze({
            node: measurement.metadata.nodeVersion,
            bundler: measurement.metadata.bundler,
            measurementConfigVersion: measurement.metadata.measurementConfigVersion,
            measurementConfigHash: measurement.metadata.measurementConfigHash,
        }),
        modulePolicy: Object.freeze({
            allowedPrefixes: Object.freeze(['dist/esm/', 'tests/bundle/fixtures/platform-anchor/']),
            fabricExternal: true,
            testingLeakageAllowed: 0,
            referencePluginLeakageAllowed: 0,
            filtersPluginLeakageAllowed: 0,
            cropPluginLeakageAllowed: 0,
            mosaicPluginLeakageAllowed: 0,
            annotationFoundationLeakageAllowed: 0,
            annotationTextLeakageAllowed: 0,
            annotationShapeLeakageAllowed: 0,
            annotationDrawLeakageAllowed: 0,
            overlayStatePluginLeakageAllowed: 0,
            domControlsPluginLeakageAllowed: 0,
            presetLeakageAllowed: 0,
            unknownModulesAllowed: 0,
        }),
    });
}

async function checkPolicy() {
    const policy = JSON.parse(await readFile(policyPath, 'utf8'));
    const measurementText = await readFile(measurementPath, 'utf8');
    const measurement = JSON.parse(measurementText);
    const inspection = validateMeasurement(measurement);
    assertCondition(policy.schemaVersion === 1, 'Platform budget schema is invalid.');
    assertCondition(
        (await git(['rev-parse', `${policy.source.commit}^{tree}`])) === policy.source.tree,
        'Platform budget source identity is invalid.',
    );
    assertCondition(
        measurement.metadata.gitCommit === policy.source.commit,
        'Platform measurement does not identify the locked source commit.',
    );
    assertCondition(
        hashNormalizedText(measurementText) === policy.measurement.sha256,
        'Platform measurement hash changed.',
    );
    assertCondition(
        canonicalText(await fixtureDefinitions()) === canonicalText(policy.fixtures),
        'Platform fixture definitions changed.',
    );
    const anchor = measurement.fixtures['platform-anchor'];
    const corePlatform = measurement.fixtures['core-platform'];
    assertCondition(
        policy.measurement.platformAnchorGzipBytes === anchor.gzipBytes &&
            policy.measurement.corePlatformGzipBytes === corePlatform.gzipBytes &&
            policy.measurement.overlayDeltaGzipBytes === anchor.gzipBytes - corePlatform.gzipBytes,
        'Platform measurements do not match the budget source.',
    );
    assertCondition(policy.budget.targetGzipBytes === targetLimit, 'Platform target changed.');
    assertCondition(policy.budget.hardLimitGzipBytes === hardLimit, 'Platform hard limit changed.');
    assertCondition(
        policy.budget.minimumHeadroomGzipBytes === minimumHeadroom,
        'Platform minimum headroom changed.',
    );
    assertCondition(
        policy.budget.lockedGzipBytes >= anchor.gzipBytes &&
            policy.budget.lockedGzipBytes <= targetLimit &&
            policy.budget.lockedGzipBytes <= Math.ceil(anchor.gzipBytes * 1.1),
        'Platform locked budget is outside the approved headroom.',
    );
    assertCondition(policy.modulePolicy.fabricExternal === true, 'Fabric external policy changed.');
    assertCondition(
        policy.modulePolicy.testingLeakageAllowed === 0 && inspection.testingModules.length === 0,
        'Testing leakage policy changed.',
    );
    assertCondition(
        policy.modulePolicy.referencePluginLeakageAllowed === 0 &&
            inspection.referenceModules.length === 0,
        'Reference Plugin leakage policy changed.',
    );
    assertCondition(
        policy.modulePolicy.filtersPluginLeakageAllowed === 0 &&
            inspection.filtersModules.length === 0,
        'Filters Plugin leakage policy changed.',
    );
    assertCondition(
        policy.modulePolicy.cropPluginLeakageAllowed === 0 && inspection.cropModules.length === 0,
        'Crop Plugin leakage policy changed.',
    );
    assertCondition(
        policy.modulePolicy.mosaicPluginLeakageAllowed === 0 &&
            inspection.mosaicModules.length === 0,
        'Mosaic Plugin leakage policy changed.',
    );
    assertCondition(
        policy.modulePolicy.annotationFoundationLeakageAllowed === 0 &&
            inspection.annotationFoundationModules.length === 0,
        'Annotation Foundation leakage policy changed.',
    );
    assertCondition(
        policy.modulePolicy.annotationTextLeakageAllowed === 0 &&
            inspection.annotationTextModules.length === 0,
        'Text Annotation leakage policy changed.',
    );
    assertCondition(
        policy.modulePolicy.annotationShapeLeakageAllowed === 0 &&
            inspection.annotationShapeModules.length === 0,
        'Shape Annotation leakage policy changed.',
    );
    assertCondition(
        policy.modulePolicy.annotationDrawLeakageAllowed === 0 &&
            inspection.annotationDrawModules.length === 0,
        'Draw Annotation leakage policy changed.',
    );
    assertCondition(
        policy.modulePolicy.overlayStatePluginLeakageAllowed === 0 &&
            inspection.overlayStateModules.length === 0,
        'Overlay State leakage policy changed.',
    );
    assertCondition(
        policy.modulePolicy.domControlsPluginLeakageAllowed === 0 &&
            inspection.domControlsModules.length === 0,
        'DOM Controls leakage policy changed.',
    );
    assertCondition(
        policy.modulePolicy.presetLeakageAllowed === 0 && inspection.presetModules.length === 0,
        'Preset leakage policy changed.',
    );
    assertCondition(
        policy.modulePolicy.unknownModulesAllowed === 0 && inspection.unknownModules.length === 0,
        'Unknown module policy changed.',
    );
    console.log(
        `Platform budget passed: ${anchor.gzipBytes} gzip bytes <= ${policy.budget.lockedGzipBytes}.`,
    );
}

const [mode = '--check'] = process.argv.slice(2);
assertCondition(['--check', '--generate'].includes(mode), `Unknown mode: ${mode}.`);
if (mode === '--generate') {
    const policy = await createPolicy();
    await mkdir(path.dirname(policyPath), { recursive: true });
    await writeFile(policyPath, canonicalText(policy), 'utf8');
    console.log('Wrote config/bundle/platform-budget.json.');
} else {
    await checkPolicy();
}
