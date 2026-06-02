/**
 * @file alias-scrub.test.mjs
 *
 * Type:
 *   Smoke test
 *
 * Purpose:
 *   Scans README, docs, tests, package metadata, changelog sections, and the public
 *   declarations bundle for removed alias identifiers. The suite is intentionally
 *   string-based so it can validate generated and documentation artifacts without
 *   loading the editor runtime.
 *
 * Scope:
 *   - The public declarations bundle must not expose removed alias names.
 *   - Runtime source, demo HTML/JS, and generated declarations must not
 *     contain removed v1 DOM binding keys.
 *   - README and docs are scanned as published user-facing surfaces.
 *   - Changelog mentions are allowed only in the release section that documents the
 *     removals.
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
 *   - Keep this file focused on canonical alias absence across the publishable
 *     surface only.
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
 * source, demo HTML/JS, and generated declarations because v2 must expose
 * canonical DOM names only.
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

/**
 * Test files that may legitimately reference deprecated alias names.
 *
 * The allowlist covers the scrub itself, which holds the alias names as
 * data so it can search for them in other files.
 *
 * Every other file under `tests/` MUST be alias-free.
 */
const TEST_FILE_ALLOWLIST = new Set(['alias-scrub.test.mjs']);

/**
 * Markdown section heading that is allowed to reference deprecated alias
 * names in backtick-wrapped code spans. Release notes MUST list every
 * removed alias and its canonical replacement.
 */
const CHANGELOG_ALLOWED_SECTION = '[2.0.0]';

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
 * Strip HTML comments (`<!-- ... -->`). Embedded `<script>` and `<style>`
 * blocks are not specifically extracted because the only `docs/` HTML
 * file in this repository inlines no scripts or styles — both live in
 * dedicated `.js` and `.css` files that are scanned separately.
 */
function stripHtmlComments(source) {
    return source.replace(/<!--[\s\S]*?-->/g, '');
}

