/**
 * Benchmarks the conditional performance candidates recorded by AUD-011.
 *
 * This script is diagnostic-only and is intentionally excluded from CI gates.
 *
 * @module
 */

import { performance } from 'node:perf_hooks';

import { IDENTITY_AFFINE_MATRIX } from '../src/core-runtime/geometry/affine-matrix.js';
import { GeometryMutationCoordinator } from '../src/core-runtime/geometry/geometry-mutation-coordinator.js';
import { cloneStateValue } from '../src/core-runtime/state/clone-state-value.js';
import { MementoService } from '../src/core-runtime/state/memento-service.js';
import {
    DEFAULT_SNAPSHOT_LIMITS,
    SnapshotService,
} from '../src/core-runtime/state/snapshot-service.js';
import { StateSliceRegistry } from '../src/core-runtime/state/state-slice-registry.js';
import { ImageEditorCore } from '../src/core/index.js';
import { overlayFoundationPlugin } from '../src/foundations/overlay/index.js';
import { estimateRetainedBytes } from '../src/plugins/history/retained-size-estimator.js';
import { maskPlugin } from '../src/plugins/mask/index.js';
import { createDocumentMutationEnvironment } from '../tests/helpers/document-mutation-environment.mjs';
import { fabric, resetEditorDom } from '../tests/helpers/fabric-environment.mjs';

const KiB = 1024;
const MiB = 1024 * KiB;
const MASK_SIZES = [10, 100, 1_000, 5_000];
const SNAPSHOT_SLICE_COUNTS = [1, 10, 50];
const SNAPSHOT_PAYLOAD_BYTES = [1 * KiB, 256 * KiB, 1 * MiB];
const GEOMETRY_PARTICIPANT_COUNTS = [1, 10, 50, 250];
const REGISTRATION_COUNTS = [10, 100, 1_000, 5_000];

function forceGc() {
    globalThis.gc?.();
}

function percentile(values, fraction) {
    const ordered = [...values].sort((left, right) => left - right);
    const index = Math.max(0, Math.ceil(ordered.length * fraction) - 1);
    return ordered[index] ?? 0;
}

function round(value) {
    return Number(value.toFixed(3));
}

async function measure({ iterations, run, beforeEach, afterEach, warmup = 1 }) {
    for (let index = 0; index < warmup; index += 1) {
        await beforeEach?.(index);
        const result = await run(index);
        await afterEach?.(result, index);
    }

    const durations = [];
    const heapDeltas = [];
    for (let index = 0; index < iterations; index += 1) {
        await beforeEach?.(index);
        forceGc();
        const heapBefore = process.memoryUsage().heapUsed;
        const startedAt = performance.now();
        const result = await run(index);
        durations.push(performance.now() - startedAt);
        heapDeltas.push(process.memoryUsage().heapUsed - heapBefore);
        await afterEach?.(result, index);
    }
    return {
        iterations,
        medianMs: round(percentile(durations, 0.5)),
        p95Ms: round(percentile(durations, 0.95)),
        medianHeapDeltaBytes: Math.round(percentile(heapDeltas, 0.5)),
        p95HeapDeltaBytes: Math.round(percentile(heapDeltas, 0.95)),
    };
}

function makeAsciiPayload(byteLength) {
    return Buffer.alloc(byteLength, 0x78).toString('utf8');
}

function readInternalMethod(target, methodName) {
    const method = Reflect.get(target, methodName);
    if (typeof method !== 'function') {
        throw new Error(`Expected internal method "${methodName}" for the audit benchmark.`);
    }
    return method.bind(target);
}

function createSyntheticMask(id) {
    const mask = new fabric.Rect({
        left: id % 100,
        top: Math.floor(id / 100) % 100,
        width: 10,
        height: 10,
        fill: '#000000',
        opacity: 0.5,
        stroke: null,
        strokeWidth: 0,
        selectable: true,
        evented: true,
    });
    mask.editorObjectKind = 'mask';
    mask.maskId = id;
    mask.maskUid = `bench-mask-${id}`;
    mask.maskName = `mask ${id}`;
    mask.originalAlpha = 0.5;
    mask.originalStroke = null;
    mask.originalStrokeWidth = 0;
    return mask;
}

function populateMasks(canvas, size) {
    const masks = Array.from({ length: size }, (_, index) => createSyntheticMask(index + 1));
    for (let offset = 0; offset < masks.length; offset += 250) {
        canvas.add(...masks.slice(offset, offset + 250));
    }
    return masks;
}

