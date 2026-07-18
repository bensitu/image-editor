import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const sourceRoot = path.join(repositoryRoot, 'src');
const filtersRoot = path.join(sourceRoot, 'plugins', 'filters');
const factoryPath = path.join(filtersRoot, 'fabric-filter-factory.ts');
const allowedCompositionPaths = new Set([
    path.join(sourceRoot, 'presets', 'redaction', 'index.ts'),
    path.join(sourceRoot, 'presets', 'full', 'index.ts'),
    path.join(sourceRoot, 'umd', 'full.ts'),
]);
const constructorNames = [
    'Brightness',
    'Contrast',
    'Saturation',
    'Grayscale',
    'Sepia',
    'Vintage',
    'Blur',
    'Convolute',
];

async function collectTypeScriptFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(
        entries.map(async (entry) => {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) return collectTypeScriptFiles(entryPath);
            return entry.isFile() && entry.name.endsWith('.ts') ? [entryPath] : [];
        }),
    );
    return files.flat().sort();
}

test('Fabric Filter constructors remain isolated to the Filters package entry', async () => {
    const factorySource = await readFile(factoryPath, 'utf8');
    for (const constructorName of constructorNames) {
        assert.match(
            factorySource,
            new RegExp(`constructorName = '${constructorName}'`, 'u'),
            `Missing Fabric constructor mapping for ${constructorName}.`,
        );
    }

    for (const filePath of await collectTypeScriptFiles(sourceRoot)) {
        if (filePath.startsWith(`${filtersRoot}${path.sep}`)) continue;
        const source = await readFile(filePath, 'utf8');
        assert.doesNotMatch(
            source,
            /(?:fabric\.)?filters\s*(?:\.|\[)\s*(?:Brightness|Contrast|Saturation|Grayscale|Sepia|Vintage|Blur|Convolute)\b/u,
            `${path.relative(repositoryRoot, filePath)} reaches a Fabric Filter constructor.`,
        );
        if (!allowedCompositionPaths.has(filePath)) {
            assert.doesNotMatch(
                source,
                /(?:from\s+|import\s*\()\s*['"][^'"]*plugins\/filters(?:\/index\.js)?['"]/u,
                `${path.relative(repositoryRoot, filePath)} statically imports the Filters Plugin.`,
            );
        }
    }
});
