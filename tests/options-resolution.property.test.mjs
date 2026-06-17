/**
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies src/core/default-options.ts resolveOptions behavior for arbitrary
 *   partial option objects. The suite checks default completeness, nested label and
 *   crop merges, unknown key filtering, callback preservation, and immutability of
 *   resolved nested options.
 *
 * Scope:
 *   - Every required option key is present after resolution.
 *   - User-supplied nested values override defaults without mutating the defaults
 *     object.
 *   - Later mutation of the input object does not affect the resolved options.
 *
 * Out of scope:
 *   - unrelated editor features
 *   - visual rendering quality
 *   - browser-specific integration details
 *
 * Environment:
 *   - Node.js ESM
 *   - fast-check generated cases where applicable
 *
 * Run:
 *   node --test tests/options-resolution.property.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on options resolution completeness and deep merge only.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

import {
    resolveOptions,
    DEFAULT_OPTIONS,
    DEFAULT_LABEL,
    DEFAULT_CROP,
    DEFAULT_MOSAIC_CONFIG,
    DEFAULT_TEXT_ANNOTATION_CONFIG,
    DEFAULT_DRAW_CONFIG,
} from '../src/core/default-options.ts';

// ─── Documented option-key inventories ─────────────────────────────────────

const TOP_LEVEL_SCALAR_KEYS = [
    'canvasWidth',
    'canvasHeight',
    'backgroundColor',
    'animationDuration',
    'minScale',
    'maxScale',
    'scaleStep',
    'rotationStep',
    'defaultLayoutMode',
    'downsampleOnLoad',
    'downsampleMaxWidth',
    'downsampleMaxHeight',
    'downsampleQuality',
    'preserveSourceFormat',
    'downsampleMimeType',
    'imageLoadTimeoutMs',
    'maxHistorySize',
    'exportMultiplier',
    'maxExportPixels',
    'exportAreaByDefault',
    'mergeMasksByDefault',
    'mergeAnnotationsByDefault',
    'defaultMaskWidth',
    'defaultMaskHeight',
    'maskRotatable',
    'maskLabelOnSelect',
    'maskLabelOffset',
    'maskName',
    'textAnnotationName',
    'drawAnnotationName',
    'groupSelection',
    'showPlaceholder',
    'initialImageBase64',
    'defaultDownloadFileName',
];

const CALLBACK_KEYS = [
    'onImageLoadStart',
    'onImageLoaded',
    'onImageCleared',
    'onImageChanged',
    'onBusyChange',
    'onEditorDisposed',
    'onMasksChanged',
    'onAnnotationsChanged',
    'onSelectionChange',
    'onError',
    'onWarning',
];

const ALL_TOP_LEVEL_KEYS = [
    ...TOP_LEVEL_SCALAR_KEYS,
    ...CALLBACK_KEYS,
    'layoutMode',
    'defaultMaskConfig',
    'label',
    'crop',
    'defaultMosaicConfig',
    'defaultTextConfig',
    'defaultDrawConfig',
];

// Default text-option keys we expect to survive deep-merge. Pulled from
// DEFAULT_LABEL.textOptions so the test stays in sync if defaults change.
const TEXT_OPTIONS_DEFAULT_KEYS = Object.keys(DEFAULT_LABEL.textOptions);

const CROP_KEYS = [
    'aspectRatio',
    'minWidth',
    'minHeight',
    'padding',
    'hideMasksDuringCrop',
    'preserveMasksAfterCrop',
    'allowRotationOfCropRect',
    'exportFileType',
    'exportQuality',
];

const MOSAIC_FORMAT_ALIASES = {
    jpg: 'jpeg',
    jpeg: 'jpeg',
    'image/jpeg': 'jpeg',
    png: 'png',
    'image/png': 'png',
    webp: 'webp',
    'image/webp': 'webp',
    source: 'source',
};

const UNKNOWN_KEY_PREFIX = '__fc_unknown_';

// ─── Arbitraries ───────────────────────────────────────────────────────────

function topLevelScalarOverridesArb() {
    return fc.record(
        {
            canvasWidth: fc.integer({ min: 1, max: 10000 }),
            canvasHeight: fc.integer({ min: 1, max: 10000 }),
            backgroundColor: fc.constantFrom('transparent', '#fff', '#000', 'red'),
            animationDuration: fc.integer({ min: 0, max: 2000 }),
            minScale: fc.double({ min: 0.01, max: 1, noNaN: true, noDefaultInfinity: true }),
            maxScale: fc.double({ min: 1, max: 10, noNaN: true, noDefaultInfinity: true }),
            scaleStep: fc.double({ min: 0.01, max: 0.5, noNaN: true, noDefaultInfinity: true }),
            rotationStep: fc.integer({ min: 1, max: 360 }),
            defaultLayoutMode: fc.constantFrom('fit', 'cover', 'expand'),
            downsampleOnLoad: fc.boolean(),
            downsampleMaxWidth: fc.integer({ min: 100, max: 10000 }),
            downsampleMaxHeight: fc.integer({ min: 100, max: 10000 }),
            downsampleQuality: fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
            preserveSourceFormat: fc.boolean(),
            downsampleMimeType: fc.option(
                fc.constantFrom('image/png', 'image/jpeg', 'image/webp'),
                { nil: null },
            ),
            imageLoadTimeoutMs: fc.integer({ min: 1, max: 600000 }),
            maxHistorySize: fc.integer({ min: 1, max: 500 }),
            exportMultiplier: fc.double({
                min: 0.1,
                max: 10,
                noNaN: true,
                noDefaultInfinity: true,
            }),
            maxExportPixels: fc.integer({ min: 1, max: 100000000 }),
            exportAreaByDefault: fc.constantFrom('image', 'canvas'),
            mergeMasksByDefault: fc.boolean(),
            mergeAnnotationsByDefault: fc.boolean(),
            defaultMaskWidth: fc.integer({ min: 1, max: 1000 }),
            defaultMaskHeight: fc.integer({ min: 1, max: 1000 }),
            maskRotatable: fc.boolean(),
            maskLabelOnSelect: fc.boolean(),
            maskLabelOffset: fc.integer({ min: 0, max: 100 }),
            maskName: fc.string(),
            textAnnotationName: fc.string(),
            drawAnnotationName: fc.string(),
            groupSelection: fc.boolean(),
            showPlaceholder: fc.boolean(),
            initialImageBase64: fc.option(fc.string(), { nil: null }),
            defaultDownloadFileName: fc.string({ minLength: 1, maxLength: 64 }),
        },
        { requiredKeys: [] },
    );
}

// Mix of well-formed function callbacks and "garbage" non-function values.
// the documented contract says non-function values must collapse to `null`, while
// the documented contract says functions must be preserved with their public
// `(error, message)` argument order — preservation by identity covers it.
function callbackArb(label) {
    return fc.oneof(
        fc.constant(undefined),
        fc.constant(null),
        fc.string(),
        fc.integer(),
        fc.boolean(),
        // A plain object, including ones that happen to expose a `call` field —
        // still not a function, must be normalized to null.
        fc.constant({ call: () => 0 }),
        // Genuine function so we can test identity preservation.
        fc.constant(function namedCallback(error, message) {
            return [label, error, message];
        }),
    );
}

function callbacksArb() {
    return fc.record(
        {
            onImageLoaded: callbackArb('onImageLoaded'),
            onImageLoadStart: callbackArb('onImageLoadStart'),
            onImageCleared: callbackArb('onImageCleared'),
            onImageChanged: callbackArb('onImageChanged'),
            onBusyChange: callbackArb('onBusyChange'),
            onEditorDisposed: callbackArb('onEditorDisposed'),
            onMasksChanged: callbackArb('onMasksChanged'),
            onAnnotationsChanged: callbackArb('onAnnotationsChanged'),
            onSelectionChange: callbackArb('onSelectionChange'),
            onError: callbackArb('onError'),
            onWarning: callbackArb('onWarning'),
        },
        { requiredKeys: [] },
    );
}

function textOptionsOverridesArb() {
    return fc.record(
        {
            fontSize: fc.integer({ min: 1, max: 100 }),
            fill: fc.constantFrom('#fff', '#000', 'red', '#abcabc'),
            backgroundColor: fc.constantFrom('rgba(0,0,0,0.7)', '#abc', 'transparent'),
            padding: fc.integer({ min: 0, max: 20 }),
            fontFamily: fc.constantFrom('monospace', 'serif', 'sans-serif'),
            fontWeight: fc.constantFrom('bold', 'normal', '500'),
            selectable: fc.boolean(),
            evented: fc.boolean(),
            originX: fc.constantFrom('left', 'center', 'right'),
            originY: fc.constantFrom('top', 'center', 'bottom'),
        },
        { requiredKeys: [] },
    );
}

function labelArb() {
    return fc.record(
        {
            // `getText` must be a function to be honored; otherwise the default
            // implementation applies.
            getText: fc.oneof(
                fc.constant(undefined),
                fc.constant(null),
                fc.constant('not-a-fn'),
                fc.constant((mask) => `text:${mask?.maskName ?? '_'}`),
            ),
            textOptions: fc.oneof(fc.constant(undefined), textOptionsOverridesArb()),
            // `create` is treated like `getText`: only honored when callable.
            create: fc.oneof(
                fc.constant(undefined),
                fc.constant(null),
                fc.constant(123),
                fc.constant(() => null),
            ),
        },
        { requiredKeys: [] },
    );
}

function cropArb() {
    return fc.record(
        {
            minWidth: fc.integer({ min: 1, max: 10000 }),
            minHeight: fc.integer({ min: 1, max: 10000 }),
            padding: fc.integer({ min: 0, max: 1000 }),
            hideMasksDuringCrop: fc.boolean(),
            preserveMasksAfterCrop: fc.boolean(),
            allowRotationOfCropRect: fc.boolean(),
            exportFileType: fc.constantFrom(
                'source',
                'png',
                'jpeg',
                'jpg',
                'webp',
                'image/png',
                'image/jpeg',
                'image/webp',
            ),
            exportQuality: fc.option(
                fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
                { nil: undefined },
            ),
        },
        { requiredKeys: [] },
    );
}

function mosaicArb() {
    return fc.record(
        {
            brushSize: fc.integer({ min: 1, max: 200 }),
            blockSize: fc.double({ min: 1, max: 80, noNaN: true, noDefaultInfinity: true }),
            previewStroke: fc.constantFrom('#333', '#f00', 'rgba(0,0,0,0.4)'),
            previewStrokeWidth: fc.double({
                min: 0,
                max: 10,
                noNaN: true,
                noDefaultInfinity: true,
            }),
            previewStrokeDashArray: fc.option(
                fc.array(fc.double({ min: 0, max: 20, noNaN: true, noDefaultInfinity: true }), {
                    maxLength: 4,
                }),
                { nil: null },
            ),
            previewFill: fc.constantFrom('rgba(0,0,0,0)', 'rgba(255,0,0,0.1)'),
            outputFileType: fc.constantFrom(
                'source',
                'png',
                'jpeg',
                'jpg',
                'webp',
                'image/png',
                'image/jpeg',
                'image/webp',
            ),
            outputQuality: fc.option(
                fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
                { nil: undefined },
            ),
        },
        { requiredKeys: [] },
    );
}

// Random unknown top-level keys, name-spaced so they cannot collide with the
// documented top-level keys. They MUST be silently dropped.
function unknownKeysArb() {
    return fc.dictionary(
        fc.string({ minLength: 1, maxLength: 8 }).map((s) => `${UNKNOWN_KEY_PREFIX}${s}`),
        fc.oneof(
            fc.integer(),
            fc.string(),
            fc.boolean(),
            fc.constant(null),
            fc.constant({ nested: true }),
        ),
        { maxKeys: 4 },
    );
}

function partialOptionsArb() {
    return fc
        .tuple(
            topLevelScalarOverridesArb(),
            callbacksArb(),
            fc.option(labelArb(), { nil: undefined }),
            fc.option(cropArb(), { nil: undefined }),
            fc.option(mosaicArb(), { nil: undefined }),
            unknownKeysArb(),
        )
        .map(([scalars, callbacks, label, crop, mosaic, unknown]) => {
            const u = { ...scalars, ...callbacks, ...unknown };
            if (label !== undefined) u.label = label;
            if (crop !== undefined) u.crop = crop;
            if (mosaic !== undefined) u.defaultMosaicConfig = mosaic;
            return u;
        });
}

// ─── Property assertion ────────────────────────────────────────────────────

test('options resolution completeness and deep-merge', () => {
    fc.assert(
        fc.property(partialOptionsArb(), (input) => {
            const resolved = resolveOptions(input);

            // Every documented top-level key is present.
            for (const key of ALL_TOP_LEVEL_KEYS) {
                assert.ok(key in resolved, `expected resolved to contain key '${key}'`);
            }

            // `preserveSourceFormat` defaults to source-preserving exports.
            if (!('preserveSourceFormat' in input)) {
                assert.equal(
                    resolved.preserveSourceFormat,
                    true,
                    'default preserveSourceFormat must be true',
                );
            } else {
                assert.equal(resolved.preserveSourceFormat, input.preserveSourceFormat);
            }

            // `imageLoadTimeoutMs` defaults to the documented timeout.
            if (!('imageLoadTimeoutMs' in input)) {
                assert.equal(
                    resolved.imageLoadTimeoutMs,
                    30000,
                    'default imageLoadTimeoutMs must be 30000',
                );
            } else {
                assert.equal(resolved.imageLoadTimeoutMs, input.imageLoadTimeoutMs);
            }

            // Every user-supplied scalar key passes through; unsupplied keys
            // fall back to defaults.
            for (const key of TOP_LEVEL_SCALAR_KEYS) {
                if (key in input) {
                    assert.deepEqual(
                        resolved[key],
                        input[key],
                        `scalar override for '${key}' must propagate`,
                    );
                } else {
                    assert.deepEqual(
                        resolved[key],
                        DEFAULT_OPTIONS[key],
                        `default for '${key}' must apply`,
                    );
                }
            }
            assert.equal(
                resolved.layoutMode,
                resolved.defaultLayoutMode,
                'resolved.layoutMode must initialize from resolved.defaultLayoutMode',
            );

            // Non-function callbacks are normalized to null. Function
            // callbacks are preserved by identity so the public
            // `(error, message)` argument order is preserved at the call site.
            for (const cbKey of CALLBACK_KEYS) {
                const userVal = input[cbKey];
                if (typeof userVal === 'function') {
                    assert.equal(
                        resolved[cbKey],
                        userVal,
                        `function ${cbKey} must be preserved by identity`,
                    );
                } else {
                    assert.equal(
                        resolved[cbKey],
                        null,
                        `non-function ${cbKey} must be normalized to null`,
                    );
                }
            }

            // `label.textOptions` is deep-merged with documented defaults.
            const userTextOpts = input.label?.textOptions ?? {};
            const defaultTextOpts = DEFAULT_LABEL.textOptions;
            for (const key of TEXT_OPTIONS_DEFAULT_KEYS) {
                if (key in userTextOpts) {
                    assert.deepEqual(
                        resolved.label.textOptions[key],
                        userTextOpts[key],
                        `user textOptions.${key} must override default`,
                    );
                } else {
                    assert.deepEqual(
                        resolved.label.textOptions[key],
                        defaultTextOpts[key],
                        `default textOptions.${key} must apply`,
                    );
                }
            }

            // label.getText falls back to the documented default when the user
            // value is not callable.
            if (typeof input.label?.getText === 'function') {
                assert.equal(resolved.label.getText, input.label.getText);
            } else {
                assert.equal(resolved.label.getText, DEFAULT_LABEL.getText);
            }

            // crop.* deep-merged with crop defaults.
            const userCrop = input.crop ?? {};
            for (const key of CROP_KEYS) {
                if (key in userCrop) {
                    assert.equal(
                        resolved.crop[key],
                        userCrop[key],
                        `user crop.${key} must override default`,
                    );
                } else {
                    assert.equal(
                        resolved.crop[key],
                        DEFAULT_CROP[key],
                        `default crop.${key} must apply`,
                    );
                }
            }
            if (!('preserveMasksAfterCrop' in userCrop)) {
                assert.equal(
                    resolved.crop.preserveMasksAfterCrop,
                    false,
                    'crop.preserveMasksAfterCrop default must be false',
                );
            }

            const userMosaic = input.defaultMosaicConfig ?? {};
            assert.equal(
                resolved.defaultMosaicConfig.brushSize,
                'brushSize' in userMosaic ? userMosaic.brushSize : DEFAULT_MOSAIC_CONFIG.brushSize,
            );
            assert.equal(
                resolved.defaultMosaicConfig.blockSize,
                'blockSize' in userMosaic
                    ? Math.max(1, Math.floor(userMosaic.blockSize))
                    : DEFAULT_MOSAIC_CONFIG.blockSize,
            );
            assert.equal(
                resolved.defaultMosaicConfig.outputFileType,
                'outputFileType' in userMosaic
                    ? MOSAIC_FORMAT_ALIASES[userMosaic.outputFileType]
                    : DEFAULT_MOSAIC_CONFIG.outputFileType,
            );
            assert.deepEqual(
                resolved.defaultTextConfig,
                DEFAULT_TEXT_ANNOTATION_CONFIG,
                'default text annotation config must apply when not overridden',
            );
            assert.deepEqual(
                resolved.defaultDrawConfig,
                DEFAULT_DRAW_CONFIG,
                'default draw config must apply when not overridden',
            );

            // Unknown top-level keys are silently dropped.
            for (const k of Object.keys(input)) {
                if (k.startsWith(UNKNOWN_KEY_PREFIX)) {
                    assert.equal(
                        k in resolved,
                        false,
                        `unknown key '${k}' must be dropped from resolved`,
                    );
                }
            }

            // Resolved options and nested config objects are frozen.
            assert.equal(Object.isFrozen(resolved), true, 'resolved options must be frozen');
            assert.equal(Object.isFrozen(resolved.label), true, 'resolved.label must be frozen');
            assert.equal(
                Object.isFrozen(resolved.label.textOptions),
                true,
                'resolved.label.textOptions must be frozen',
            );
            assert.equal(
                Object.isFrozen(resolved.defaultMaskConfig),
                true,
                'resolved.defaultMaskConfig must be frozen',
            );
            if (resolved.defaultMaskConfig.styles) {
                assert.equal(
                    Object.isFrozen(resolved.defaultMaskConfig.styles),
                    true,
                    'resolved.defaultMaskConfig.styles must be frozen',
                );
            }
            assert.equal(Object.isFrozen(resolved.crop), true, 'resolved.crop must be frozen');
            assert.equal(
                Object.isFrozen(resolved.defaultMosaicConfig),
                true,
                'resolved.defaultMosaicConfig must be frozen',
            );
            assert.equal(
                Object.isFrozen(resolved.defaultTextConfig),
                true,
                'resolved.defaultTextConfig must be frozen',
            );
            assert.equal(
                Object.isFrozen(resolved.defaultDrawConfig),
                true,
                'resolved.defaultDrawConfig must be frozen',
            );
            if (resolved.defaultMosaicConfig.previewStrokeDashArray) {
                assert.equal(
                    Object.isFrozen(resolved.defaultMosaicConfig.previewStrokeDashArray),
                    true,
                    'resolved.defaultMosaicConfig.previewStrokeDashArray must be frozen',
                );
            }

            // Post-construction mutation of U, U.label, U.label.textOptions,
            // and U.crop must NOT affect the live ResolvedOptions.
            const canvasWidthBefore = resolved.canvasWidth;
            const fontSizeBefore = resolved.label.textOptions.fontSize;
            const minWidthBefore = resolved.crop.minWidth;
            const mosaicBrushBefore = resolved.defaultMosaicConfig.brushSize;
            const getTextBefore = resolved.label.getText;

            // Mutate every reachable corner of the user object. Mutations on
            // frozen sub-objects (label / textOptions / crop) silently no-op
            // in non-strict mode and throw in strict mode — wrap each in a
            // try/catch so the test only asserts on observable post-state.
            try {
                input.canvasWidth = 0xdeadbeef;
            } catch {
                /* ignore */
            }
            try {
                input.imageLoadTimeoutMs = 0xdeadbeef;
            } catch {
                /* ignore */
            }
            try {
                if (input.label && typeof input.label === 'object') {
                    if (input.label.textOptions && typeof input.label.textOptions === 'object') {
                        input.label.textOptions.fontSize = 0xdeadbeef;
                        input.label.textOptions.__fc_injected = 'mutated';
                    }
                    input.label.getText = () => 'mutated';
                }
            } catch {
                /* ignore */
            }
            try {
                if (input.crop && typeof input.crop === 'object') {
                    input.crop.minWidth = 0xdeadbeef;
                    input.crop.preserveMasksAfterCrop = !input.crop.preserveMasksAfterCrop;
                }
            } catch {
                /* ignore */
            }
            try {
                if (input.defaultMosaicConfig && typeof input.defaultMosaicConfig === 'object') {
                    input.defaultMosaicConfig.brushSize = 0xdeadbeef;
                    input.defaultMosaicConfig.previewStrokeDashArray?.push(0xdeadbeef);
                }
            } catch {
                /* ignore */
            }

            assert.equal(
                resolved.canvasWidth,
                canvasWidthBefore,
                'mutating input.canvasWidth must not affect resolved',
            );
            assert.equal(
                resolved.label.textOptions.fontSize,
                fontSizeBefore,
                'mutating input.label.textOptions.fontSize must not affect resolved',
            );
            assert.equal(
                '__fc_injected' in resolved.label.textOptions,
                false,
                'injecting a key into input.label.textOptions must not affect resolved',
            );
            assert.equal(
                resolved.label.getText,
                getTextBefore,
                'mutating input.label.getText must not affect resolved',
            );
            assert.equal(
                resolved.crop.minWidth,
                minWidthBefore,
                'mutating input.crop.minWidth must not affect resolved',
            );
            assert.equal(
                resolved.defaultMosaicConfig.brushSize,
                mosaicBrushBefore,
                'mutating input.defaultMosaicConfig.brushSize must not affect resolved',
            );

            return true;
        }),
        { numRuns: 200 },
    );
});