async function benchmarkMasks() {
    const results = [];
    for (const size of MASK_SIZES) {
        process.stderr.write(`AUD-011 Mask traversal: ${size} masks\n`);
        const ids = resetEditorDom({ containerWidth: 320, containerHeight: 240 });
        let callbackCount = 0;
        const editor = new ImageEditorCore(fabric, {
            canvasWidth: 320,
            canvasHeight: 240,
        });
        const overlay = editor.use(overlayFoundationPlugin());
        const masksApi = editor.use(
            maskPlugin({
                label: false,
                onChange: () => {
                    callbackCount += 1;
                },
            }),
        );
        await editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
        const canvas = Reflect.get(editor, 'canvas');
        if (!canvas) throw new Error('Mask benchmark could not access the initialized Canvas.');

        forceGc();
        const fixtureHeapBefore = process.memoryUsage().heapUsed;
        let fixtureMasks = populateMasks(canvas, size);
        forceGc();
        const fixtureRetainedHeapBytes = process.memoryUsage().heapUsed - fixtureHeapBefore;
        const targetId = fixtureMasks[Math.floor(fixtureMasks.length / 2)]?.maskUid;
        if (!targetId || masksApi.getAll().length !== size) {
            throw new Error(`Mask fixture indexing failed for ${size} masks.`);
        }

        const traversalIterations = size <= 100 ? 40 : size <= 1_000 ? 20 : 8;
        results.push({
            candidate: 'mask-traversal',
            scenario: 'getAll',
            inputSize: { masks: size },
            fixtureRetainedHeapBytes,
            before: await measure({
                iterations: traversalIterations,
                run: () => masksApi.getAll(),
            }),
            after: null,
        });

        let selected = false;
        results.push({
            candidate: 'mask-traversal',
            scenario: 'selection-change',
            inputSize: { masks: size },
            fixtureRetainedHeapBytes,
            before: await measure({
                iterations: size <= 100 ? 20 : size <= 1_000 ? 10 : 5,
                run: () => {
                    selected = !selected;
                    if (selected) overlay.select([targetId]);
                    else overlay.discardSelection();
                },
            }),
            after: null,
        });

        const notifyChange = readInternalMethod(masksApi, 'notifyChange');
        results.push({
            candidate: 'mask-traversal',
            scenario: 'callback-dispatch',
            inputSize: { masks: size },
            fixtureRetainedHeapBytes,
            before: await measure({
                iterations: traversalIterations,
                run: notifyChange,
            }),
            after: null,
        });

        const createIterations = size <= 100 ? 5 : size <= 1_000 ? 3 : 2;
        results.push({
            candidate: 'mask-traversal',
            scenario: 'create-transaction',
            inputSize: { existingMasks: size },
            fixtureRetainedHeapBytes,
            before: await measure({
                iterations: createIterations,
                run: (index) =>
                    masksApi.create({
                        left: index % 10,
                        top: index % 10,
                        width: 10,
                        height: 10,
                    }),
                afterEach: (mask) => canvas.remove(mask),
                warmup: 0,
            }),
            after: null,
        });

        const removeIterations = size <= 100 ? 5 : 3;
        results.push({
            candidate: 'mask-traversal',
            scenario: 'removeAll-transaction',
            inputSize: { masks: size },
            fixtureRetainedHeapBytes,
            before: await measure({
                iterations: removeIterations,
                beforeEach: () => {
                    if (masksApi.getAll().length === 0) {
                        fixtureMasks = populateMasks(canvas, size);
                    }
                },
                run: () => masksApi.removeAll(),
                warmup: 0,
            }),
            after: null,
        });

        if (masksApi.getAll().length > 0) await masksApi.removeAll();
        await editor.disposeAsync();
        document.body.innerHTML = '';
        results.push({
            candidate: 'mask-traversal',
            scenario: 'callback-count-control',
            inputSize: { masks: size },
            callbackCount,
            before: null,
            after: null,
        });
    }
    return results;
}

