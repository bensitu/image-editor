/**
 * Type:
 *   Smoke test
 *
 * Purpose:
 *   Scans runtime source and the public declarations bundle for removed alias
 *   identifiers. The suite is intentionally string-based so it can validate
 *   generated artifacts without loading the editor runtime.
 *
 * Scope:
 *   - The public declarations bundle must not expose removed alias names.
 *   - Runtime source and generated declarations must not contain removed v1
 *     DOM binding keys.
 *
 * Out of scope:
 *   - feature behavior inside ImageEditor methods
 *   - browser rendering behavior
 *   - private implementation refactors
 *
 * Environment:
 *   - Node.js ESM
 *   - filesystem or built-artifact inspection
 *
 * Run:
 *   node --test tests/alias-scrub.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on canonical alias absence across runtime source
 *     and generated type declarations only.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// ─── Constants ─────────────────────────────────────────────────────────────

/**
 * Deprecated aliases flagged across the publishable surface.
 */
const DEPRECATED_ALIASES = Object.freeze([
    'reset',
    'addMask',
    'merge',
    'getImageBase64',
    'canvasEl',
    'containerEl',
    'placeholderEl',
    'imgPlaceholder',
    'scaleRate',
    'rotationLeftInput',
    'rotationRightInput',
    'rotateLeftBtn',
    'rotateRightBtn',
    'addMaskBtn',
    'removeMaskBtn',
    'removeAllMasksBtn',
    'mergeBtn',
    'downloadBtn',
    'zoomInBtn',
    'zoomOutBtn',
    'resetBtn',
    'undoBtn',
    'redoBtn',
    'cropBtn',
    'applyCropBtn',
    'cancelCropBtn',
]);

/**
 * Removed v1 DOM binding keys. These are scanned as raw text in runtime
 * source and generated declarations because v2 must expose canonical DOM
 * names only.
 */
const DEPRECATED_DOM_KEYS = Object.freeze([
    'imgPlaceholder',
    'scaleRate',
    'rotationLeftInput',
    'rotationRightInput',
    'rotateLeftBtn',
    'rotateRightBtn',
    'addMaskBtn',
    'removeMaskBtn',
    'removeAllMasksBtn',
    'mergeBtn',
    'downloadBtn',
    'zoomInBtn',
    'zoomOutBtn',
    'resetBtn',
    'undoBtn',
    'redoBtn',
    'cropBtn',
    'applyCropBtn',
    'cancelCropBtn',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Strip block comments, line comments, and string literals from
 * JavaScript / TypeScript source so a word-boundary scan only catches
 * actual code identifiers. Template literals are stripped as a single
 * unit; nested `${}` interpolations are not parsed because no test
 * file relies on alias names appearing inside one.
 */
function stripJsCommentsAndStrings(source) {
    return (
        source
            // Block comments first so a `//` inside `/* */` is not mis-handled.
            .replace(/\/\*[\s\S]*?\*\//g, '')
            // Line comments (// to EOL).
            .replace(/\/\/[^\n]*/g, '')
            // Single-quoted strings (with backslash-escape support).
            .replace(/'(?:\\.|[^'\\])*'/g, "''")
            // Double-quoted strings.
            .replace(/"(?:\\.|[^"\\])*"/g, '""')
            // Template literals (best-effort: no recursive `${}` parsing).
            .replace(/`(?:\\.|[^`\\])*`/g, '``')
    );
}

/**
 * Find every deprecated alias occurrence in `text` using case-sensitive
 * word-boundary matching. Returns an array of `{ alias, index }` so
 * failures can name the offender precisely. Identifiers like
 * `resetImageTransformButton`, `resetTransform`, `mergeMasks`, and `createMaskButton` are NOT
 * matched because the alias is followed (or preceded) by another word
 * character, so no word boundary exists.
 */
function findTerms(text, terms) {
    const found = [];
    for (const alias of terms) {
        const re = new RegExp(`\\b${alias}\\b`, 'g');
        let match;
        while ((match = re.exec(text)) !== null) {
            found.push({ alias, index: match.index });
        }
    }
    return found;
}

function findAliases(text) {
    return findTerms(text, DEPRECATED_ALIASES);
}

function findDomKeys(text) {
    return findTerms(text, DEPRECATED_DOM_KEYS);
}

/** Read every file under `dir` whose name matches `predicate`. */
async function listFiles(dir, predicate) {
    let entries;
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (error) {
        if (error && error.code === 'ENOENT') return [];
        throw error;
    }
    const out = [];
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            const nested = await listFiles(full, predicate);
            out.push(...nested);
        } else if (entry.isFile() && predicate(entry.name)) {
            out.push(full);
        }
    }
    return out;
}

test('`dist/types` declarations expose no deprecated aliases when present', async () => {
    const declarationFiles = await listFiles(
        path.join(repoRoot, 'dist', 'types'),
        (name) => name.endsWith('.d.ts') || name.endsWith('.d.cts'),
    );
    for (const filePath of declarationFiles) {
        const source = await fs.readFile(filePath, 'utf8');
        const stripped = stripJsCommentsAndStrings(source);
        const found = findAliases(stripped);
        assert.deepEqual(
            found.map((f) => f.alias),
            [],
            `${path.relative(repoRoot, filePath)} must not declare or reference any ` +
                `deprecated alias ` +
                `. Offending hits: ${JSON.stringify(found)}`,
        );
    }
});

test('v2 runtime source and declarations contain no removed v1 DOM keys', async () => {
    const groups = [
        {
            label: 'src/**/*.ts',
            dir: path.join(repoRoot, 'src'),
            predicate: (name) => name.endsWith('.ts'),
        },
        {
            label: 'dist/types declarations',
            dir: path.join(repoRoot, 'dist', 'types'),
            predicate: (name) => name.endsWith('.d.ts') || name.endsWith('.d.cts'),
        },
    ];

    const offenders = [];
    for (const group of groups) {
        const files = await listFiles(group.dir, group.predicate);
        for (const filePath of files) {
            const source = await fs.readFile(filePath, 'utf8');
            const found = findDomKeys(source);
            for (const hit of found) {
                offenders.push({
                    surface: group.label,
                    file: path.relative(repoRoot, filePath),
                    key: hit.alias,
                });
            }
        }
    }

    assert.deepEqual(
        offenders,
        [],
        `Removed v1 DOM binding keys must not appear in v2 runtime source ` +
            `or generated declarations. Offenders: ${JSON.stringify(offenders)}`,
    );
});
