/**
 * Packages the documentation demo site for GitHub Pages.
 *
 * @module
 */

import { access, cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsRoot, '..');
const siteRoot = path.join(repositoryRoot, '.pages-site');
const demoPages = Object.freeze([
    'index.html',
    'basic.html',
    'annotation.html',
    'mask-mosaic.html',
    'integrated-editor.html',
    'legacy-v1.html',
]);

await rm(siteRoot, { force: true, recursive: true });
await cp(path.join(repositoryRoot, 'docs'), siteRoot, { recursive: true });
// Internal documentation may exist in local ignored files and must never enter a Pages artifact.
await rm(path.join(siteRoot, 'internal'), { force: true, recursive: true });

for (const page of demoPages) {
    await access(path.join(siteRoot, page));
}

console.log(`Pages artifact packaged at .pages-site (${demoPages.length} demo pages verified).`);
