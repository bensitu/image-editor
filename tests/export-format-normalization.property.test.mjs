// Export format and quality normalization
//
//   For any supported file type alias and quality input, export format
//   normalization SHALL map `jpg` to `jpeg`, derive the correct MIME
//   type, clamp quality to `[0, 1]`, ignore quality for PNG, and use
//   the documented defaults when fields are omitted.
//
// Owner module: `src/export/export-format.ts` — pure helpers
// `normalizeImageFormat`, `mimeTypeFor`, `clampQuality`, and
// `resolveExportFormat`. They have no DOM dependency, so the property
// test runs without jsdom.
//
// Sub-properties exercised here:
//
//   22.1 jpg/jpeg case-insensitive collapse + MIME aliases:
//        `normalizeImageFormat` collapses any case variant of `'jpg'`,
//        `'jpeg'`, `'image/jpeg'` (and similarly png / webp) to the
//        canonical `NormalizedImageFormat` token, and `mimeTypeFor`
//        derives the matching `image/...` MIME from that token.
//
//   22.2 Unknown / nullish input defaults to jpeg:
//        `normalizeImageFormat` returns `'jpeg'` for `undefined`,
//        `null`, empty string, and any unrecognized alias.
//
//   22.3 fileType wins over format precedence:
//        Inside `resolveExportFormat`, when `fileType` is truthy it
//        determines the resolved format regardless of `format`. When
//        `fileType` is falsy (undefined / empty), `format` is consulted.
//        When both are omitted, the result is `'jpeg'`.
//
//   22.4 Finite-input quality clamp:
//        `clampQuality(q, fallback)` for any finite numeric `q`
//        returns a value in `[0, 1]` equal to `Math.max(0, Math.min(1, q))`.
//
//   22.5 Non-finite-input quality falls back:
//        `clampQuality(q, fallback)` returns `fallback` verbatim
//        whenever `Number(q)` is not finite (e.g. `NaN`, `±Infinity`,
//        non-numeric strings, plain objects). Inputs whose numeric
//        coercion is finite (e.g. `null`, `[]`, `''` → 0) are NOT
//        covered by this property — they take the clamp path instead
//        and are exercised by .
//
//   22.6 PNG output drops quality:
//        `resolveExportFormat` returns `quality === undefined` whenever
//        the resolved format is `'png'`, regardless of incoming quality.
//
//   22.7 Non-PNG quality threading:
//        For lossy formats (jpeg / webp), omitted or non-finite
//        `opts.quality` resolves to `downsampleQuality`, and finite
//        `opts.quality` resolves to its `[0, 1]` clamp.
//
//   22.8 Both fileType and format omitted → jpeg + downsampleQuality
//: `resolveExportFormat({}, dq)` and
//        `resolveExportFormat(undefined, dq)` both produce
//        `{ format: 'jpeg', mimeType: 'image/jpeg', quality: dq }`.
//
// Runtime note: Node 24+ strips TypeScript syntax natively, but
// `export-format.ts` carries `.js`-suffixed runtime imports to a
// sibling `.ts` module (the project compiles for browsers under
// `moduleResolution: "bundler"`). The shared resolve hook maps those
// relative `.js` requests to `.ts` when the sibling source file
// exists, so the test imports `export-format.ts` directly via dynamic
// `import()` after the hook is registered.

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
