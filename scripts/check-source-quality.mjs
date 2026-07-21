/**
 * Verifies durable responsibility headers on production TypeScript modules.
 *
 * @module
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsRoot, '..');
const sourceRoot = path.join(repositoryRoot, 'src');
const genericSummaryPattern =
    /^(?:contains?|defines?|handles?)\s+(?:common\s+)?(?:helpers?|logic|types|utilities)\.?$/iu;
const temporaryLanguagePattern =
    /\b(?:implementation\s+(?:phase|report|stage)|phase\s*\d+[a-z-]*|refactor\s+(?:phase|report|stage)|stage\s*\d+[a-z-]*)\b/iu;

async function collectTypeScriptFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...(await collectTypeScriptFiles(entryPath)));
        else if (entry.isFile() && entry.name.endsWith('.ts')) files.push(entryPath);
    }
    return files.sort();
}

function responsibilitySummary(header) {
    return header
        .replace(/^\/\*\*/u, '')
        .replace(/\*\/$/u, '')
        .split(/\r?\n/u)
        .map((line) => line.replace(/^\s*\*?\s?/u, '').trim())
        .filter((line) => line.length > 0 && !line.startsWith('@'))
        .join(' ')
        .trim();
}

const failures = [];
const files = await collectTypeScriptFiles(sourceRoot);
for (const filePath of files) {
    const relativePath = path.relative(repositoryRoot, filePath).replaceAll('\\', '/');
    const source = (await readFile(filePath, 'utf8')).replace(/^\uFEFF/u, '');
    const header = source.match(/^\/\*\*[\s\S]*?\*\//u)?.[0];
    if (!header) {
        failures.push(`${relativePath}: missing top-level responsibility header`);
        continue;
    }
    if (!/(?:^|\s)@module(?:\s|$)/u.test(header)) {
        failures.push(`${relativePath}: missing @module tag`);
    }
    const summary = responsibilitySummary(header);
    if (summary.length === 0 || genericSummaryPattern.test(summary)) {
        failures.push(`${relativePath}: responsibility summary is missing or generic`);
    }
    if (temporaryLanguagePattern.test(header)) {
        failures.push(`${relativePath}: responsibility header contains temporary project language`);
    }
}

if (failures.length > 0) {
    throw new Error(`Source quality policy failed:\n${failures.join('\n')}`);
}
console.log(`Source quality policy passed for ${files.length} production modules.`);
