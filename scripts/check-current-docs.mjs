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

import { MODULAR_UMD_MODULES } from '../config/bundle/modular-umd.mjs';
import { LEGACY_DEMO_CDN_ASSETS, LEGACY_DEMO_CSP } from '../config/docs/legacy-demo-security.mjs';

const execFileAsync = promisify(execFile);
const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsRoot, '..');
const intentionalHistoricalPaths = new Map([
    ['CHANGELOG.md', 'versioned historical record'],
    ['docs/legacy-v1.html', 'clearly labelled legacy 1.x demonstration'],
    ['docs/js/legacy-v1.js', 'implementation used only by the labelled legacy page'],
    ['docs/js/legacy-theme.js', 'theme initialization used only by the labelled legacy page'],
    ['docs/migration-from-v2.md', 'paired 2.x input and 3.x migration examples'],
    ['docs/v2-maintenance-policy.md', 'published legacy branch policy'],
]);
const currentExtensions = /\.(?:html|js|md|mts|ts|tsx|vue)$/u;
const modularDemoCsp =
    "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self'; " +
    "img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; " +
    "worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'";
const forbiddenCurrentPatterns = Object.freeze([
    [/\bnew\s+ImageEditor\s*\(/u, 'the removed monolithic constructor'],
    [/\bImageEditorOptions\b/u, 'the removed flat options type'],
    [/@bensitu\/image-editor@latest\b/u, 'a mutable latest Image Editor package reference'],
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

async function verifyCurrentDemoSurface(files) {
    const loader = await readFile(path.join(repositoryRoot, 'docs/js/demo-loader.js'), 'utf8');
    const demoPlans = new Map([
        [
            'index.html',
            ['overlay', 'annotation', 'filters', 'mask', 'annotation-text', 'annotation-shape'],
        ],
        ['basic.html', ['overlay', 'transform', 'history', 'filters', 'crop']],
        [
            'annotation.html',
            [
                'overlay',
                'annotation',
                'history',
                'annotation-text',
                'annotation-shape',
                'annotation-draw',
            ],
        ],
        ['mask-mosaic.html', ['overlay', 'mask', 'mosaic']],
        [
            'integrated-editor.html',
            [
                'overlay',
                'annotation',
                'transform',
                'history',
                'mask',
                'annotation-text',
                'annotation-shape',
                'annotation-draw',
            ],
        ],
    ]);
    const pluginDefinitions = new Map(
        MODULAR_UMD_MODULES.filter(({ id }) => id !== 'core').map((definition) => [
            definition.id,
            definition,
        ]),
    );
    const discoveredPages = [];
    for (const file of files.filter((candidate) => /^docs\/[^/]+\.html$/u.test(candidate))) {
        const source = await readFile(path.join(repositoryRoot, file), 'utf8');
        if (source.includes('js/demo-loader.js')) discoveredPages.push(path.posix.basename(file));
    }
    assertCondition(
        discoveredPages.sort().join('\n') === [...demoPlans.keys()].sort().join('\n'),
        'Every HTML page using the modular demo loader must have a reviewed Plugin plan and CSP.',
    );

    for (const [page, expectedPluginIds] of demoPlans) {
        const source = await readFile(path.join(repositoryRoot, 'docs', page), 'utf8');
        assertCondition(
            source.includes('data-demo-page=') &&
                source.includes('js/demo-loader.js') &&
                source.includes('data-demo-plugins='),
            `docs/${page} is not wired to the current shared demo runtime.`,
        );
        const cspMatches = [
            ...source.matchAll(
                /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"\s*\/?>/gu,
            ),
        ];
        assertCondition(
            cspMatches.length === 1 && cspMatches[0]?.[1] === modularDemoCsp,
            `docs/${page} must declare the reviewed modular demo Content Security Policy.`,
        );
        const pluginAttribute = source.match(/\bdata-demo-plugins="([^"]+)"/u);
        const pluginIds = pluginAttribute?.[1]?.trim().split(/\s+/u) ?? [];
        assertCondition(
            pluginIds.join(' ') === expectedPluginIds.join(' '),
            `docs/${page} must declare the reviewed modular Plugin plan: ${expectedPluginIds.join(
                ', ',
            )}.`,
        );

        const loaded = new Set();
        for (const pluginId of pluginIds) {
            const definition = pluginDefinitions.get(pluginId);
            assertCondition(
                definition !== undefined,
                `docs/${page} declares unknown modular Plugin ${pluginId}.`,
            );
            const missingDependencies = definition.dependencies.filter(
                (dependency) => dependency !== 'core' && !loaded.has(dependency),
            );
            assertCondition(
                missingDependencies.length === 0,
                `docs/${page} loads ${pluginId} before ${missingDependencies.join(', ')}.`,
            );
            loaded.add(pluginId);
        }
    }
    assertCondition(
        loader.includes('image-editor.core.umd.min.js') &&
            loader.includes('image-editor.plugin.${pluginId}.umd.min.js') &&
            loader.includes("'../dist/umd'") &&
            loader.includes("'./vendor/image-editor/umd'") &&
            loader.includes('same-origin, same-commit UMD assets') &&
            loader.includes('ImageEditorPlugins') &&
            loader.includes('ImageEditorCore') &&
            loader.includes('composePlugins') &&
            !loader.includes('@bensitu/image-editor@latest') &&
            !loader.includes('ImageEditorFull') &&
            !loader.includes('image-editor.full'),
        'The demo loader must use same-version assets and verify only the v3 modular UMD composition surface.',
    );
    const demos = await readFile(path.join(repositoryRoot, 'docs/js/demo-pages.js'), 'utf8');
    const landing = await readFile(path.join(repositoryRoot, 'docs/js/landing-studio.js'), 'utf8');
    assertCondition(
        demos.includes('createPluginPlan') &&
            demos.includes('overlayFoundationPlugin') &&
            demos.includes('plugins.Transform.transformPlugin') &&
            landing.includes('plugins.Filters.filtersPlugin') &&
            !demos.includes('ImageEditorFull') &&
            !landing.includes('ImageEditorFull') &&
            !demos.includes('createFullPreset') &&
            !landing.includes('createFullPreset'),
        'Current demo pages must install factories from their selected modular Plugin globals.',
    );

    const legacyPage = await readFile(path.join(repositoryRoot, 'docs/legacy-v1.html'), 'utf8');
    assertCondition(
        legacyPage.includes('Legacy 1.x demonstration') &&
            legacyPage.includes('Do not copy its API usage'),
        'The legacy demo needs an explicit version and non-copying banner.',
    );
    const legacyCsp =
        /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"\s*\/?>/u.exec(
            legacyPage,
        )?.[1];
    assertCondition(
        legacyCsp === LEGACY_DEMO_CSP &&
            legacyPage.includes('<script src="js/legacy-theme.js"></script>') &&
            !/<script(?![^>]*\bsrc=)[^>]*>/iu.test(legacyPage),
        'The Legacy demo must use its reviewed CSP and external theme initialization.',
    );
    for (const asset of LEGACY_DEMO_CDN_ASSETS) {
        const urlIndex = legacyPage.indexOf(asset.url);
        const tagStart = legacyPage.lastIndexOf('<', urlIndex);
        const tagEnd = legacyPage.indexOf('>', urlIndex);
        const tag =
            urlIndex >= 0 && tagStart >= 0 && tagEnd > urlIndex
                ? legacyPage.slice(tagStart, tagEnd + 1)
                : '';
        assertCondition(
            tag.includes(`integrity="${asset.integrity}"`) &&
                tag.includes('crossorigin="anonymous"'),
            `The Legacy demo must declare verified integrity for ${asset.url}.`,
        );
    }
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

async function verifyModularUmdDocumentation() {
    const source = (
        await readFile(path.join(repositoryRoot, 'docs/modular-umd.md'), 'utf8')
    ).replaceAll('\r\n', '\n');
    const startMarker = '<!-- modular-umd-registry:start -->';
    const endMarker = '<!-- modular-umd-registry:end -->';
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker);
    assertCondition(
        start >= 0 && end > start,
        'docs/modular-umd.md omits the checked registry table markers.',
    );
    const actualRows = source
        .slice(start + startMarker.length, end)
        .split('\n')
        .filter((line) => /^\|\s*`/u.test(line))
        .map((line) =>
            line
                .split('|')
                .slice(1, -1)
                .map((cell) => cell.trim()),
        );
    const expectedRows = MODULAR_UMD_MODULES.map(({ dependencies, globalName, id }) => [
        `\`${id}\``,
        `\`${globalName}\``,
        dependencies.map((dependency) => `\`${dependency}\``).join(', '),
    ]);
    assertCondition(
        JSON.stringify(actualRows) === JSON.stringify(expectedRows),
        'docs/modular-umd.md dependency rows do not match the UMD module registry.',
    );
    assertCondition(
        source.includes('mutually exclusive') &&
            source.includes('exact same `@bensitu/image-editor` package version'),
        'docs/modular-umd.md omits the mode-isolation or version-consistency rule.',
    );
    return MODULAR_UMD_MODULES.length;
}

const files = await trackedFiles();
const [currentFileCount, localLinkCount, coreOptionCount, modularUmdModuleCount] =
    await Promise.all([
        verifyCurrentLanguage(files),
        verifyMarkdownLinks(files),
        verifyCoreOptionsReference(),
        verifyModularUmdDocumentation(),
    ]);
await verifyCurrentDemoSurface(files);

for (const historicalPath of intentionalHistoricalPaths.keys()) {
    await access(path.join(repositoryRoot, historicalPath));
}

console.log(
    `Current documentation check passed (${currentFileCount} current files, ` +
        `${intentionalHistoricalPaths.size} documented historical exceptions, ` +
        `${coreOptionCount} Core options, ${modularUmdModuleCount} Modular UMD modules, ` +
        `${localLinkCount} local links).`,
);
