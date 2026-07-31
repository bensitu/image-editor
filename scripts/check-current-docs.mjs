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
const modularDemoLocalFabricUrl = '../node_modules/fabric/dist/index.min.js';
const modularDemoHostedFabricUrl = 'https://cdn.jsdelivr.net/npm/fabric@7.4.0/dist/index.min.js';
const modularDemoLocalImageEditorBase = '../dist/umd';
const modularDemoHostedImageEditorBase =
    'https://cdn.jsdelivr.net/npm/@bensitu/image-editor@latest/dist/umd';
const modularDemoPages = new Set([
    'docs/index.html',
    'docs/basic.html',
    'docs/annotation.html',
    'docs/mask-mosaic.html',
    'docs/integrated-editor.html',
]);
const mutableLatestImageEditorPattern = /@bensitu\/image-editor@latest\b/u;
const inlineScriptPattern = /<script\b(?![^>]*\bsrc=)[^>]*>/iu;
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
    const { stdout } = await execFileAsync(
        'git',
        ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
        {
            cwd: repositoryRoot,
            encoding: 'utf8',
            maxBuffer: 16 * 1024 * 1024,
            windowsHide: true,
        },
    );
    const candidates = [
        ...new Set(
            stdout
                .split('\0')
                .filter(Boolean)
                .map((file) => file.replaceAll('\\', '/')),
        ),
    ];
    const existing = await Promise.all(
        candidates.map(async (file) => {
            try {
                await access(path.join(repositoryRoot, file));
                return file;
            } catch {
                return null;
            }
        }),
    );
    return existing.filter(Boolean);
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
        assertCondition(
            modularDemoPages.has(file) || !mutableLatestImageEditorPattern.test(source),
            `${file} uses a mutable latest Image Editor package reference outside a hosted demo.`,
        );
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
    const demoPlans = new Map([
        [
            'index.html',
            {
                pluginIds: [
                    'overlay',
                    'annotation',
                    'filters',
                    'mask',
                    'annotation-text',
                    'annotation-shape',
                ],
                entryFile: 'docs/js/landing-studio.js',
                entryScripts: ['js/landing-studio.js'],
            },
        ],
        [
            'basic.html',
            {
                pluginIds: ['overlay', 'transform', 'history', 'filters', 'crop'],
                dependencyOnlyPluginIds: ['overlay'],
                entryFile: 'docs/js/basic-demo.js',
                entryScripts: ['js/basic-demo.js', 'js/demo-pages.js'],
            },
        ],
        [
            'annotation.html',
            {
                pluginIds: [
                    'overlay',
                    'annotation',
                    'history',
                    'annotation-text',
                    'annotation-shape',
                    'annotation-draw',
                ],
                entryFile: 'docs/js/annotation-demo.js',
                entryScripts: ['js/annotation-demo.js', 'js/demo-pages.js'],
            },
        ],
        [
            'mask-mosaic.html',
            {
                pluginIds: ['overlay', 'mask', 'mosaic'],
                entryFile: 'docs/js/mask-mosaic-demo.js',
                entryScripts: ['js/mask-mosaic-demo.js', 'js/demo-pages.js'],
            },
        ],
        [
            'integrated-editor.html',
            {
                pluginIds: [
                    'overlay',
                    'annotation',
                    'transform',
                    'history',
                    'mask',
                    'annotation-text',
                    'annotation-shape',
                    'annotation-draw',
                ],
                entryFile: 'docs/js/integrated-editor-demo.js',
                entryScripts: ['js/integrated-editor-demo.js', 'js/demo-pages.js'],
            },
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
        if (source.includes(`${modularDemoLocalImageEditorBase}/image-editor.core.umd.min.js`)) {
            discoveredPages.push(path.posix.basename(file));
        }
    }
    assertCondition(
        discoveredPages.sort().join('\n') === [...demoPlans.keys()].sort().join('\n'),
        'Every HTML page using the local modular UMD build must have a reviewed Plugin plan and CSP.',
    );
    assertCondition(
        !files.includes('docs/js/demo-loader.js'),
        'Current demos must use explicit script tags instead of the retired dynamic demo loader.',
    );

    for (const [page, plan] of demoPlans) {
        const source = await readFile(path.join(repositoryRoot, 'docs', page), 'utf8');
        assertCondition(
            source.includes('data-demo-page=') &&
                !source.includes('demo-loader.js') &&
                !source.includes('ImageEditorFull') &&
                !source.includes('image-editor.full') &&
                !source.includes(modularDemoHostedFabricUrl) &&
                !source.includes(`${modularDemoHostedImageEditorBase}/`),
            `docs/${page} is not wired to an explicit modular UMD composition.`,
        );
        assertCondition(
            !inlineScriptPattern.test(source),
            `docs/${page} must not contain inline scripts under the reviewed Content Security Policy.`,
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
        const scriptSources = [
            ...source.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>\s*<\/script>/gu),
        ].map((match) => match[1]);
        const expectedScriptSources = [
            modularDemoLocalFabricUrl,
            `${modularDemoLocalImageEditorBase}/image-editor.core.umd.min.js`,
            ...plan.pluginIds.map(
                (pluginId) =>
                    `${modularDemoLocalImageEditorBase}/plugins/image-editor.plugin.${pluginId}.umd.min.js`,
            ),
            ...plan.entryScripts,
        ];
        assertCondition(
            JSON.stringify(scriptSources) === JSON.stringify(expectedScriptSources),
            `docs/${page} must load its reviewed local UMD and entry-script plan in dependency order.`,
        );
        const loaded = new Set();
        for (const pluginId of plan.pluginIds) {
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

        const entry = await readFile(path.join(repositoryRoot, plan.entryFile), 'utf8');
        assertCondition(
            entry.includes('ImageEditorCore') &&
                entry.includes('composePlugins') &&
                !entry.includes('ImageEditorFull') &&
                !entry.includes('createFullPreset'),
            `${plan.entryFile} must visibly construct Core and compose only modular Plugin globals.`,
        );
        const dependencyOnlyPluginIds = new Set(plan.dependencyOnlyPluginIds ?? []);
        for (const pluginId of plan.pluginIds.filter(
            (candidate) => !dependencyOnlyPluginIds.has(candidate),
        )) {
            const guardExport = pluginDefinitions.get(pluginId)?.guardExport;
            assertCondition(
                guardExport && entry.includes(`${guardExport}(`),
                `${plan.entryFile} does not visibly install ${pluginId}.`,
            );
        }
    }

    const sharedDemoBehavior = await readFile(
        path.join(repositoryRoot, 'docs/js/demo-pages.js'),
        'utf8',
    );
    assertCondition(
        sharedDemoBehavior.includes('window.ImageEditorDemoPage') &&
            !sharedDemoBehavior.includes('createPluginPlan') &&
            !sharedDemoBehavior.includes('ImageEditorPlugins') &&
            !sharedDemoBehavior.includes('ImageEditorFull') &&
            !sharedDemoBehavior.includes('createFullPreset'),
        'Shared demo behavior must not hide page-specific UMD Plugin composition.',
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
