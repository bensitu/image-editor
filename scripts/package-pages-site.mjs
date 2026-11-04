/**
 * Packages the documentation demo site for GitHub Pages.
 *
 * @module
 */

import { createHash } from 'node:crypto';
import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsRoot, '..');
const siteRoot = path.join(repositoryRoot, '.pages-site');
const modularDemoPages = Object.freeze([
    'index.html',
    'basic.html',
    'annotation.html',
    'mask-mosaic.html',
    'integrated-editor.html',
]);
const demoPages = Object.freeze([...modularDemoPages, 'legacy-v1.html']);
const localFabricUrl = '../node_modules/fabric/dist/index.min.js';
const hostedFabricUrl = 'https://cdn.jsdelivr.net/npm/fabric@7.4.0/dist/index.min.js';
const localImageEditorUmdBase = '../dist/umd';
const hostedImageEditorUmdBase = './assets/image-editor';
const fabricIntegrity = 'sha384-T2IWa4YW4tn/gJpR880CrMehXQvwxwaRgQszdzYPA6jBbKH9sPZuTf9YrN/PqNP6';

await rm(siteRoot, { force: true, recursive: true });
await cp(path.join(repositoryRoot, 'docs'), siteRoot, { recursive: true });
// Ignored internal archives may exist locally and must never enter a Pages artifact.
for (const privateDirectory of ['internal', 'refactor']) {
    await rm(path.join(siteRoot, privateDirectory), { force: true, recursive: true });
}

for (const page of demoPages) {
    await access(path.join(siteRoot, page));
}

let rewrittenFabricAssetCount = 0;
let rewrittenImageEditorAssetCount = 0;
for (const page of modularDemoPages) {
    const pagePath = path.join(siteRoot, page);
    const source = await readFile(pagePath, 'utf8');
    const localFabricSource = `src="${localFabricUrl}"`;
    const hostedFabricSource = `src="${hostedFabricUrl}" integrity="${fabricIntegrity}" crossorigin="anonymous"`;
    const localScriptPrefix = `src="${localImageEditorUmdBase}/`;
    const hostedScriptPrefix = `src="${hostedImageEditorUmdBase}/`;
    const localFabricAssetCount = source.split(localFabricSource).length - 1;
    const localAssetCount = source.split(localScriptPrefix).length - 1;

    if (
        localFabricAssetCount !== 1 ||
        localAssetCount === 0 ||
        source.includes(hostedFabricSource) ||
        source.includes(hostedScriptPrefix)
    ) {
        throw new Error(
            `${page} must contain only local Fabric and Image Editor script sources before Pages packaging.`,
        );
    }

    let hostedSource = source
        .replaceAll(localFabricSource, hostedFabricSource)
        .replaceAll(localScriptPrefix, hostedScriptPrefix);
    for (const match of source.matchAll(/src="\.\.\/dist\/umd\/([^"]+)"/gu)) {
        const asset = match[1];
        const assetSource = path.resolve(repositoryRoot, 'dist', 'umd', asset);
        const distributionRoot = path.resolve(repositoryRoot, 'dist', 'umd');
        if (!assetSource.startsWith(distributionRoot + path.sep))
            throw new Error('Invalid distribution asset path.');
        const bytes = await readFile(assetSource);
        const destination = path.join(siteRoot, 'assets', 'image-editor', asset);
        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(destination, bytes);
        const integrity = `sha384-${createHash('sha384').update(bytes).digest('base64')}`;
        hostedSource = hostedSource.replaceAll(
            `src="${hostedImageEditorUmdBase}/${asset}"`,
            `src="${hostedImageEditorUmdBase}/${asset}" integrity="${integrity}" crossorigin="anonymous"`,
        );
    }
    if (hostedSource.includes(localFabricSource) || hostedSource.includes(localScriptPrefix)) {
        throw new Error(`${page} still contains a local script source after Pages packaging.`);
    }
    await writeFile(pagePath, hostedSource, 'utf8');
    rewrittenFabricAssetCount += localFabricAssetCount;
    rewrittenImageEditorAssetCount += localAssetCount;
}

console.log(
    `Pages artifact packaged at .pages-site (${demoPages.length} demo pages verified, ` +
        `${rewrittenFabricAssetCount} Fabric and ${rewrittenImageEditorAssetCount} Image Editor ` +
        'assets packaged with integrity metadata).',
);
