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
 * The Deprecated_Alias set the scrub flags across the publishable surface.
 */
const DEPRECATED_ALIASES = Object.freeze([
    'reset',
    'addMask',
    'merge',
    'getImageBase64',
    'canvasEl',
    'containerEl',
    'placeholderEl',
]);

/**
 * Test files that may legitimately reference Deprecated_Alias names.
 *
 * The allowlist covers the scrub itself, which holds the alias names as
 * data so it can search for them in other files.
 *
 * Every other file under `tests/` MUST be alias-free.
 */
const TEST_FILE_ALLOWLIST = new Set([
    'alias-scrub.test.mjs',
]);

/**
 * Markdown section heading that is allowed to reference Deprecated_Alias
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
    return source
        // Block comments first so a `//` inside `/* */` is not mis-handled.
        .replace(/\/\*[\s\S]*?\*\//g, '')
        // Line comments (// to EOL).
        .replace(/\/\/[^\n]*/g, '')
        // Single-quoted strings (with backslash-escape support).
        .replace(/'(?:\\.|[^'\\])*'/g, "''")
        // Double-quoted strings.
        .replace(/"(?:\\.|[^"\\])*"/g, '""')
        // Template literals (best-effort: no recursive `${}` parsing).
        .replace(/`(?:\\.|[^`\\])*`/g, '``');
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
 * Find every Deprecated_Alias occurrence in `text` using case-sensitive
 * word-boundary matching. Returns an array of `{ alias, index }` so
 * failures can name the offender precisely. Identifiers like
 * `resetBtn`, `resetTransform`, `mergeMasks`, and `addMaskBtn` are NOT
 * matched because the alias is followed (or preceded) by another word
 * character, so no word boundary exists.
 */
function findAliases(text) {
    const found = [];
    for (const alias of DEPRECATED_ALIASES) {
        const re = new RegExp(`\\b${alias}\\b`, 'g');
        let match;
        while ((match = re.exec(text)) !== null) {
            found.push({ alias, index: match.index });
        }
    }
    return found;
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
    } catch (err) {
        if (err && err.code === 'ENOENT') return [];
        throw err;
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

// ─── 1. dist/types/index.d.ts ────────────────────────────

test('`dist/types/index.d.ts` declares no Deprecated_Alias when present', async () => {
    const filePath = path.join(repoRoot, 'dist', 'types', 'index.d.ts');
    let source;
    try {
        source = await fs.readFile(filePath, 'utf8');
    } catch (err) {
        if (err && err.code === 'ENOENT') return; // clean-tree skip
        throw err;
    }
    const stripped = stripJsCommentsAndStrings(source);
    const found = findAliases(stripped);
    assert.deepEqual(
        found.map(f => f.alias),
        [],
        `dist/types/index.d.ts must not declare or reference any Deprecated_Alias ` +
        `. Offending hits: ${JSON.stringify(found)}`,
    );
});

// ─── 2. README.md ───────────────────────────────────────

test('`README.md` contains no Deprecated_Alias inside any code span', async () => {
    const source = await fs.readFile(path.join(repoRoot, 'README.md'), 'utf8');
    const codeText = extractMarkdownCodeSpans(source);
    const found = findAliases(codeText);
    assert.deepEqual(
        found.map(f => f.alias),
        [],
        `README.md must not reference any Deprecated_Alias as a code identifier ` +
        `. Offending hits: ${JSON.stringify(found)}`,
    );
});

// ─── 3. docs/ ───────────────────────────────────────────

test('`docs/*.html` contains no Deprecated_Alias identifier', async () => {
    const htmlFiles = await listFiles(
        path.join(repoRoot, 'docs'),
        name => name.endsWith('.html'),
    );
    for (const filePath of htmlFiles) {
        const source = await fs.readFile(filePath, 'utf8');
        const stripped = stripHtmlComments(source);
        const found = findAliases(stripped);
        assert.deepEqual(
            found.map(f => f.alias),
            [],
            `${path.relative(repoRoot, filePath)} must not reference any ` +
            `Deprecated_Alias identifier. ` +
            `Offending hits: ${JSON.stringify(found)}`,
        );
    }
});

test('`docs/css/*.css` contains no Deprecated_Alias identifier', async () => {
    const cssFiles = await listFiles(
        path.join(repoRoot, 'docs'),
        name => name.endsWith('.css'),
    );
    for (const filePath of cssFiles) {
        const source = await fs.readFile(filePath, 'utf8');
        const stripped = stripCssComments(source);
        const found = findAliases(stripped);
        assert.deepEqual(
            found.map(f => f.alias),
            [],
            `${path.relative(repoRoot, filePath)} must not reference any ` +
            `Deprecated_Alias identifier. ` +
            `Offending hits: ${JSON.stringify(found)}`,
        );
    }
});

test('`docs/js/*.js` contains no Deprecated_Alias identifier', async () => {
    const jsFiles = await listFiles(
        path.join(repoRoot, 'docs'),
        name => name.endsWith('.js'),
    );
    for (const filePath of jsFiles) {
        const source = await fs.readFile(filePath, 'utf8');
        const stripped = stripJsCommentsAndStrings(source);
        const found = findAliases(stripped);
        assert.deepEqual(
            found.map(f => f.alias),
            [],
            `${path.relative(repoRoot, filePath)} must not reference any ` +
            `Deprecated_Alias identifier. ` +
            `Offending hits: ${JSON.stringify(found)}`,
        );
    }
});

// ─── 4. tests/ ───────────────────────────────────────────

test('`tests/**/*.test.mjs` outside the allowlist contains no Deprecated_Alias identifier', async () => {
    const testFiles = await listFiles(
        path.join(repoRoot, 'tests'),
        name => name.endsWith('.test.mjs') || name.endsWith('.mjs'),
    );
    for (const filePath of testFiles) {
        const baseName = path.basename(filePath);
        if (TEST_FILE_ALLOWLIST.has(baseName)) continue;
        const source = await fs.readFile(filePath, 'utf8');
        const stripped = stripJsCommentsAndStrings(source);
        const found = findAliases(stripped);
        assert.deepEqual(
            found.map(f => f.alias),
            [],
            `${path.relative(repoRoot, filePath)} must not reference any ` +
            `Deprecated_Alias identifier outside the documented allowlist ` +
            `. Offending hits: ${JSON.stringify(found)}`,
        );
    }
});

// ─── 5. CHANGELOG.md ────────────────────────────────────

test('`CHANGELOG.md` confines Deprecated_Alias mentions to the `## [2.0.0]` section', async () => {
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
        `CHANGELOG.md may only reference Deprecated_Alias identifiers in the ` +
        `\`## ${CHANGELOG_ALLOWED_SECTION}\` section. ` +
        `Offending sections: ${JSON.stringify(offenders)}`,
    );
});

test('`CHANGELOG.md` `## [2.0.0]` section lists every removed Deprecated_Alias', async () => {
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
        `section listing the removed Deprecated_Aliases`,
    );
    const codeText = extractMarkdownCodeSpans(allowedBody);
    const missing = DEPRECATED_ALIASES.filter(alias => {
        const re = new RegExp(`\\b${alias}\\b`);
        return !re.test(codeText);
    });
    assert.deepEqual(
        missing,
        [],
        `CHANGELOG.md \`## ${CHANGELOG_ALLOWED_SECTION}\` section must list ` +
        `every removed Deprecated_Alias in a code span. ` +
        `Missing: ${JSON.stringify(missing)}`,
    );
});

// ─── 6. package.json ────────────────────────────────────

test('`package.json` contains no Deprecated_Alias identifier', async () => {
    // package.json is JSON, so there are no comments or string literals
    // to strip — every quoted value is meaningful as part of the
    // published package shape (script names, keywords, exports paths,
    // documentation strings). A bare alias appearance therefore is a
    // genuine surface leak.
    const source = await fs.readFile(path.join(repoRoot, 'package.json'), 'utf8');
    const found = findAliases(source);
    assert.deepEqual(
        found.map(f => f.alias),
        [],
        `package.json must not reference any Deprecated_Alias identifier ` +
        `. Offending hits: ${JSON.stringify(found)}`,
    );
});
