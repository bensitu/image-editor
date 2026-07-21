/** Builds and verifies independently packed public Plugin examples. */

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import semver from 'semver';
import ts from 'typescript';

const execFileAsync = promisify(execFile);
const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsRoot, '..');
const packagesRoot = path.join(repositoryRoot, 'examples', 'reference-plugins');
const consumerFixtureRoot = path.join(repositoryRoot, 'tests', 'package', 'reference-consumer');
const rootManifest = JSON.parse(await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'));
const packageDescriptors = Object.freeze([
    Object.freeze({
        key: 'watermark',
        directory: 'watermark',
        name: '@bensitu/reference-watermark',
    }),
    Object.freeze({ key: 'metadata', directory: 'metadata', name: '@bensitu/reference-metadata' }),
    Object.freeze({
        key: 'gridGuide',
        directory: 'grid-guide',
        name: '@bensitu/reference-grid-guide',
    }),
    Object.freeze({
        key: 'blurRegion',
        directory: 'blur-region',
        name: '@bensitu/reference-blur-region',
    }),
]);
const allowedPackageImports = new Set([
    '@bensitu/image-editor',
    '@bensitu/image-editor/core',
    '@bensitu/image-editor/sdk',
    '@bensitu/image-editor/testing',
    '@bensitu/image-editor/plugins/overlay',
    '@bensitu/image-editor/plugins/transform',
    '@bensitu/image-editor/plugins/mask',
    '@bensitu/image-editor/plugins/history',
    '@bensitu/image-editor/plugins/filters',
    'fabric',
]);

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

function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}

async function hashFile(filePath) {
    return sha256(await readFile(filePath));
}

async function run(command, args, cwd, options = {}) {
    return execFileAsync(command, args, {
        cwd,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        windowsHide: true,
        ...options,
    });
}

async function npm(args, cwd) {
    const npmCliPath = process.env.npm_execpath;
    if (!npmCliPath) {
        throw new Error('npm_execpath is unavailable; run this checker through an npm script.');
    }
    return run(process.execPath, [npmCliPath, ...args], cwd);
}

function fileSpecifier(filePath) {
    return `file:${path.resolve(filePath).replaceAll('\\', '/')}`;
}

async function pack(directory, destination) {
    const { stdout } = await npm(['pack', '--json', '--pack-destination', destination], directory);
    const result = JSON.parse(stdout)[0];
    assertCondition(
        result && typeof result.filename === 'string',
        'npm pack returned no artifact.',
    );
    const files = Object.freeze(
        (result.files ?? []).map((entry) => entry.path.replaceAll('\\', '/')).sort(),
    );
    for (const file of files) {
        assertCondition(!file.startsWith('node_modules/'), `${result.name} packed node_modules.`);
        assertCondition(
            !file.startsWith('docs/refactor/'),
            `${result.name} packed internal documents.`,
        );
    }
    const artifactPath = path.join(destination, result.filename);
    return Object.freeze({
        name: result.name,
        version: result.version,
        filename: result.filename,
        path: artifactPath,
        sha256: await hashFile(artifactPath),
        size: result.size,
        unpackedSize: result.unpackedSize,
        files,
    });
}

function assertPeerPolicy(manifest, descriptor) {
    assertCondition(
        manifest.name === descriptor.name,
        `${descriptor.directory} has the wrong name.`,
    );
    const imageEditorRange = manifest.peerDependencies?.['@bensitu/image-editor'];
    assertCondition(
        semver.validRange(imageEditorRange) !== null &&
            semver.satisfies(rootManifest.version, imageEditorRange, {
                includePrerelease: true,
            }),
        `${descriptor.name} must accept Image Editor ${rootManifest.version}.`,
    );
    assertCondition(
        manifest.peerDependencies?.fabric === rootManifest.peerDependencies.fabric,
        `${descriptor.name} must declare the supported Fabric peer range.`,
    );
    assertCondition(
        typeof manifest.devDependencies?.['@bensitu/image-editor'] === 'string' &&
            typeof manifest.devDependencies?.fabric === 'string',
        `${descriptor.name} must declare development sources for both peers.`,
    );
    for (const dependency of ['@bensitu/image-editor', 'fabric']) {
        for (const field of ['dependencies', 'optionalDependencies']) {
            assertCondition(
                !Object.prototype.hasOwnProperty.call(manifest[field] ?? {}, dependency),
                `${descriptor.name} may not vendor ${dependency} through ${field}.`,
            );
        }
        const bundled = manifest.bundledDependencies ?? manifest.bundleDependencies ?? [];
        assertCondition(
            bundled !== true && (!Array.isArray(bundled) || !bundled.includes(dependency)),
            `${descriptor.name} may not bundle ${dependency}.`,
        );
    }
}