test('downsampleQuality null falls back to the default quality', () => {
    const resolved = resolveOptions({ downsampleQuality: null });
    assert.equal(resolved.downsampleQuality, DEFAULT_OPTIONS.downsampleQuality);
});

test('defaultLayoutMode normalizes invalid values to expand', () => {
    for (const defaultLayoutMode of ['stretch', null, 123, false, {}, []]) {
        const resolved = resolveOptions({ defaultLayoutMode });

        assert.equal(resolved.defaultLayoutMode, 'expand');
        assert.equal(resolved.layoutMode, 'expand');
    }
});

test('removed layout boolean options are ignored', () => {
    const removedExpandKey = 'expandCanvas' + 'ToImage';
    const removedFitKey = 'fitImage' + 'ToCanvas';
    const removedCoverKey = 'coverImage' + 'ToCanvas';
    const resolved = resolveOptions({
        [removedExpandKey]: false,
        [removedFitKey]: true,
        [removedCoverKey]: true,
    });

    assert.equal(removedExpandKey in resolved, false);
    assert.equal(removedFitKey in resolved, false);
    assert.equal(removedCoverKey in resolved, false);
    assert.equal(resolved.defaultLayoutMode, 'expand');
    assert.equal(resolved.layoutMode, 'expand');
});

test('defaultMaskConfig is copied, frozen, and filters per-call hooks', () => {
    const onCreate = () => {};
    const fabricGenerator = () => null;
    const inputDefaultMaskConfig = {
        width: 120,
        color: 'rgba(255, 0, 0, 0.35)',
        selectable: false,
        onCreate,
        fabricGenerator,
        styles: {
            stroke: null,
            strokeWidth: 0,
            strokeDashArray: [6, 4],
        },
    };

    const resolved = resolveOptions({ defaultMaskConfig: inputDefaultMaskConfig });

    assert.notEqual(resolved.defaultMaskConfig, inputDefaultMaskConfig);
    assert.equal(resolved.defaultMaskConfig.width, 120);
    assert.equal(resolved.defaultMaskConfig.color, 'rgba(255, 0, 0, 0.35)');
    assert.equal(resolved.defaultMaskConfig.selectable, false);
    assert.equal('onCreate' in resolved.defaultMaskConfig, false);
    assert.equal('fabricGenerator' in resolved.defaultMaskConfig, false);
    assert.notEqual(resolved.defaultMaskConfig.styles, inputDefaultMaskConfig.styles);
    assert.equal(resolved.defaultMaskConfig.styles.stroke, null);
    assert.equal(resolved.defaultMaskConfig.styles.strokeWidth, 0);
    assert.deepEqual(resolved.defaultMaskConfig.styles.strokeDashArray, [6, 4]);
    assert.notEqual(
        resolved.defaultMaskConfig.styles.strokeDashArray,
        inputDefaultMaskConfig.styles.strokeDashArray,
    );
    assert.equal(Object.isFrozen(resolved.defaultMaskConfig), true);
    assert.equal(Object.isFrozen(resolved.defaultMaskConfig.styles), true);

    inputDefaultMaskConfig.width = 999;
    inputDefaultMaskConfig.styles.stroke = '#000000';
    inputDefaultMaskConfig.styles.strokeDashArray.push(8);

    assert.equal(resolved.defaultMaskConfig.width, 120);
    assert.equal(resolved.defaultMaskConfig.styles.stroke, null);
    assert.deepEqual(resolved.defaultMaskConfig.styles.strokeDashArray, [6, 4]);
});

