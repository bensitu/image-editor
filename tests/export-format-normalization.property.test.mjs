/**
 * @file export-format-normalization.property.test.mjs
 *
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies src/export/export-format.ts normalization for fileType, format aliases,
 *   MIME type selection, and quality clamping. The suite is pure and does not touch
 *   canvas export code.
 *
 * Scope:
 *   - JPEG aliases, MIME aliases, and case variants collapse to canonical formats.
 *   - fileType takes precedence over format, and omitted values default to jpeg.
 *   - Lossy quality is clamped to [0, 1], while PNG omits quality.
 *
 * Out of scope:
 *   - visual pixel-quality comparison
 *   - browser download UI details
 *   - unrelated image loading behavior
 *
 * Environment:
 *   - Node.js ESM
 *   - fast-check generated cases where applicable
 *   - Fabric/canvas behavior is mocked where needed
 *
 * Run:
 *   node --test tests/export-format-normalization.property.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on export format and quality normalization only.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const {
    normalizeImageFormat,
    mimeTypeFor,
    clampQuality,
    resolveExportFormat,
} = await import('../src/export/export-format.ts');

// ─── Reference tables ──────────────────────────────────────────────────────
//
// Independent re-statement of the alias / MIME tables documented in
// `export-format.ts`. The test uses these to compute expected values
// without re-importing implementation internals.

const FORMAT_ALIAS_TABLE = Object.freeze({
    jpeg: ['jpeg', 'jpg', 'image/jpeg'],
    png: ['png', 'image/png'],
    webp: ['webp', 'image/webp'],
});

const MIME_TABLE = Object.freeze({
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
});

// Set of every accepted alias (lowercased). Used by the "unknown input"
// arbitrary to filter random strings that would coincidentally collide
// with a real alias.
const KNOWN_ALIASES = new Set(
    Object.values(FORMAT_ALIAS_TABLE).flat(),
);

// ─── Arbitraries ───────────────────────────────────────────────────────────

/**
 * Pick a (canonical, alias) pair where `alias` is one of the documented
 * aliases for `canonical`, randomly cased to exercise the
 * case-insensitive lookup.
 */
function casedAliasArb(canonicals) {
    return fc
        .record({
            canonical: fc.constantFrom(...canonicals),
            idx: fc.nat(),
            caseMask: fc.integer({ min: 0, max: 0xffff }),
        })
        .map(({ canonical, idx, caseMask }) => {
            const aliases = FORMAT_ALIAS_TABLE[canonical];
            const base = aliases[idx % aliases.length];
            let alias = '';
            for (let i = 0; i < base.length; i++) {
                const ch = base[i];
                alias +=
                    ((caseMask >> (i % 16)) & 1) === 1
                        ? ch.toUpperCase()
                        : ch.toLowerCase();
            }
            return { canonical, alias };
        });
}

const anyAliasArb = casedAliasArb(['jpeg', 'png', 'webp']);
const lossyAliasArb = casedAliasArb(['jpeg', 'webp']);
const pngAliasArb = casedAliasArb(['png']);

// Strings the format table does not recognize. We sample from a small
// curated list so the test stays fast; randomness still selects which
// unknown value flows through `normalizeImageFormat`.
const unknownStringArb = fc
    .oneof(
        fc.constant(''),
        fc.constant('gif'),
        fc.constant('bmp'),
        fc.constant('image/gif'),
        fc.constant('image/bmp'),
        fc.constant('IMAGE/GIF'),
        fc.constant('jpg2000'),
        fc.constant('jpeg-xr'),
        fc.constant('not-a-format'),
        fc.constant('constructor'),
        fc.constant('toString'),
        fc.constant('hasOwnProperty'),
        fc.constant('   '),
        fc.string({ minLength: 1, maxLength: 12 }),
    )
    .filter((s) => !KNOWN_ALIASES.has(String(s).toLowerCase()));

// Nullish values that should also fall back to `'jpeg'`.
const nullishInputArb = fc.constantFrom(undefined, null);

// Finite numeric quality input — covers in-range, below-range, and
// above-range values so the clamp is exercised on all three sides.
const finiteQualityArb = fc.double({
    min: -10,
    max: 10,
    noNaN: true,
    noDefaultInfinity: true,
});

