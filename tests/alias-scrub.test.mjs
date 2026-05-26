/**
 * Smoke test for the canonical alias-absence scrub across the
 * publishable repository surface.
 *
 * Behaviors under test:
 *
 *   1. **dist/types/index.d.ts is alias-free (Req 2.6)** — the
 *      canonical declarations bundle must not declare or reference any
 *      Deprecated_Alias identifier. Internal `.d.ts` files for non-
 *      exported modules are scoped out: Req 2.6 targets the public
 *      declarations bundle that downstream TypeScript consumers
 *      resolve through `package.json`'s `exports["."].types`.
 *   2. **README.md is alias-free (Req 35.1)** — no Deprecated_Alias
 *      identifier appears inside any backtick-delimited code span. The
 *      README is markdown prose; English words like "merge" or "reset"
 *      that appear outside backticks are not identifier mentions and
 *      are intentionally NOT scanned.
 *   3. **docs/ is alias-free (Req 35.2)** — neither HTML, CSS, nor
 *      embedded JavaScript under `docs/` references any
 *      Deprecated_Alias identifier. Comments and string literals are
 *      stripped from JavaScript before the scan so contextual mentions
 *      do not trip the check; element ids like `resetBtn` and i18n
 *      keys like `resetTransform` are not alias identifiers (no word
 *      boundary follows the alias prefix).
 *   4. **tests/ is alias-free (Req 2.7)** — no test file outside the
 *      defined allowlist references any Deprecated_Alias as a code
 *      identifier. The allowlist covers (a) the verification tests
 *      that hold alias names as string-literal data (so a regression
 *      that re-exports an alias surfaces by name) and (b) the
 *      property tests that exercise the internal Context interfaces
 *      whose field names share alias spelling (`containerEl`,
 *      `placeholderEl` — these mirror `image-loader.ts` and
 *      `export-service.ts` and are not on the public `ImageEditor`
 *      surface).
 *   5. **CHANGELOG.md alias mentions are confined to `## [2.0.0]`
 *      (Req 35.3)** — the v2 release section is required to list every
 *      removed Deprecated_Alias and its canonical replacement, so
 *      alias mentions are allowed there. No other section may
 *      reference an alias as a code identifier (i.e., inside backticks).
 *      English prose outside backticks is not scanned.
 *   6. **package.json is alias-free (Req 35.5)** — the published
 *      package manifest must not surface any Deprecated_Alias
 *      identifier in scripts, keywords, exports, or documentation
 *      strings.
 *
 * Skip behavior on a clean tree:
 *
 *   `dist/types/index.d.ts` is produced by `npm run build`. Tests run
 *   on a clean tree where `dist/` does not yet exist, so absence of
 *   the declarations file is the clean-tree skip signal — the assertion
 *   for that file returns early without failing. Requirement 2.6 is
 *   verified end-to-end by CI, which builds before testing. This
 *   mirrors the ENOENT skip path in `tests/build-artifacts.test.mjs`
 *   and `tests/dist-multi-format-exports.test.mjs`.
 *
 * The test reads files from disk only (no module side effects, no
 * Fabric/jsdom bootstrap) so it stays self-contained and fast.
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
 * The Deprecated_Alias set from Requirement 2.5 and the design's rename
 * table. The scrub flags every appearance of these identifiers within
 * the publishable surface.
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
 * The allowlist covers two categories:
 *
 *   1. **The alias-scrub itself** — holds the alias names as data so it
 *      can search for them in other files.
 *   2. **Internal Context fixture tests** — `transactional-load` and
 *      `merge-masks` build mock `LoadImageContext` / `MergeMasksContext`
 *      objects whose field names mirror the internal Context interfaces
 *      in `image-loader.ts` / `export-service.ts` (`containerEl`,
 *      `placeholderEl`). Those names are internal module wiring rather
 *      than public surface; the fixtures must use them verbatim to
 *      exercise the runtime code paths.
 *
 * Every other file under `tests/` MUST be alias-free.
 */
const TEST_FILE_ALLOWLIST = new Set([
    // (1) The scrub itself
    'alias-scrub.test.mjs',
    // (2) Internal Context fixture tests
    'transactional-load.property.test.mjs',
    'merge-masks.property.test.mjs',
]);

/**
 * Markdown section heading that is allowed to reference Deprecated_Alias
 * names in backtick-wrapped code spans, per Requirement 35.3 (the v2
 * release notes MUST list every removed alias and its canonical
 * replacement).
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

// ─── 1. dist/types/index.d.ts (Requirement 2.6) ────────────────────────────

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
        `(Requirement 2.6). Offending hits: ${JSON.stringify(found)}`,
    );
});

// ─── 2. README.md (Requirement 35.1) ───────────────────────────────────────

test('`README.md` contains no Deprecated_Alias inside any code span', async () => {
    const source = await fs.readFile(path.join(repoRoot, 'README.md'), 'utf8');
    const codeText = extractMarkdownCodeSpans(source);
    const found = findAliases(codeText);
    assert.deepEqual(
        found.map(f => f.alias),
        [],
        `README.md must not reference any Deprecated_Alias as a code identifier ` +
        `(Requirement 35.1). Offending hits: ${JSON.stringify(found)}`,
    );
});

// ─── 3. docs/ (Requirement 35.2) ───────────────────────────────────────────

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
            `Deprecated_Alias identifier (Requirement 35.2). ` +
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
            `Deprecated_Alias identifier (Requirement 35.2). ` +
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
            `Deprecated_Alias identifier (Requirement 35.2). ` +
            `Offending hits: ${JSON.stringify(found)}`,
        );
    }
});

// ─── 4. tests/ (Requirement 2.7) ───────────────────────────────────────────

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
            `(Requirement 2.7). Offending hits: ${JSON.stringify(found)}`,
        );
    }
});

// ─── 5. CHANGELOG.md (Requirement 35.3) ────────────────────────────────────

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
        `\`## ${CHANGELOG_ALLOWED_SECTION}\` section (Requirement 35.3). ` +
        `Offending sections: ${JSON.stringify(offenders)}`,
    );
});

test('`CHANGELOG.md` `## [2.0.0]` section lists every removed Deprecated_Alias', async () => {
    // Requirement 35.3 specifically calls out that the v2 release notes
    // must list every removed alias with its canonical replacement.
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
        `section listing the removed Deprecated_Aliases (Requirement 35.3)`,
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
        `every removed Deprecated_Alias in a code span (Requirement 35.3). ` +
        `Missing: ${JSON.stringify(missing)}`,
    );
});

// ─── 6. package.json (Requirement 35.5) ────────────────────────────────────

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
        `(Requirement 35.5). Offending hits: ${JSON.stringify(found)}`,
    );
});
