/**
 * Packages documentation and same-commit UMD assets for GitHub Pages.
 *
 * @module
 */

import { access, cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MODULAR_UMD_MODULES } from '../config/bundle/modular-umd.mjs';

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsRoot, '..');
const siteRoot = path.join(repositoryRoot, '.pages-site');
const sourceUmdRoot = path.join(repositoryRoot, 'dist', 'umd');
const packagedUmdRoot = path.join(siteRoot, 'vendor', 'image-editor', 'umd');

const requiredUmdFiles = Object.freeze(
    MODULAR_UMD_MODULES.map(({ fileBase }) => {
        const relativeBase = path.relative(path.join(repositoryRoot, 'dist', 'umd'), fileBase);
        return `${relativeBase}.umd.min.js`;
    }),
);

await rm(siteRoot, { force: true, recursive: true });
await cp(path.join(repositoryRoot, 'docs'), siteRoot, { recursive: true });
await cp(sourceUmdRoot, packagedUmdRoot, { recursive: true });

await access(path.join(siteRoot, 'index.html'));
for (const relativePath of requiredUmdFiles) {
    await access(path.join(packagedUmdRoot, relativePath));
}

console.log(
    `Pages artifact packaged at .pages-site (${requiredUmdFiles.length} modular UMD assets verified).`,
);