// Default-quality fallback. The editor pre-validates
// `downsampleQuality` to be in `[0, 1]` at construction time
//, so the arbitrary is bounded accordingly.
const fallbackQualityArb = fc.double({
    min: 0,
    max: 1,
    noNaN: true,
    noDefaultInfinity: true,
});

// Inputs that `Number(x)` reports as non-finite (NaN or ±Infinity).
// These are exactly the values for which `clampQuality` must fall back
//. Values like `null`, `[]`, `''` coerce to a finite
// `0` and therefore take the clamp path — they belong to .
const nonFiniteQualityArb = fc.oneof(
    fc.constant(NaN),
    fc.constant(Infinity),
    fc.constant(-Infinity),
    fc.constant(undefined),
    fc.constant('high'),
    fc.constant('not-a-number'),
    fc.constant({}),
    fc.constant({ valueOf: () => NaN }),
);

// ─── case-insensitive alias collapse + MIME ─────────────────

test('normalizeImageFormat collapses aliases case-insensitively', () => {
    fc.assert(
        fc.property(anyAliasArb, ({ canonical, alias }) => {
            const result = normalizeImageFormat(alias);
            assert.equal(
                result,
                canonical,
                `alias '${alias}' resolved to '${result}', expected '${canonical}'`,
            );
            assert.equal(
                mimeTypeFor(result),
                MIME_TABLE[canonical],
                `MIME for '${canonical}' must be '${MIME_TABLE[canonical]}'`,
            );
            return true;
        }),
        { numRuns: 200 },
    );
});

// ─── unknown / nullish input → jpeg ────────────────────────

test('nullish, empty, and unknown input default to jpeg', () => {
    fc.assert(
        fc.property(
            fc.oneof(nullishInputArb, unknownStringArb),
            (input) => {
                const result = normalizeImageFormat(input);
                assert.equal(
                    result,
                    'jpeg',
                    `unknown/nullish input ${JSON.stringify(input)} → ${result}, expected 'jpeg'`,
                );
                assert.equal(mimeTypeFor(result), 'image/jpeg');
                return true;
            },
        ),
        { numRuns: 200 },
    );
});

// ─── fileType wins over format ─────────────────────────────

test('resolveExportFormat — fileType wins over format; both omitted → jpeg', () => {
    fc.assert(
        fc.property(
            fc.option(anyAliasArb, { nil: undefined }),
            fc.option(anyAliasArb, { nil: undefined }),
            fallbackQualityArb,
            (fileTypeChoice, formatChoice, downsampleQuality) => {
                const opts = {
                    fileType: fileTypeChoice?.alias,
                    format: formatChoice?.alias,
                };
                const resolved = resolveExportFormat(opts, downsampleQuality);

                // Implementation mirrors legacy's `fileType || format`
                // (logical-or), so a falsy `fileType` falls through to
                // `format`. When both are absent, default to 'jpeg'.
                let expected;
                if (opts.fileType) {
                    expected = fileTypeChoice.canonical;
                } else if (opts.format) {
                    expected = formatChoice.canonical;
                } else {
                    expected = 'jpeg';
                }

                assert.equal(
                    resolved.format,
                    expected,
                    `precedence broken for fileType=${JSON.stringify(opts.fileType)}, ` +
                        `format=${JSON.stringify(opts.format)}: got ${resolved.format}, expected ${expected}`,
                );
                assert.equal(resolved.mimeType, MIME_TABLE[expected]);
                return true;
            },
        ),
        { numRuns: 200 },
    );
});

// ─── finite-input quality clamp ────────────────────────────

test('clampQuality clamps finite input to [0, 1]', () => {
    fc.assert(
        fc.property(finiteQualityArb, fallbackQualityArb, (q, fallback) => {
            const out = clampQuality(q, fallback);
            assert.ok(
                out >= 0 && out <= 1,
                `clamped output ${out} outside [0, 1] for input ${q}`,
            );
            assert.equal(
                out,
                Math.max(0, Math.min(1, q)),
                `clampQuality(${q}, ${fallback}) = ${out}; expected ${Math.max(0, Math.min(1, q))}`,
            );
            return true;
        }),
        { numRuns: 200 },
    );
});

// ─── non-finite quality falls back ─────────────────────────

