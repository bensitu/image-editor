/**
 * Downloads the fixed Legacy demo CDN assets and verifies their declared SRI hashes.
 *
 * @module
 */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LEGACY_DEMO_CDN_ASSETS } from '../config/docs/legacy-demo-security.mjs';

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsRoot, '..');
const legacyPage = await readFile(path.join(repositoryRoot, 'docs', 'legacy-v1.html'), 'utf8');

function assetTag(asset) {
    const urlIndex = legacyPage.indexOf(asset.url);
    if (urlIndex < 0) throw new Error(`Legacy demo does not reference ${asset.url}.`);
    const tagStart = legacyPage.lastIndexOf('<', urlIndex);
    const tagEnd = legacyPage.indexOf('>', urlIndex);
    if (tagStart < 0 || tagEnd < urlIndex) {
        throw new Error(`Legacy demo has malformed markup for ${asset.url}.`);
    }
    return legacyPage.slice(tagStart, tagEnd + 1);
}

for (const asset of LEGACY_DEMO_CDN_ASSETS) {
    const tag = assetTag(asset);
    if (
        !tag.includes(`integrity="${asset.integrity}"`) ||
        !tag.includes('crossorigin="anonymous"')
    ) {
        throw new Error(`Legacy demo markup does not declare the reviewed SRI for ${asset.url}.`);
    }

    const response = await fetch(asset.url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok || response.url !== asset.url) {
        throw new Error(
            `Unable to retrieve the exact Legacy asset ${asset.url}: ` +
                `${response.status} ${response.url}`,
        );
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    const actualIntegrity = `sha384-${createHash('sha384').update(bytes).digest('base64')}`;
    if (actualIntegrity !== asset.integrity) {
        throw new Error(
            `Legacy asset integrity mismatch for ${asset.url}: expected ${asset.integrity}, ` +
                `received ${actualIntegrity}.`,
        );
    }
}

console.log(`Legacy asset integrity passed (${LEGACY_DEMO_CDN_ASSETS.length} fixed CDN assets).`);
