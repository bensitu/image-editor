// Downsample MIME selection
//
//   For any source MIME, `preserveSourceFormat` flag, and explicit or
//   omitted `downsampleMimeType`, the resampler SHALL preserve
//   alpha-capable source MIME types (`image/png`, `image/webp`) only when
//   `preserveSourceFormat` is true and no explicit override is supplied,
//   SHALL use the explicit override when supplied, and SHALL fall back
//   to the lossy default (`image/jpeg`) otherwise.
//
// Owner module: `src/image/image-resampler.ts` — pure function
// `selectDownsampleMimeType(sourceMime, preserveSourceFormat,
// downsampleMimeType)` exposed for property testing without a DOM.
//
// Sub-properties exercised here:
//
//   4.1 Explicit override always wins: when
//       `downsampleMimeType` is truthy, output === downsampleMimeType.
//   4.2 PNG/WebP preservation: when `downsampleMimeType` is
//       unset (null/undefined) AND `preserveSourceFormat` is true AND
//       `sourceMime` ∈ {'image/png', 'image/webp'}, output === sourceMime.
//   4.3 Default to JPEG: when `downsampleMimeType` is unset
//       AND (`preserveSourceFormat` is false OR `sourceMime` is not
//       alpha-capable), output === 'image/jpeg'.
//
// Runtime note: Node 24+ strips TypeScript syntax natively, so the test
// imports the module under test directly from source — no separate build
// step is required. `selectDownsampleMimeType` is a pure function with
// no DOM dependency, so the property test runs without jsdom.
//
// `image-resampler.ts` carries a runtime `.js`-suffixed import to a sibling
// `.ts` module (the project compiles for browsers under
// `moduleResolution: "bundler"`). Node's native type stripping does not
// rewrite those specifiers, so we register the shared resolve hook that
// maps relative `.js` requests to `.ts` when the sibling source file
// exists. The resampler is pulled in via dynamic `import()` so the
// resolver is in place before its specifier is resolved.

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { selectDownsampleMimeType } = await import(
    '../src/image/image-resampler.ts'
);

// ─── Arbitraries ───────────────────────────────────────────────────────────

// Sources cover the alpha-capable MIMEs (png, webp), the lossy MIME
// (jpeg), unknown image MIMEs (gif, bmp), and the `null` case that
// `detectSourceMimeType` returns when the data URL prefix is unknown.
const sourceMimeArb = fc.constantFrom(
    'image/png',
    'image/jpeg',
    'image/webp',
    null,
    'image/gif',
    'image/bmp',
);

const preserveArb = fc.boolean();

// `downsampleMimeType` is typed as `ImageMimeType | null | undefined` in
// the public options, so the arbitrary covers both falsy variants.
const downsampleMimeArb = fc.constantFrom(
    'image/png',
    'image/jpeg',
    'image/webp',
    null,
    undefined,
);

const ALPHA_CAPABLE = new Set(['image/png', 'image/webp']);

// ─── Explicit override always wins ───────────────────────────

test('explicit downsampleMimeType always wins', () => {
    fc.assert(
        fc.property(
            sourceMimeArb,
            preserveArb,
            downsampleMimeArb,
            (sourceMime, preserveSourceFormat, downsampleMimeType) => {
                fc.pre(Boolean(downsampleMimeType));

                const out = selectDownsampleMimeType(
                    sourceMime,
                    preserveSourceFormat,
                    downsampleMimeType,
                );
                assert.equal(
                    out,
                    downsampleMimeType,
                    `override ${downsampleMimeType} must win over ` +
                        `sourceMime=${sourceMime}, ` +
                        `preserveSourceFormat=${preserveSourceFormat}`,
                );
                return true;
            },
        ),
        { numRuns: 100 },
    );
});

// ─── PNG/WebP preservation ───────────────────────────────────

test('PNG/WebP preserved when no override and preserveSourceFormat=true', () => {
    fc.assert(
        fc.property(
            sourceMimeArb,
            preserveArb,
            downsampleMimeArb,
            (sourceMime, preserveSourceFormat, downsampleMimeType) => {
                fc.pre(!downsampleMimeType);
                fc.pre(preserveSourceFormat === true);
                fc.pre(ALPHA_CAPABLE.has(sourceMime));

                const out = selectDownsampleMimeType(
                    sourceMime,
                    preserveSourceFormat,
                    downsampleMimeType,
                );
                assert.equal(
                    out,
                    sourceMime,
                    `alpha-capable sourceMime=${sourceMime} must survive ` +
                        `when preserveSourceFormat=true and no override ` +
                        `(downsampleMimeType=${downsampleMimeType})`,
                );
                return true;
            },
        ),
        { numRuns: 100 },
    );
});

// ─── Default to JPEG ────────────────────────────────────────

test('defaults to image/jpeg when no override and source not preserved', () => {
    fc.assert(
        fc.property(
            sourceMimeArb,
            preserveArb,
            downsampleMimeArb,
            (sourceMime, preserveSourceFormat, downsampleMimeType) => {
                fc.pre(!downsampleMimeType);
                fc.pre(
                    preserveSourceFormat === false ||
                        !ALPHA_CAPABLE.has(sourceMime),
                );

                const out = selectDownsampleMimeType(
                    sourceMime,
                    preserveSourceFormat,
                    downsampleMimeType,
                );
                assert.equal(
                    out,
                    'image/jpeg',
                    `expected JPEG fallback for sourceMime=${sourceMime}, ` +
                        `preserveSourceFormat=${preserveSourceFormat}, ` +
                        `downsampleMimeType=${downsampleMimeType}`,
                );
                return true;
            },
        ),
        { numRuns: 100 },
    );
});