test('clampQuality returns fallback for non-finite input', () => {
    fc.assert(
        fc.property(nonFiniteQualityArb, fallbackQualityArb, (q, fallback) => {
            const out = clampQuality(q, fallback);
            assert.equal(
                out,
                fallback,
                `non-finite input ${JSON.stringify(q)} should fall back to ${fallback}, got ${out}`,
            );
            return true;
        }),
        { numRuns: 100 },
    );
});

// ─── PNG drops quality ─────────────────────────────────────

test('resolveExportFormat returns undefined quality for PNG', () => {
    fc.assert(
        fc.property(
            pngAliasArb,
            // Mix of every quality input shape — finite, non-finite,
            // and nullish — so the PNG branch is exercised regardless
            // of incoming `quality`.
            fc.oneof(finiteQualityArb, nonFiniteQualityArb),
            fc.boolean(),
            fallbackQualityArb,
            ({ alias }, quality, useFileType, downsampleQuality) => {
                const opts = useFileType
                    ? { fileType: alias, quality }
                    : { format: alias, quality };
                const resolved = resolveExportFormat(opts, downsampleQuality);

                assert.equal(resolved.format, 'png');
                assert.equal(resolved.mimeType, 'image/png');
                assert.equal(
                    resolved.quality,
                    undefined,
                    `PNG must drop quality, got ${JSON.stringify(resolved.quality)}`,
                );
                return true;
            },
        ),
        { numRuns: 200 },
    );
});

// ─── non-PNG quality threading ─────────────────────────────

test('resolveExportFormat threads finite quality clamped to [0, 1] for lossy formats', () => {
    fc.assert(
        fc.property(
            lossyAliasArb,
            finiteQualityArb,
            fallbackQualityArb,
            ({ canonical, alias }, quality, downsampleQuality) => {
                const resolved = resolveExportFormat(
                    { fileType: alias, quality },
                    downsampleQuality,
                );
                assert.equal(resolved.format, canonical);
                assert.equal(resolved.mimeType, MIME_TABLE[canonical]);
                assert.equal(
                    resolved.quality,
                    Math.max(0, Math.min(1, quality)),
                    `expected clamp(${quality}) for ${canonical}, got ${resolved.quality}`,
                );
                return true;
            },
        ),
        { numRuns: 200 },
    );
});

test('resolveExportFormat falls back to downsampleQuality for omitted/non-finite quality on lossy formats', () => {
    // For `resolveExportFormat`, `null` / `undefined` count as "omitted"
    // and route through the `?? downsampleQuality` step before the clamp
    // (so they also resolve to `downsampleQuality`). Combine both
    // branches here so the property covers the whole "fallback" surface.
    const omittedOrNonFiniteArb = fc.oneof(
        nonFiniteQualityArb,
        fc.constant(null),
    );
    fc.assert(
        fc.property(
            lossyAliasArb,
            omittedOrNonFiniteArb,
            fallbackQualityArb,
            ({ canonical, alias }, quality, downsampleQuality) => {
                const resolved = resolveExportFormat(
                    { fileType: alias, quality },
                    downsampleQuality,
                );
                assert.equal(resolved.format, canonical);
                assert.equal(
                    resolved.quality,
                    downsampleQuality,
                    `omitted/non-finite quality ${JSON.stringify(quality)} should fall ` +
                        `back to ${downsampleQuality} for ${canonical}, got ${resolved.quality}`,
                );
                return true;
            },
        ),
        { numRuns: 200 },
    );
});

// ─── both fileType and format omitted → jpeg + fallback ────

test('omitted fileType/format defaults to jpeg with downsampleQuality', () => {
    fc.assert(
        fc.property(
            fallbackQualityArb,
            fc.oneof(
                fc.constant(undefined),
                fc.constant(null),
                fc.constant({}),
                // Object with both fields explicitly undefined — same
                // observable shape as `{}` per the documented contract.
                fc.constant({ fileType: undefined, format: undefined }),
            ),
            (downsampleQuality, opts) => {
                const resolved = resolveExportFormat(opts, downsampleQuality);
                assert.equal(resolved.format, 'jpeg');
                assert.equal(resolved.mimeType, 'image/jpeg');
                assert.equal(
                    resolved.quality,
                    downsampleQuality,
                    `expected fallback ${downsampleQuality}, got ${resolved.quality}`,
                );
                return true;
            },
        ),
        { numRuns: 100 },
    );
});