test('invalid defaultMaskConfig values resolve to a frozen empty object', () => {
    for (const defaultMaskConfig of [undefined, null, false, 123, 'mask', [], () => ({})]) {
        const resolved = resolveOptions({ defaultMaskConfig });

        assert.deepEqual(resolved.defaultMaskConfig, {});
        assert.equal(Object.isFrozen(resolved.defaultMaskConfig), true);
    }
});

// Boundary cases — the documented contract with no input at all.
test('boundary: null/undefined/empty inputs return full default surface', () => {
    for (const input of [undefined, null, {}]) {
        const resolved = resolveOptions(input);

        for (const key of ALL_TOP_LEVEL_KEYS) {
            assert.ok(
                key in resolved,
                `expected resolved to contain key '${key}' for input ${String(input)}`,
            );
        }
        assert.equal(resolved.preserveSourceFormat, true);
        assert.equal(resolved.imageLoadTimeoutMs, 30000);
        assert.equal(resolved.crop.preserveMasksAfterCrop, false);
        assert.equal(Object.isFrozen(resolved), true);
        assert.equal(Object.isFrozen(resolved.label), true);
        assert.equal(Object.isFrozen(resolved.label.textOptions), true);
        assert.equal(Object.isFrozen(resolved.crop), true);
        assert.equal(Object.isFrozen(resolved.defaultMosaicConfig), true);
        assert.equal(Object.isFrozen(resolved.defaultTextConfig), true);
        assert.equal(Object.isFrozen(resolved.defaultDrawConfig), true);
        for (const callbackKey of CALLBACK_KEYS) {
            assert.equal(resolved[callbackKey], null);
        }
        assert.equal(resolved.maxHistorySize, 50);
        assert.equal(resolved.maxExportPixels, 50000000);
    }
});

