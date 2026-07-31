/**
 * Packages the documentation demo site for GitHub Pages.
 *
 * @module
 */

import { access, cp, readFile, rm, writeFile } from 'node:fs/promises';
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
const hostedImageEditorUmdBase =
    'https://cdn.jsdelivr.net/npm/@bensitu/image-editor@latest/dist/umd';

await rm(siteRoot, { force: true, recursive: true });
await cp(path.join(repositoryRoot, 'docs'), siteRoot, { recursive: true });
// Internal documentation may exist in local ignored files and must never enter a Pages artifact.
await rm(path.join(siteRoot, 'internal'), { force: true, recursive: true });

for (const page of demoPages) {
    await access(path.join(siteRoot, page));
}

let rewrittenFabricAssetCount = 0;
let rewrittenImageEditorAssetCount = 0;
for (const page of modularDemoPages) {
    const pagePath = path.join(siteRoot, page);
    const source = await readFile(pagePath, 'utf8');
    const localFabricSource = `src="${localFabricUrl}"`;
    const hostedFabricSource = `src="${hostedFabricUrl}"`;
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

    const hostedSource = source
        .replaceAll(localFabricSource, hostedFabricSource)
        .replaceAll(localScriptPrefix, hostedScriptPrefix);
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
        'assets rewritten to the hosted CDN).',
);
