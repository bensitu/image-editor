/**
 * Measures stable runtime workloads against maintenance performance thresholds.
 *
 * @module
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import { MementoService, StateSliceRegistry } from '../src/core-runtime/state/index.js';
import { HistoryPluginController } from '../src/plugins/history/history-controller.js';
import { createAnnotationPreset } from '../src/presets/annotation/index.js';
import { createFullPreset } from '../src/presets/full/index.js';
import { createMinimalPreset } from '../src/presets/minimal/index.js';
import { createRedactionPreset } from '../src/presets/redaction/index.js';
import { fabric, makeImageDataUrl, resetEditorDom } from '../tests/helpers/fabric-environment.mjs';

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsRoot, '..');
const thresholdPath = path.join(repositoryRoot, 'config', 'performance', 'thresholds.json');
const thresholds = JSON.parse(await readFile(thresholdPath, 'utf8'));
const failures = [];
const results = [];

if (typeof globalThis.gc !== 'function') {
    throw new Error('Performance checks require Node.js --expose-gc.');
}

function assertCondition(condition, message) {
    if (!condition) throw new Error(message);
}

function percentile(values, quantile) {
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.max(0, Math.ceil(sorted.length * quantile) - 1)] ?? 0;
}

function round(value, digits = 3) {
    const scale = 10 ** digits;
    return Math.round(value * scale) / scale;
}

async function runOnce(fixture, sampleIndex) {
    const started = performance.now();
    const value = await fixture.run(sampleIndex);
    const durationMs = performance.now() - started;
    return { durationMs, value };
}

async function measure(id, createFixture) {
    const policy = thresholds.fixtures[id];
    assertCondition(policy, `Missing performance threshold for ${id}.`);
    const sampleCount = policy.samples ?? thresholds.defaultSamples;
    const warmupCount = policy.warmups ?? thresholds.defaultWarmups;
    const fixture = await createFixture();

    for (let index = 0; index < warmupCount; index += 1) {
        const { value } = await runOnce(fixture, -index - 1);
        await fixture.afterEach?.(value);
    }

    globalThis.gc();
    const retainedBaseline = process.memoryUsage().heapUsed;
    const durations = [];
    const allocations = [];
    for (let index = 0; index < sampleCount; index += 1) {
        globalThis.gc();
        const heapBefore = process.memoryUsage().heapUsed;
        const { durationMs, value } = await runOnce(fixture, index);
        const heapAfter = process.memoryUsage().heapUsed;
        durations.push(durationMs);
        allocations.push(Math.max(0, heapAfter - heapBefore));
        await fixture.afterEach?.(value);
    }

    await fixture.teardown?.();
    globalThis.gc();
    const retainedBytes = Math.max(0, process.memoryUsage().heapUsed - retainedBaseline);
    const result = {
        id,
        samples: sampleCount,
        p50Ms: round(percentile(durations, 0.5)),
        p95Ms: round(percentile(durations, 0.95)),
        allocatedBytesP50: Math.round(percentile(allocations, 0.5)),
        allocatedBytesP95: Math.round(percentile(allocations, 0.95)),
        retainedBytes,
        ...fixture.attribution,
    };
    results.push(result);

    for (const [field, maximum] of [
        ['p95Ms', policy.p95Ms],
        ['allocatedBytesP95', policy.allocatedBytesP95],
        ['retainedBytes', policy.retainedBytes],
    ]) {
        if (result[field] > maximum) {
            failures.push(`${id} ${field}=${result[field]} exceeds ${maximum}.`);
        }
    }
}

function createMementoFixture(sliceCount, captureMode) {
    let coreState = { revision: 0, payload: 'core-state' };
    const sliceStates = Array.from({ length: sliceCount }, (_, index) => ({
        index,
        revision: 0,
        payload: `slice-${index}`,
    }));
    const registry = new StateSliceRegistry();
    for (let index = 0; index < sliceCount; index += 1) {
        registry.register({
            id: `performance:slice-${index}`,
            version: 1,
            capture: () => sliceStates[index],
            validate: (value) => ({ valid: true, value }),
            restore: (value) => {
                sliceStates[index] = value;
            },
        });
    }
    const service = new MementoService(
        {
            capture: () => coreState,
            restore: (value) => {
                coreState = value;
            },
            validateSnapshot: (value) => ({ valid: true, value }),
        },
        registry,
    );
    return {
        run(sampleIndex) {
            if (captureMode === 'dirty') {
                const revision = sampleIndex + 2;
                coreState = { revision, payload: 'core-state' };
                for (let index = 0; index < sliceStates.length; index += 1) {
                    sliceStates[index] = {
                        index,
                        revision,
                        payload: `slice-${index}`,
                    };
                }
            }
            return service.capture();
        },
        teardown: () => service.dispose(),
        attribution: {
            captureMode,
            sliceCount,
            ...(sliceCount > 0
                ? {
                      perSliceP50Ms: null,
                      perSliceP95Ms: null,
                  }
                : {}),
        },
    };
}

function frozenMemento(revision) {
    return Object.freeze({
        core: Object.freeze({ revision }),
        plugins: Object.freeze({}),
    });
}

function createHistoryFixture() {
    const state = {
        captureMemento: () => frozenMemento(-1),
        restoreMemento: async () => undefined,
        registerHistoryProvider: () => ({ dispose: () => undefined }),
        reportFatal: () => undefined,
    };
    return {
        run(sampleIndex) {
            const controller = new HistoryPluginController(
                state,
                { run: (_operationId, body) => body() },
                { maxSize: 100 },
                () => undefined,
            );
            for (let index = 0; index < 100; index += 1) {
                controller.push({
                    operationId: `performance:history-${sampleIndex}-${index}`,
                    before: frozenMemento(index),
                    after: frozenMemento(index + 1),
                    timestamp: index,
                });
            }
            assertCondition(
                controller.length === 100,
                'History fixture did not retain 100 records.',
            );
            return controller;
        },
        afterEach: (controller) => controller.dispose(),
        attribution: { recordCount: 100 },
    };
}

async function createPresetHarness(factory, options = {}) {
    const ids = resetEditorDom({ containerWidth: 360, containerHeight: 260 });
    const preset = factory(fabric, options);
    await preset.editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
    return preset;
}

function createMask(index) {
    const mask = new fabric.Rect({
        left: 8 + (index % 20) * 6,
        top: 8 + (index % 15) * 5,
        width: 12,
        height: 8,
        fill: '#111111',
        opacity: 0.7,
        strokeWidth: 0,
    });
    Object.assign(mask, {
        editorObjectKind: 'mask',
        maskId: index + 1,
        maskUid: `performance-mask-${index + 1}`,
        maskName: `performance-${index + 1}`,
        originalAlpha: 0.7,
        originalStroke: null,
        originalStrokeWidth: 0,
        lockRotation: true,
    });
    return mask;
}

function seedMasks(preset, count) {
    const canvas = preset.editor.getCanvas();
    const renderOnAddRemove = canvas.renderOnAddRemove;
    canvas.renderOnAddRemove = false;
    for (let index = 0; index < count; index += 1) canvas.add(createMask(index));
    canvas.renderOnAddRemove = renderOnAddRemove;
    canvas.requestRenderAll();
    assertCondition(
        preset.overlays.list({ includeHidden: true, includeLocked: true }).length === count,
        `Overlay fixture expected ${count} classified objects.`,
    );
}

async function createOverlayQueryFixture(count) {
    const preset = await createPresetHarness(createRedactionPreset, {
        transform: { animationDuration: 0 },
    });
    seedMasks(preset, count);
    return {
        run: () => {
            const overlays = preset.overlays.list({ includeHidden: true, includeLocked: true });
            assertCondition(
                overlays.length === count,
                `Overlay query returned ${overlays.length}.`,
            );
            return overlays;
        },
        teardown: async () => {
            await preset.editor.disposeAsync();
            document.body.innerHTML = '';
        },
        attribution: { overlayCount: count, operation: 'classified-list' },
    };
}

async function createOverlayStateFixture(operation) {
    const preset = await createPresetHarness(createRedactionPreset, {
        transform: { animationDuration: 0 },
        history: { maxSize: 100 },
    });
    await preset.editor.loadImage(makeImageDataUrl({ width: 200, height: 120 }));
    seedMasks(preset, 100);
    const exportedState = preset.overlayState.exportState();
    assertCondition(
        exportedState.overlays.length === 100,
        'Overlay State fixture export is incomplete.',
    );
    return {
        run: async () => {
            if (operation === 'export') return preset.overlayState.exportState();
            return preset.overlayState.importState(exportedState, { mode: 'replace' });
        },
        teardown: async () => {
            await preset.editor.disposeAsync();
            document.body.innerHTML = '';
        },
        attribution: { overlayCount: 100, operation },
    };
}

async function createLargeDrawFixture() {
    const preset = await createPresetHarness(createAnnotationPreset, {
        transform: { animationDuration: 0 },
        draw: { brush: { interpolationSpacing: 8 } },
    });
    await preset.editor.loadImage(makeImageDataUrl({ width: 240, height: 160 }));
    await preset.draw.enter();
    const pointsPerPayload = 1000;
    return {
        run: async (sampleIndex) => {
            await preset.draw.beginStroke({ x: 10, y: 20 });
            for (let index = 1; index <= pointsPerPayload; index += 1) {
                await preset.draw.appendStroke({
                    x: 10 + ((index + sampleIndex) % 200),
                    y: 20 + ((index * 7 + sampleIndex) % 120),
                });
            }
            const pointCount = preset.draw.getSession().pointCount;
            await preset.draw.cancelStroke();
            return pointCount;
        },
        teardown: async () => {
            await preset.draw.exit();
            await preset.editor.disposeAsync();
            document.body.innerHTML = '';
        },
        attribution: { pointsPerPayload, operation: 'draw-preview-and-cancel' },
    };
}

async function createTransformFixture() {
    const preset = await createPresetHarness(createMinimalPreset, {
        transform: { animationDuration: 0 },
        history: { maxSize: 256 },
    });
    await preset.editor.loadImage(makeImageDataUrl({ width: 200, height: 120 }));
    const transactionsPerSample = 20;
    return {
        run: async () => {
            for (let index = 0; index < transactionsPerSample / 2; index += 1) {
                await preset.transform.rotate(1);
                await preset.transform.rotate(-1);
            }
            return preset.transform.getState();
        },
        teardown: async () => {
            await preset.editor.disposeAsync();
            document.body.innerHTML = '';
        },
        attribution: { transactionsPerSample, operation: 'rotate-pair' },
    };
}

function createFullPresetFixture() {
    return {
        async run() {
            const ids = resetEditorDom({ containerWidth: 360, containerHeight: 260 });
            const preset = createFullPreset(fabric, { transform: { animationDuration: 0 } });
            await preset.editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
            assertCondition(
                preset.editor.getLifecycleState() === 'initialized',
                'Full Preset fixture did not initialize.',
            );
            await preset.editor.disposeAsync();
            document.body.innerHTML = '';
            return preset.editor.getLifecycleState();
        },
        attribution: { operation: 'construct-init-dispose' },
    };
}

await measure('core-memento', () => createMementoFixture(0, 'no-change'));
await measure('state-slices-10-no-change', () => createMementoFixture(10, 'no-change'));
await measure('state-slices-50-dirty', () => createMementoFixture(50, 'dirty'));
await measure('history-100-records', createHistoryFixture);
await measure('overlays-100', () => createOverlayQueryFixture(100));
await measure('overlays-500', () => createOverlayQueryFixture(500));
await measure('overlay-state-export', () => createOverlayStateFixture('export'));
await measure('overlay-state-import', () => createOverlayStateFixture('import'));
await measure('large-draw-payload', createLargeDrawFixture);
await measure('repeated-transform-transactions', createTransformFixture);
await measure('full-preset-init-dispose', createFullPresetFixture);

for (const result of results) {
    if (result.sliceCount > 0) {
        result.perSliceP50Ms = round(result.p50Ms / result.sliceCount, 6);
        result.perSliceP95Ms = round(result.p95Ms / result.sliceCount, 6);
    }
}

console.log(
    JSON.stringify(
        {
            schemaVersion: thresholds.schemaVersion,
            result: failures.length === 0 ? 'PASS' : 'FAIL',
            runtime: { node: process.version, platform: process.platform, arch: process.arch },
            fixtures: results,
            failures,
        },
        null,
        2,
    ),
);

if (failures.length > 0) process.exit(1);