function createSnapshotFixture(sliceCount, totalPayloadBytes) {
    let coreState = Object.freeze({ revision: 1 });
    const slices = new StateSliceRegistry();
    const sliceState = new Map();
    let remaining = totalPayloadBytes;
    for (let index = 0; index < sliceCount; index += 1) {
        const remainingSlices = sliceCount - index;
        const payloadBytes = Math.floor(remaining / remainingSlices);
        remaining -= payloadBytes;
        const id = `bench:slice-${String(index).padStart(3, '0')}`;
        const value = Object.freeze({ payload: makeAsciiPayload(payloadBytes) });
        sliceState.set(id, value);
        slices.register({
            id,
            version: 1,
            capturePolicy: 'always',
            capture: () => sliceState.get(id),
            validate: (candidate) => ({ valid: true, value: candidate }),
            restore: (candidate) => {
                sliceState.set(id, candidate);
            },
        });
    }
    const adapter = {
        capture: () => coreState,
        restore: (next) => {
            coreState = next;
        },
        validateSnapshot: (value) => ({ valid: true, value }),
    };
    const mementos = new MementoService(adapter, slices);
    const snapshots = new SnapshotService(
        adapter,
        slices,
        mementos,
        undefined,
        Object.freeze({
            ...DEFAULT_SNAPSHOT_LIMITS,
            maxInputBytes: 64 * MiB,
            maxPluginPayloadBytes: 2 * MiB,
        }),
    );
    const captured = snapshots.capture();
    const prepared = snapshots.prepare(captured);
    return { captured, prepared, snapshots };
}

async function benchmarkSnapshotState() {
    const results = [];
    for (const sliceCount of SNAPSHOT_SLICE_COUNTS) {
        for (const totalPayloadBytes of SNAPSHOT_PAYLOAD_BYTES) {
            process.stderr.write(
                `AUD-011 Snapshot state: ${sliceCount} slices, ${totalPayloadBytes} bytes\n`,
            );
            const fixture = createSnapshotFixture(sliceCount, totalPayloadBytes);
            const iterations = totalPayloadBytes >= MiB ? 8 : 12;
            const inputSize = { slices: sliceCount, totalPayloadBytes };
            results.push({
                candidate: 'snapshot-state-clone',
                scenario: 'capture',
                inputSize,
                before: await measure({
                    iterations,
                    run: () => fixture.snapshots.capture(),
                }),
                after: null,
            });
            results.push({
                candidate: 'snapshot-state-clone',
                scenario: 'prepare',
                inputSize,
                before: await measure({
                    iterations,
                    run: () => fixture.snapshots.prepare(fixture.captured),
                }),
                after: null,
            });
            results.push({
                candidate: 'snapshot-state-clone',
                scenario: 'load-prepared',
                inputSize,
                before: await measure({
                    iterations,
                    run: () =>
                        fixture.snapshots.loadPrepared(fixture.prepared, {
                            rollbackOnFailure: false,
                        }),
                }),
                after: null,
            });
            fixture.snapshots.dispose();
        }
    }

    const clonePayload = Object.freeze({
        payload: makeAsciiPayload(1 * MiB),
        metadata: Object.freeze({ owner: 'benchmark', revision: 1 }),
    });
    results.push({
        candidate: 'snapshot-state-clone',
        scenario: 'cloneStateValue-1MiB-control',
        inputSize: { totalPayloadBytes: 1 * MiB },
        before: await measure({
            iterations: 8,
            run: () => cloneStateValue(clonePayload),
        }),
        after: null,
    });
    return results;
}

function createSharedCyclicGraph(size) {
    const root = { entries: [] };
    const shared = { label: 'shared', metadata: { valid: true } };
    for (let index = 0; index < size; index += 1) {
        root.entries.push({ index, shared });
    }
    root.self = root;
    return root;
}

async function benchmarkHistoryEstimator() {
    const scenarios = [
        {
            name: 'ascii-data-url-1MiB',
            input: `data:image/png;base64,${makeAsciiPayload(1 * MiB)}`,
            inputSize: { payloadBytes: 1 * MiB },
            iterations: 12,
        },
        {
            name: 'ascii-data-url-4MiB',
            input: `data:image/png;base64,${makeAsciiPayload(4 * MiB)}`,
            inputSize: { payloadBytes: 4 * MiB },
            iterations: 8,
        },
        {
            name: 'ascii-data-url-16MiB',
            input: `data:image/png;base64,${makeAsciiPayload(16 * MiB)}`,
            inputSize: { payloadBytes: 16 * MiB },
            iterations: 5,
        },
        {
            name: 'unicode-metadata',
            input: {
                metadata: Buffer.alloc(256 * KiB, 0x61)
                    .toString('utf8')
                    .replaceAll('aa', '界😀'),
            },
            inputSize: { sourceBytes: 256 * KiB },
            iterations: 12,
        },
        {
            name: 'shared-cyclic-graph',
            input: createSharedCyclicGraph(5_000),
            inputSize: { entries: 5_000 },
            iterations: 12,
        },
    ];
    const results = [];
    for (const scenario of scenarios) {
        process.stderr.write(`AUD-011 History estimator: ${scenario.name}\n`);
        const estimatedBytes = estimateRetainedBytes(scenario.input);
        results.push({
            candidate: 'history-retained-byte-estimation',
            scenario: scenario.name,
            inputSize: scenario.inputSize,
            estimatedBytes,
            before: await measure({
                iterations: scenario.iterations,
                run: () => estimateRetainedBytes(scenario.input),
            }),
            after: null,
        });
    }
    return results;
}

