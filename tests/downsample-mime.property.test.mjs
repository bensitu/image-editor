/**
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies src/image/downsample.ts MIME selection when preserving, overriding, or
 *   defaulting the output image type. The suite isolates the format-selection rules
 *   from the resampling canvas path.
 *
 * Scope:
 *   - Explicit downsampleMimeType wins over inferred source type.
 *   - PNG and WebP can be preserved when preserveSourceFormat is enabled.
 *   - Unsupported or missing source types fall back to image/jpeg.
 *
 * Out of scope:
 *   - unrelated editor features
 *   - visual rendering quality
 *   - browser-specific integration details
 *
 * Environment:
 *   - Node.js ESM
 *   - fast-check generated cases where applicable
 *   - Fabric/canvas behavior is mocked where needed
 *
 * Run:
 *   node --test tests/downsample-mime.property.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on downsample MIME selection only.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { selectDownsampleMimeType } = await import('../src/image/image-resampler.ts');

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
const downsampleMimeArb = fc.constantFrom('image/png', 'image/jpeg', 'image/webp', null, undefined);

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
                fc.pre(preserveSourceFormat === false || !ALPHA_CAPABLE.has(sourceMime));

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