function collectModuleSpecifiers(sourceText, filePath) {
    const source = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
    const specifiers = [];
    const visit = (node) => {
        if (
            (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
            node.moduleSpecifier &&
            ts.isStringLiteralLike(node.moduleSpecifier)
        ) {
            specifiers.push(node.moduleSpecifier.text);
        } else if (
            ts.isCallExpression(node) &&
            node.arguments.length === 1 &&
            ts.isStringLiteralLike(node.arguments[0]) &&
            (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
                (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
        ) {
            specifiers.push(node.arguments[0].text);
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    return Object.freeze([...new Set(specifiers)].sort());
}

async function inspectSourcePackage(descriptor) {
    const packageRoot = path.join(packagesRoot, descriptor.directory);
    const manifest = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
    assertPeerPolicy(manifest, descriptor);
    const sourceFiles = (await readdir(path.join(packageRoot, 'src'), { withFileTypes: true }))
        .filter((entry) => entry.isFile() && /\.[cm]?tsx?$/u.test(entry.name))
        .map((entry) => path.join(packageRoot, 'src', entry.name));
    const moduleSpecifiers = [];
    for (const filePath of sourceFiles) {
        moduleSpecifiers.push(
            ...collectModuleSpecifiers(await readFile(filePath, 'utf8'), filePath),
        );
    }
    for (const specifier of moduleSpecifiers) {
        if (specifier.startsWith('.')) {
            const resolved = path.resolve(packageRoot, 'src', specifier);
            assertCondition(
                resolved.startsWith(`${path.resolve(packageRoot)}${path.sep}`),
                `${descriptor.name} has an escaping relative import.`,
            );
            continue;
        }
        assertCondition(
            allowedPackageImports.has(specifier),
            `${descriptor.name} imports non-public package path "${specifier}".`,
        );
    }
    return Object.freeze({
        descriptor,
        packageRoot,
        manifest,
        moduleSpecifiers: Object.freeze([...new Set(moduleSpecifiers)].sort()),
    });
}

async function inspectAllSources() {
    const packages = [];
    for (const descriptor of packageDescriptors)
        packages.push(await inspectSourcePackage(descriptor));
    return Object.freeze(packages);
}

async function copyPackageSource(source, destination) {
    await cp(source, destination, {
        recursive: true,
        filter: (entry) => {
            const normalized = entry.replaceAll('\\', '/');
            return !normalized.includes('/node_modules/') && !normalized.includes('/dist/');
        },
    });
}

async function buildPluginPackage(sourceInspection, mainArtifact, buildRoot, artifactsRoot) {
    const { descriptor, manifest, packageRoot } = sourceInspection;
    const destination = path.join(buildRoot, descriptor.directory);
    await copyPackageSource(packageRoot, destination);
    const buildManifest = structuredClone(manifest);
    buildManifest.devDependencies['@bensitu/image-editor'] = fileSpecifier(mainArtifact.path);
    await writeFile(
        path.join(destination, 'package.json'),
        `${JSON.stringify(buildManifest, null, 4)}\n`,
        'utf8',
    );
    console.log(`Installing public dependencies for ${descriptor.name}.`);
    await npm(['install', '--no-audit', '--no-fund'], destination);
    await npm(['run', 'build'], destination);
    await npm(['test'], destination);
    await writeFile(
        path.join(destination, 'package.json'),
        `${JSON.stringify(manifest, null, 4)}\n`,
        'utf8',
    );
    const artifact = await pack(destination, artifactsRoot);
    const esmPath = path.join(destination, 'dist', 'esm', 'index.js');
    const cjsPath = path.join(destination, 'dist', 'cjs', 'index.cjs');
    const compiled = `${await readFile(esmPath, 'utf8')}\n${await readFile(cjsPath, 'utf8')}`;
    assertCondition(
        !/(?:core-runtime|plugin-kernel|\/internal(?:\/|['"]))/u.test(compiled),
        `${descriptor.name} artifact contains a private package reference.`,
    );
    return Object.freeze({
        descriptor,
        manifest,
        destination,
        artifact,
        moduleSpecifiers: sourceInspection.moduleSpecifiers,
        moduleIds: Object.freeze([
            `${descriptor.name}/dist/cjs/index.cjs`,
            `${descriptor.name}/dist/esm/index.js`,
        ]),
    });
}

async function copyConsumerFixture(destination) {
    const entries = await readdir(consumerFixtureRoot, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isFile()) {
            await cp(
                path.join(consumerFixtureRoot, entry.name),
                path.join(destination, entry.name),
            );
        }
    }
}

async function packageDirectories(nodeModulesRoot) {
    const directories = [];
    async function visitLevel(levelRoot) {
        let entries;
        try {
            entries = await readdir(levelRoot, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            if (!entry.isDirectory() || entry.name === '.bin') continue;
            if (entry.name.startsWith('@')) {
                const scoped = path.join(levelRoot, entry.name);
                for (const child of await readdir(scoped, { withFileTypes: true })) {
                    if (!child.isDirectory()) continue;
                    const packageRoot = path.join(scoped, child.name);
                    directories.push(packageRoot);
                    await visitLevel(path.join(packageRoot, 'node_modules'));
                }
                continue;
            }
            const packageRoot = path.join(levelRoot, entry.name);
            directories.push(packageRoot);
            await visitLevel(path.join(packageRoot, 'node_modules'));
        }
    }
    await visitLevel(nodeModulesRoot);
    return Object.freeze(directories);
}

async function findPackageInstances(nodeModulesRoot, packageName) {
    const instances = [];
    for (const directory of await packageDirectories(nodeModulesRoot)) {
        try {
            const manifest = JSON.parse(
                await readFile(path.join(directory, 'package.json'), 'utf8'),
            );
            if (manifest.name === packageName) {
                instances.push(path.relative(nodeModulesRoot, directory).replaceAll('\\', '/'));
            }
        } catch {
            // Directories without a readable package manifest are not package instances.
        }
    }
    return Object.freeze(instances.sort());
}

function normalizeDependencyTree(node) {
    const dependencies = Object.fromEntries(
        Object.entries(node.dependencies ?? {})
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([name, child]) => [name, normalizeDependencyTree(child)]),
    );
    return Object.freeze({ version: node.version ?? null, dependencies });
}

function summarizeReport(stdout) {
    const marker = 'REFERENCE_PLUGIN_PROOF=';
    const line = stdout.split(/\r?\n/u).find((candidate) => candidate.startsWith(marker));
    assertCondition(line, 'Reference Plugin runtime proof returned no machine result.');
    return JSON.parse(line.slice(marker.length));
}

async function installAndVerifyConsumer(mainArtifact, pluginBuilds, temporaryRoot) {
    const consumerRoot = path.join(temporaryRoot, 'consumer');
    await mkdir(consumerRoot, { recursive: true });
    const dependencies = {
        '@bensitu/image-editor': fileSpecifier(mainArtifact.path),
        fabric: '7.4.0',
        canvas: '3.2.3',
        jsdom: '26.1.0',
    };
    for (const plugin of pluginBuilds) {
        dependencies[plugin.descriptor.name] = fileSpecifier(plugin.artifact.path);
    }
    const consumerManifest = {
        name: 'reference-plugin-clean-consumer',
        version: '1.0.0',
        private: true,
        type: 'module',
        dependencies,
        devDependencies: { '@types/jsdom': '21.1.7', typescript: '5.9.3' },
    };
    await writeFile(
        path.join(consumerRoot, 'package.json'),
        `${JSON.stringify(consumerManifest, null, 4)}\n`,
        'utf8',
    );
    console.log('Installing packed artifacts in a clean consumer.');
    await npm(['install', '--no-audit', '--no-fund'], consumerRoot);
    await copyConsumerFixture(consumerRoot);
    const typeScriptCli = path.join(consumerRoot, 'node_modules', 'typescript', 'bin', 'tsc');
    await run(process.execPath, [typeScriptCli, '-p', 'tsconfig.json'], consumerRoot);
    await run(process.execPath, ['cjs-proof.cjs'], consumerRoot);

    const proofInput = {
        schemaVersion: 1,
        typesPassed: true,
        packages: Object.fromEntries(
            pluginBuilds.map((plugin) => [
                plugin.descriptor.key,
                {
                    manifest: {
                        name: plugin.manifest.name,
                        peerDependencies: plugin.manifest.peerDependencies,
                        dependencies: plugin.manifest.dependencies ?? {},
                        optionalDependencies: plugin.manifest.optionalDependencies ?? {},
                        bundledDependencies:
                            plugin.manifest.bundledDependencies ??
                            plugin.manifest.bundleDependencies ??
                            [],
                    },
                    bundleIsolation: {
                        moduleIds: plugin.moduleIds,
                        internalImports: 0,
                        privateAliases: 0,
                        unknownModules: 0,
                    },
                    packageModules: {
                        moduleIds: plugin.moduleIds,
                        bundledCoreModules: 0,
                        bundledFabricModules: 0,
                    },
                },
            ]),
        ),
    };
    const proofInputPath = path.join(consumerRoot, 'proof-input.json');
    await writeFile(proofInputPath, canonicalText(proofInput), 'utf8');
    console.log('Running behavior, transaction, isolation, and conformance proofs.');
    const runtime = await run(process.execPath, ['runtime-proof.mjs'], consumerRoot, {
        env: { ...process.env, REFERENCE_PLUGIN_PROOF_INPUT: proofInputPath },
    });

    const nodeModulesRoot = path.join(consumerRoot, 'node_modules');
    const coreInstances = await findPackageInstances(nodeModulesRoot, '@bensitu/image-editor');
    const fabricInstances = await findPackageInstances(nodeModulesRoot, 'fabric');
    assertCondition(
        coreInstances.length === 1,
        'Clean consumer resolved more than one Core package.',
    );
    assertCondition(
        fabricInstances.length === 1,
        'Clean consumer resolved more than one Fabric package.',
    );
    const dependencyOutput = await npm(['ls', '--all', '--json'], consumerRoot);
    const dependencyTree = normalizeDependencyTree(JSON.parse(dependencyOutput.stdout));
    return Object.freeze({
        esm: 'PASS',
        cjs: 'PASS',
        types: 'PASS',
        packageResolution: 'PASS',
        coreInstances,
        fabricInstances,
        dependencyTreeHash: sha256(JSON.stringify(canonicalize(dependencyTree))),
        runtime: summarizeReport(runtime.stdout),
    });
}

function parseMode(arguments_) {
    const modes = arguments_.filter((argument) => ['--static', '--check'].includes(argument));
    assertCondition(
        modes.length === 1 && modes.length === arguments_.length,
        'Use exactly one checker mode.',
    );
    return modes[0];
}

async function execute(mode) {
    const sources = await inspectAllSources();
    if (mode === '--static') {
        console.log('Reference Plugin public import and peer dependency checks passed.');
        return;
    }

    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'image-editor-reference-plugins-'));
    const resolvedTemporaryRoot = path.resolve(temporaryRoot);
    const resolvedTempRoot = path.resolve(tmpdir());
    assertCondition(
        resolvedTemporaryRoot.startsWith(`${resolvedTempRoot}${path.sep}`),
        'Refusing to use a package proof directory outside the system temporary directory.',
    );
    try {
        const artifactsRoot = path.join(temporaryRoot, 'artifacts');
        const buildsRoot = path.join(temporaryRoot, 'builds');
        await mkdir(artifactsRoot, { recursive: true });
        await mkdir(buildsRoot, { recursive: true });
        console.log('Packing the current public package artifact.');
        const mainArtifact = await pack(repositoryRoot, artifactsRoot);
        const pluginBuilds = [];
        for (const source of sources) {
            pluginBuilds.push(
                await buildPluginPackage(source, mainArtifact, buildsRoot, artifactsRoot),
            );
        }
        await installAndVerifyConsumer(mainArtifact, pluginBuilds, temporaryRoot);
        console.log('Reference Plugin packed consumer checks passed.');
    } finally {
        await rm(resolvedTemporaryRoot, { recursive: true, force: true });
    }
}

await execute(parseMode(process.argv.slice(2)));