function geometrySnapshot(revision) {
    return Object.freeze({
        matrix: IDENTITY_AFFINE_MATRIX,
        boundingBox: Object.freeze({ left: 0, top: 0, width: 100, height: 80 }),
        canvasWidth: 100,
        canvasHeight: 80,
        revision,
    });
}

function createGeometryFixture(participantCount) {
    let revision = 0;
    let sequence = 0;
    const state = {
        captureGeometry: () => geometrySnapshot(revision),
        finalizeGeometry: () => undefined,
        requestRender: () => undefined,
        isDisposed: () => false,
    };
    const mementos = {
        capture: () => Object.freeze({ revision }),
        restore: (memento) => {
            revision = memento.revision;
        },
        matches: (memento) => memento.revision === revision,
    };
    const { mutations } = createDocumentMutationEnvironment({
        operationIds: ['bench:geometry'],
        mementos,
        state,
        history: {
            isAvailable: () => false,
            commit: () => undefined,
        },
        events: {
            emitCommitted: () => undefined,
        },
    });
    const coordinator = new GeometryMutationCoordinator({ mutations, state });
    for (let index = 0; index < participantCount; index += 1) {
        coordinator.registerParticipant({
            id: `bench-participant-${index}`,
            order: participantCount - index,
            supports: () => true,
            apply: () => undefined,
        });
    }
    return {
        coordinator,
        run: () =>
            coordinator.run({
                id: `bench-geometry-${participantCount}-${++sequence}`,
                kind: 'transform',
                operationId: 'bench:geometry',
                mutateBase: () => {
                    revision += 1;
                },
            }),
    };
}

async function benchmarkGeometrySorting() {
    const results = [];
    for (const participantCount of GEOMETRY_PARTICIPANT_COUNTS) {
        process.stderr.write(`AUD-011 Geometry sorting: ${participantCount} participants\n`);
        const fixture = createGeometryFixture(participantCount);
        results.push({
            candidate: 'geometry-participant-sorting',
            scenario: 'mutation',
            inputSize: { participants: participantCount },
            before: await measure({
                iterations: 40,
                run: fixture.run,
            }),
            after: null,
        });
        fixture.coordinator.disposeSync();
    }

    for (const registrationCount of REGISTRATION_COUNTS) {
        process.stderr.write(
            `AUD-011 Geometry registration invalidation: ${registrationCount} registrations\n`,
        );
        const fixture = createGeometryFixture(0);
        let sequence = 0;
        results.push({
            candidate: 'geometry-participant-sorting',
            scenario: 'register-and-invalidate',
            inputSize: { registrations: registrationCount },
            before: await measure({
                iterations: registrationCount >= 1_000 ? 5 : 10,
                run: () => {
                    for (let index = 0; index < registrationCount; index += 1) {
                        const registration = fixture.coordinator.registerParticipant({
                            id: `bench-invalidated-${++sequence}`,
                            order: index,
                            supports: () => true,
                            apply: () => undefined,
                        });
                        registration.dispose();
                    }
                },
            }),
            after: null,
        });
        fixture.coordinator.disposeSync();
    }
    return results;
}

const startedAt = new Date().toISOString();
const result = {
    schemaVersion: 1,
    auditFinding: 'AUD-011',
    environment: {
        startedAt,
        platform: process.platform,
        architecture: process.arch,
        node: process.version,
        v8: process.versions.v8,
        cpuCount:
            typeof navigator === 'object' && typeof navigator.hardwareConcurrency === 'number'
                ? navigator.hardwareConcurrency
                : null,
        gcExposed: typeof globalThis.gc === 'function',
    },
    methodology: {
        clock: 'performance.now',
        percentiles: 'nearest-rank',
        memory: 'heapUsed delta measured around each timed operation after a forced pre-run GC',
        payloadSemantics: 'Snapshot payload bytes are total bytes distributed across slices',
        comparison:
            'Baseline only. after is null because no production optimization was implemented.',
    },
    results: [
        ...(await benchmarkMasks()),
        ...(await benchmarkSnapshotState()),
        ...(await benchmarkHistoryEstimator()),
        ...(await benchmarkGeometrySorting()),
    ],
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
