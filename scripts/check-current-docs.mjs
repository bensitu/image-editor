/**
 * Verifies that current documentation uses the public v3 composition model.
 *
 * @module
 */

import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsRoot, '..');
const intentionalHistoricalPaths = new Map([
    ['CHANGELOG.md', 'versioned historical record'],
    ['docs/legacy-v1.html', 'clearly labelled legacy 1.x demonstration'],
    ['docs/js/legacy-v1.js', 'implementation used only by the labelled legacy page'],
    ['docs/migration-from-v2.md', 'paired 2.x input and 3.x migration examples'],
    ['docs/v2-maintenance-policy.md', 'published legacy branch policy'],
]);
const currentExtensions = /\.(?:html|js|md|mts|ts|tsx|vue)$/u;
const forbiddenCurrentPatterns = Object.freeze([
    [/\bnew\s+ImageEditor\s*\(/u, 'the removed monolithic constructor'],
    [/\bImageEditorOptions\b/u, 'the removed flat options type'],
    [
        /\b(?:bindMasksToImageTransform|bindAnnotationsToImageTransform|textAnnotationFlipBehavior)\b/u,
        'a removed flat transform-binding option',
    ],
    [
        /\b(?:defaultMaskWidth|defaultMosaicConfig|onMasksChanged|onAnnotationsChanged)\b/u,
        'a removed flat Feature option or callback',
    ],
    [
        /\beditor\.(?:createMask|mergeMasks|exportOverlayState|downloadImage)\s*\(/u,
        'a removed facade method',
    ],
]);

function assertCondition(condition, message) {
    if (!condition) throw new Error(message);
}

async function trackedFiles() {
    const { stdout } = await execFileAsync('git', ['ls-files', '-z'], {
        cwd: repositoryRoot,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
    });
    return stdout
        .split('\0')
        .filter(Boolean)
        .map((file) => file.replaceAll('\\', '/'));
}

function isCurrentDocumentation(file) {
    if (intentionalHistoricalPaths.has(file)) return false;
    if (!currentExtensions.test(file)) return false;
    return (
        file === 'README.md' ||
        file.startsWith('docs/') ||
        (file.startsWith('examples/') && !file.includes('/dist/'))
    );
}

async function verifyCurrentLanguage(files) {
    const currentFiles = files.filter(isCurrentDocumentation);
    for (const file of currentFiles) {
        const source = await readFile(path.join(repositoryRoot, file), 'utf8');
        for (const [pattern, description] of forbiddenCurrentPatterns) {
            assertCondition(!pattern.test(source), `${file} uses ${description}.`);
        }
    }
    return currentFiles.length;
}

async function verifyMarkdownLinks(files) {
    const tracked = new Set(files);
    let linkCount = 0;
    for (const file of files.filter((candidate) => candidate.endsWith('.md'))) {
        const source = await readFile(path.join(repositoryRoot, file), 'utf8');
        for (const match of source.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/gu)) {
            let target = match[1]?.trim() ?? '';
            if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1);
            target = target.split(/\s+["']/u)[0] ?? '';
            if (
                target.length === 0 ||
                target.startsWith('#') ||
                /^[a-z][a-z0-9+.-]*:/iu.test(target)
            ) {
                continue;
            }
            const relativeTarget = decodeURIComponent(target.split('#')[0] ?? '');
            if (relativeTarget.length === 0) continue;
            const normalized = path.posix.normalize(
                path.posix.join(path.posix.dirname(file), relativeTarget),
            );
            assertCondition(
                tracked.has(normalized) ||
                    files.some((candidate) => candidate.startsWith(`${normalized}/`)),
                `${file} links to missing repository file ${relativeTarget}.`,
            );
            linkCount += 1;
        }
    }
    return linkCount;
}

async function verifyCurrentDemoSurface() {
    const loader = await readFile(path.join(repositoryRoot, 'docs/js/demo-loader.js'), 'utf8');
    const pages = ['basic.html', 'annotation.html', 'mask-mosaic.html', 'integrated-editor.html'];
    for (const page of pages) {
        const source = await readFile(path.join(repositoryRoot, 'docs', page), 'utf8');
        assertCondition(
            source.includes('data-demo-page=') && source.includes('js/demo-loader.js'),
            `docs/${page} is not wired to the current shared demo runtime.`,
        );
    }
    assertCondition(
        loader.includes('ImageEditorFull') &&
            loader.includes('ImageEditorCore') &&
            loader.includes('composePlugins'),
        'The demo loader does not verify the v3 UMD composition surface.',
    );
    const demos = await readFile(path.join(repositoryRoot, 'docs/js/demo-pages.js'), 'utf8');
    assertCondition(
        demos.includes('createPluginPlan') &&
            demos.includes('overlayFoundationPlugin') &&
            !demos.includes('createFullPreset'),
        'Focused demo pages must install only their required Plugin plan.',
    );

    const legacyPage = await readFile(path.join(repositoryRoot, 'docs/legacy-v1.html'), 'utf8');
    assertCondition(
        legacyPage.includes('Legacy 1.x demonstration') &&
            legacyPage.includes('Do not copy its API usage'),
        'The legacy demo needs an explicit version and non-copying banner.',
    );
    const migration = await readFile(
        path.join(repositoryRoot, 'docs/migration-from-v2.md'),
        'utf8',
    );
    assertCondition(
        migration.includes('Migration source only') && migration.includes('Do not copy'),
        'The migration guide needs an explicit 2.x-source banner.',
    );
}

async function verifyCoreOptionsReference() {
    const publicTypes = await readFile(
        path.join(repositoryRoot, 'src/core-runtime/public-types.ts'),
        'utf8',
    );
    const interfaceBody =
        /export interface ImageEditorCoreOptions \{(?<body>[\s\S]*?)\n\}/u.exec(publicTypes)?.groups
            ?.body ?? '';
    const optionNames = [...interfaceBody.matchAll(/^\s+readonly\s+([A-Za-z0-9_]+)\??:/gmu)].map(
        (match) => match[1],
    );
    const optionsDoc = await readFile(path.join(repositoryRoot, 'docs/options.md'), 'utf8');
    for (const optionName of optionNames) {
        assertCondition(
            optionsDoc.includes(`\`${optionName}\``),
            `docs/options.md omits ImageEditorCoreOptions.${optionName}.`,
        );
    }
    assertCondition(
        optionsDoc.includes('Plugin responsibilities') &&
            optionsDoc.includes('Initial image Promise semantics') &&
            optionsDoc.includes('Shared raster resource policy'),
        'docs/options.md does not explain the Core/Plugin and resource-policy boundaries.',
    );
    return optionNames.length;
}

const files = await trackedFiles();
const [currentFileCount, localLinkCount, coreOptionCount] = await Promise.all([
    verifyCurrentLanguage(files),
    verifyMarkdownLinks(files),
    verifyCoreOptionsReference(),
]);
await verifyCurrentDemoSurface();

for (const historicalPath of intentionalHistoricalPaths.keys()) {
    await access(path.join(repositoryRoot, historicalPath));
}

console.log(
    `Current documentation check passed (${currentFileCount} current files, ` +
        `${intentionalHistoricalPaths.size} documented historical exceptions, ` +
        `${coreOptionCount} Core options, ${localLinkCount} local links).`,
);