/** Strip CSS block comments (`/* ... *\/`). */
function stripCssComments(source) {
    return source.replace(/\/\*[\s\S]*?\*\//g, '');
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

/**
 * Extract every code span from a markdown source: triple-backtick
 * fenced blocks AND single-backtick inline spans. Returns the raw
 * span contents joined by newlines so a single regex scan can sweep
 * them. Markdown text outside code spans is intentionally NOT
 * returned — alias mentions in prose ("merge", "reset" as English
 * words) are not identifier references and are not scanned.
 */
function extractMarkdownCodeSpans(markdown) {
    const spans = [];
    // Fenced code blocks (```...```), captured first so their `\n`
    // contents are not later matched by the inline-span regex.
    const fencedRe = /```[\s\S]*?```/g;
    let m;
    while ((m = fencedRe.exec(markdown)) !== null) spans.push(m[0]);
    // Inline code spans (`...`) — restricted to a single line by `[^`\n]+`.
    // The fenced-block scan above has already consumed multi-line ranges,
    // but inline spans inside fenced blocks would be re-scanned here as
    // strings. That is fine: re-scanning the same alias span produces
    // the same alias hit, and the scan is for presence not count.
    const inlineRe = /`[^`\n]+`/g;
    while ((m = inlineRe.exec(markdown)) !== null) spans.push(m[0]);
    return spans.join('\n');
}

/**
 * Split a markdown document into `## ` sections. Returns a map keyed
 * by the heading text (with the leading `## ` stripped) whose values
 * are the section body up to the next `## ` heading or end of file.
 * Content above the first `## ` heading is keyed under the empty
 * string so the preamble is still scanned.
 */
function splitMarkdownByH2(markdown) {
    const sections = new Map();
    const headingRe = /^## (.+)$/gm;
    const matches = [...markdown.matchAll(headingRe)];
    if (matches.length === 0) {
        sections.set('', markdown);
        return sections;
    }
    if (matches[0].index > 0) {
        sections.set('', markdown.slice(0, matches[0].index));
    }
    for (let i = 0; i < matches.length; i++) {
        const heading = matches[i][1].trim();
        const start = matches[i].index + matches[i][0].length;
        const end = i + 1 < matches.length ? matches[i + 1].index : markdown.length;
        sections.set(heading, markdown.slice(start, end));
    }
    return sections;
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

// ─── 1. dist/types declarations ──────────────────────────

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

test('v2 runtime source, demo docs, and declarations contain no removed v1 DOM keys', async () => {
    const groups = [
        {
            label: 'src/**/*.ts',
            dir: path.join(repoRoot, 'src'),
            predicate: (name) => name.endsWith('.ts'),
        },
        {
            label: 'docs/**/*.html',
            dir: path.join(repoRoot, 'docs'),
            predicate: (name) => name.endsWith('.html'),
        },
        {
            label: 'docs/**/*.js',
            dir: path.join(repoRoot, 'docs'),
            predicate: (name) => name.endsWith('.js'),
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
        `Removed v1 DOM binding keys must not appear in v2 runtime source, ` +
            `demo HTML/JS, or generated declarations. Offenders: ${JSON.stringify(offenders)}`,
    );
});

// ─── 2. README.md ───────────────────────────────────────

test('`README.md` contains no deprecated alias inside any code span', async () => {
    const source = await fs.readFile(path.join(repoRoot, 'README.md'), 'utf8');
    const codeText = extractMarkdownCodeSpans(source);
    const found = findAliases(codeText);
    assert.deepEqual(
        found.map((f) => f.alias),
        [],
        `README.md must not reference any deprecated alias as a code identifier ` +
            `. Offending hits: ${JSON.stringify(found)}`,
    );
});

// ─── 3. docs/ ───────────────────────────────────────────

test('`docs/*.html` contains no deprecated alias identifier', async () => {
    const htmlFiles = await listFiles(path.join(repoRoot, 'docs'), (name) =>
        name.endsWith('.html'),
    );
    for (const filePath of htmlFiles) {
        const source = await fs.readFile(filePath, 'utf8');
        const stripped = stripHtmlComments(source);
        const found = findAliases(stripped);
        assert.deepEqual(
            found.map((f) => f.alias),
            [],
            `${path.relative(repoRoot, filePath)} must not reference any ` +
                `deprecated alias identifier. ` +
                `Offending hits: ${JSON.stringify(found)}`,
        );
    }
});

test('`docs/css/*.css` contains no deprecated alias identifier', async () => {
    const cssFiles = await listFiles(path.join(repoRoot, 'docs'), (name) => name.endsWith('.css'));
    for (const filePath of cssFiles) {
        const source = await fs.readFile(filePath, 'utf8');
        const stripped = stripCssComments(source);
        const found = findAliases(stripped);
        assert.deepEqual(
            found.map((f) => f.alias),
            [],
            `${path.relative(repoRoot, filePath)} must not reference any ` +
                `deprecated alias identifier. ` +
                `Offending hits: ${JSON.stringify(found)}`,
        );
    }
});

test('`docs/js/*.js` contains no deprecated alias identifier', async () => {
    const jsFiles = await listFiles(path.join(repoRoot, 'docs'), (name) => name.endsWith('.js'));
    for (const filePath of jsFiles) {
        const source = await fs.readFile(filePath, 'utf8');
        const stripped = stripJsCommentsAndStrings(source);
        const found = findAliases(stripped);
        assert.deepEqual(
            found.map((f) => f.alias),
            [],
            `${path.relative(repoRoot, filePath)} must not reference any ` +
                `deprecated alias identifier. ` +
                `Offending hits: ${JSON.stringify(found)}`,
        );
    }
});

// ─── 4. tests/ ───────────────────────────────────────────

test('`tests/**/*.test.mjs` outside the allowlist contains no deprecated alias identifier', async () => {
    const testFiles = await listFiles(
        path.join(repoRoot, 'tests'),
        (name) => name.endsWith('.test.mjs') || name.endsWith('.mjs'),
    );
    for (const filePath of testFiles) {
        const baseName = path.basename(filePath);
        if (TEST_FILE_ALLOWLIST.has(baseName)) continue;
        const source = await fs.readFile(filePath, 'utf8');
        const stripped = stripJsCommentsAndStrings(source);
        const found = findAliases(stripped);
        assert.deepEqual(
            found.map((f) => f.alias),
            [],
            `${path.relative(repoRoot, filePath)} must not reference any ` +
                `deprecated alias identifier outside the documented allowlist ` +
                `. Offending hits: ${JSON.stringify(found)}`,
        );
    }
});

// ─── 5. CHANGELOG.md ────────────────────────────────────

test('`CHANGELOG.md` confines deprecated alias mentions to the `## [2.0.0]` section', async () => {
    const source = await fs.readFile(path.join(repoRoot, 'CHANGELOG.md'), 'utf8');
    const sections = splitMarkdownByH2(source);
    const offenders = [];
    for (const [heading, body] of sections) {
        if (heading.startsWith(CHANGELOG_ALLOWED_SECTION)) continue;
        const codeText = extractMarkdownCodeSpans(body);
        const found = findAliases(codeText);
        for (const hit of found) {
            offenders.push({ section: heading || '<preamble>', alias: hit.alias });
        }
    }
    assert.deepEqual(
        offenders,
        [],
        `CHANGELOG.md may only reference deprecated alias identifiers in the ` +
            `\`## ${CHANGELOG_ALLOWED_SECTION}\` section. ` +
            `Offending sections: ${JSON.stringify(offenders)}`,
    );
});

test('`CHANGELOG.md` `## [2.0.0]` section lists every removed deprecated alias', async () => {
    // Release notes intentionally list every removed alias with its canonical
    // replacement.
    // This test pairs with the scope-restriction test above: confirming
    // the allowed section actually exercises the allowance.
    const source = await fs.readFile(path.join(repoRoot, 'CHANGELOG.md'), 'utf8');
    const sections = splitMarkdownByH2(source);
    let allowedBody = null;
    for (const [heading, body] of sections) {
        if (heading.startsWith(CHANGELOG_ALLOWED_SECTION)) {
            allowedBody = body;
            break;
        }
    }
    assert.ok(
        allowedBody !== null,
        `CHANGELOG.md must contain a \`## ${CHANGELOG_ALLOWED_SECTION}\` ` +
            `section listing the removed deprecated aliases`,
    );
    const codeText = extractMarkdownCodeSpans(allowedBody);
    const missing = DEPRECATED_ALIASES.filter((alias) => {
        const re = new RegExp(`\\b${alias}\\b`);
        return !re.test(codeText);
    });
    assert.deepEqual(
        missing,
        [],
        `CHANGELOG.md \`## ${CHANGELOG_ALLOWED_SECTION}\` section must list ` +
            `every removed deprecated alias in a code span. ` +
            `Missing: ${JSON.stringify(missing)}`,
    );
});

// ─── 6. package.json ────────────────────────────────────

test('`package.json` contains no deprecated alias identifier', async () => {
    // package.json is JSON, so there are no comments or string literals
    // to strip — every quoted value is meaningful as part of the
    // published package shape (script names, keywords, exports paths,
    // documentation strings). A bare alias appearance therefore is a
    // genuine surface leak.
    const source = await fs.readFile(path.join(repoRoot, 'package.json'), 'utf8');
    const found = findAliases(source);
    assert.deepEqual(
        found.map((f) => f.alias),
        [],
        `package.json must not reference any deprecated alias identifier ` +
            `. Offending hits: ${JSON.stringify(found)}`,
    );
});