test('maxHistorySize is normalized to a positive integer', () => {
    assert.equal(resolveOptions({ maxHistorySize: 7.9 }).maxHistorySize, 7);
    assert.equal(resolveOptions({ maxHistorySize: 0 }).maxHistorySize, 1);
    assert.equal(resolveOptions({ maxHistorySize: -10 }).maxHistorySize, 1);
    assert.equal(resolveOptions({ maxHistorySize: Number.NaN }).maxHistorySize, 50);
});

test('maxExportPixels is normalized to a positive integer', () => {
    assert.equal(resolveOptions({ maxExportPixels: 123.9 }).maxExportPixels, 123);
    assert.equal(resolveOptions({ maxExportPixels: null }).maxExportPixels, 50000000);
    assert.equal(resolveOptions({ maxExportPixels: -10 }).maxExportPixels, 50000000);
    assert.equal(resolveOptions({ maxExportPixels: Number.NaN }).maxExportPixels, 50000000);
});

test('invalid numeric options fall back to finite defaults', () => {
    const resolved = resolveOptions({
        canvasWidth: Number.NaN,
        canvasHeight: Infinity,
        animationDuration: -1,
        minScale: Number.NaN,
        maxScale: Infinity,
        scaleStep: 0,
        rotationStep: Number.NaN,
        downsampleMaxWidth: -100,
        downsampleMaxHeight: Number.NaN,
        imageLoadTimeoutMs: 0,
        exportMultiplier: -2,
        defaultMaskWidth: 0,
        defaultMaskHeight: -5,
        maskLabelOffset: -1,
        crop: {
            minWidth: Number.NaN,
            minHeight: Infinity,
            padding: -1,
            exportQuality: Infinity,
        },
    });

    assert.equal(resolved.canvasWidth, DEFAULT_OPTIONS.canvasWidth);
    assert.equal(resolved.canvasHeight, DEFAULT_OPTIONS.canvasHeight);
    assert.equal(resolved.animationDuration, DEFAULT_OPTIONS.animationDuration);
    assert.equal(resolved.minScale, DEFAULT_OPTIONS.minScale);
    assert.equal(resolved.maxScale, DEFAULT_OPTIONS.maxScale);
    assert.equal(resolved.scaleStep, DEFAULT_OPTIONS.scaleStep);
    assert.equal(resolved.rotationStep, DEFAULT_OPTIONS.rotationStep);
    assert.equal(resolved.downsampleMaxWidth, DEFAULT_OPTIONS.downsampleMaxWidth);
    assert.equal(resolved.downsampleMaxHeight, DEFAULT_OPTIONS.downsampleMaxHeight);
    assert.equal(resolved.imageLoadTimeoutMs, DEFAULT_OPTIONS.imageLoadTimeoutMs);
    assert.equal(resolved.exportMultiplier, DEFAULT_OPTIONS.exportMultiplier);
    assert.equal(resolved.defaultMaskWidth, DEFAULT_OPTIONS.defaultMaskWidth);
    assert.equal(resolved.defaultMaskHeight, DEFAULT_OPTIONS.defaultMaskHeight);
    assert.equal(resolved.maskLabelOffset, DEFAULT_OPTIONS.maskLabelOffset);
    assert.equal(resolved.crop.minWidth, DEFAULT_CROP.minWidth);
    assert.equal(resolved.crop.minHeight, DEFAULT_CROP.minHeight);
    assert.equal(resolved.crop.padding, DEFAULT_CROP.padding);
    assert.equal(resolved.crop.exportQuality, undefined);
});

test('numeric option edge cases normalize deterministically', () => {
    const zeroDuration = resolveOptions({ animationDuration: 0 });
    assert.equal(zeroDuration.animationDuration, 0, 'animationDuration=0 remains valid');

    const swappedScales = resolveOptions({ minScale: 5, maxScale: 1 });
    assert.equal(swappedScales.minScale, 1);
    assert.equal(swappedScales.maxScale, 5);

    const clampedCropQuality = resolveOptions({ crop: { exportQuality: 2 } });
    assert.equal(clampedCropQuality.crop.exportQuality, 1);
});
