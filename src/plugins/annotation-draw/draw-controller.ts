/**
 * Implements draw and erase sessions, codecs, previews, and Annotation Foundation integration.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import { isSafeSerializedFabricObject } from '../../fabric/safe-fabric-serialization.js';
import type {
    AnnotationAuthoringPort,
    AnnotationFeatureDefinition,
    AnnotationId,
} from '../../foundations/annotation/index.js';
import { AnnotationValidationError } from '../../foundations/annotation/index.js';
import { objectPointToCanvas, type OverlayStatePoint } from '../../foundations/overlay/index.js';
import type { BaseImageInfoPort, CoreDiagnosticsPort, FabricRuntimePort } from '../../sdk/index.js';
import type {
    AnnotationPoint,
    DrawAnnotationPluginOptions,
    DrawBrushConfiguration,
    DrawConfiguration,
    DrawEnterOptions,
    DrawSessionState,
    DrawSubMode,
    EraserConfiguration,
} from './draw-annotation.js';
import {
    appendInterpolatedPoints,
    buildCurvedDrawPath,
    drawPathIntersects,
    normalizeDrawPoint,
} from './draw-path.js';

export const DRAW_ANNOTATION_KIND = 'annotation:draw' as const;
const DRAW_PLUGIN_ID = 'annotation:draw';
const MAX_DRAW_OBJECT_BYTES = 512 * 1024;

type DrawHost = CoreDiagnosticsPort & FabricRuntimePort & BaseImageInfoPort;
type DrawObject = FabricNS.Path & {
    editorDrawPoints?: readonly AnnotationPoint[];
    editorOverlayHidden?: boolean;
    editorOverlayLocked?: boolean;
};

interface SerializedDraw {
    readonly version: 1;
    readonly points: readonly AnnotationPoint[];
    readonly object: Readonly<Record<string, unknown>>;
}

interface DrawRuntimeSession {
    subMode: DrawSubMode;
    points: AnnotationPoint[];
    previewId: string | null;
}

interface DrawStateGeometry {
    readonly type: 'path';
    readonly points: readonly OverlayStatePoint[];
}

interface DrawStateData {
    readonly version: 1;
    readonly color: string;
    readonly width: number;
    readonly opacity: number;
    readonly lineCap: CanvasLineCap;
    readonly lineJoin: CanvasLineJoin;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function finiteRange(value: unknown, label: string, minimum: number, maximum: number): number {
    if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < minimum ||
        value > maximum
    ) {
        throw new AnnotationValidationError(`${label} must be from ${minimum} to ${maximum}.`);
    }
    return value;
}

function integerRange(value: unknown, label: string, minimum: number, maximum: number): number {
    if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
        throw new AnnotationValidationError(
            `${label} must be an integer from ${minimum} to ${maximum}.`,
        );
    }
    return Number(value);
}

function booleanValue(value: unknown, label: string): boolean {
    if (typeof value !== 'boolean')
        throw new AnnotationValidationError(`${label} must be boolean.`);
    return value;
}

function styleString(value: unknown, label: string, allowEmpty = false): string {
    if (
        typeof value !== 'string' ||
        (!allowEmpty && value.length === 0) ||
        value.length > 128 ||
        [...value].some((character) => character.charCodeAt(0) < 32)
    ) {
        throw new AnnotationValidationError(`${label} is invalid.`);
    }
    return value;
}

function lineCap(value: unknown): CanvasLineCap {
    if (value === 'butt' || value === 'round' || value === 'square') return value;
    throw new AnnotationValidationError('Draw line cap is invalid.');
}

function lineJoin(value: unknown): CanvasLineJoin {
    if (value === 'bevel' || value === 'round' || value === 'miter') return value;
    throw new AnnotationValidationError('Draw line join is invalid.');
}

function subMode(value: unknown): DrawSubMode {
    if (value === 'brush' || value === 'erase') return value;
    throw new AnnotationValidationError('Draw sub-mode is invalid.');
}

const defaultBrush: DrawBrushConfiguration = Object.freeze({
    color: '#111111',
    width: 8,
    opacity: 1,
    lineCap: 'round',
    lineJoin: 'round',
    selectable: true,
    evented: true,
    bindToImageTransform: false,
    interpolationSpacing: 2,
    maxPointCount: 8_192,
    namePrefix: 'Draw',
});

const defaultEraser: EraserConfiguration = Object.freeze({
    radius: 12,
    previewStroke: '#ffffff',
    previewStrokeWidth: 1,
    previewFill: 'rgba(0,0,0,0.15)',
    interpolationSpacing: 4,
    maxPointCount: 8_192,
});

export function resolveBrushConfiguration(
    value: Partial<DrawBrushConfiguration> = {},
    base: DrawBrushConfiguration = defaultBrush,
): DrawBrushConfiguration {
    if (!isPlainRecord(value as unknown)) {
        throw new AnnotationValidationError('Draw brush configuration must be a plain object.');
    }
    const allowed = new Set(Object.keys(defaultBrush));
    if (Object.keys(value).some((key) => !allowed.has(key))) {
        throw new AnnotationValidationError('Draw brush configuration contains unknown keys.');
    }
    const merged = { ...base, ...value };
    return Object.freeze({
        color: styleString(merged.color, 'Draw color'),
        width: finiteRange(merged.width, 'Draw width', 0.1, 1_000),
        opacity: finiteRange(merged.opacity, 'Draw opacity', 0, 1),
        lineCap: lineCap(merged.lineCap),
        lineJoin: lineJoin(merged.lineJoin),
        selectable: booleanValue(merged.selectable, 'Draw selectable'),
        evented: booleanValue(merged.evented, 'Draw evented'),
        bindToImageTransform: booleanValue(merged.bindToImageTransform, 'Draw transform binding'),
        interpolationSpacing: finiteRange(
            merged.interpolationSpacing,
            'Draw interpolation spacing',
            0.25,
            1_000,
        ),
        maxPointCount: integerRange(merged.maxPointCount, 'Draw point count limit', 2, 65_536),
        namePrefix: styleString(merged.namePrefix, 'Draw name prefix'),
    });
}

export function resolveEraserConfiguration(
    value: Partial<EraserConfiguration> = {},
    base: EraserConfiguration = defaultEraser,
): EraserConfiguration {
    if (!isPlainRecord(value as unknown)) {
        throw new AnnotationValidationError('Eraser configuration must be a plain object.');
    }
    const allowed = new Set(Object.keys(defaultEraser));
    if (Object.keys(value).some((key) => !allowed.has(key))) {
        throw new AnnotationValidationError('Eraser configuration contains unknown keys.');
    }
    const merged = { ...base, ...value };
    return Object.freeze({
        radius: finiteRange(merged.radius, 'Eraser radius', 0.5, 2_000),
        previewStroke: styleString(merged.previewStroke, 'Eraser preview stroke'),
        previewStrokeWidth: finiteRange(
            merged.previewStrokeWidth,
            'Eraser preview stroke width',
            0,
            100,
        ),
        previewFill: styleString(merged.previewFill, 'Eraser preview fill', true),
        interpolationSpacing: finiteRange(
            merged.interpolationSpacing,
            'Eraser interpolation spacing',
            0.25,
            2_000,
        ),
        maxPointCount: integerRange(merged.maxPointCount, 'Eraser point count limit', 2, 65_536),
    });
}

function normalizePoints(value: unknown, maximumCount: number): readonly AnnotationPoint[] {
    if (!Array.isArray(value) || value.length < 2 || value.length > maximumCount) {
        throw new AnnotationValidationError('Draw path point data is invalid.');
    }
    try {
        return Object.freeze(value.map(normalizeDrawPoint));
    } catch {
        throw new AnnotationValidationError('Draw path contains an invalid point.');
    }
}

function isSerializedDraw(value: unknown): value is SerializedDraw {
    if (!isPlainRecord(value)) return false;
    try {
        const objectDescriptor = Object.getOwnPropertyDescriptor(value, 'object');
        if (!objectDescriptor || !('value' in objectDescriptor)) return false;
        const serializedObject = objectDescriptor.value;
        if (
            value.version !== 1 ||
            !isPlainRecord(serializedObject) ||
            !isSafeSerializedFabricObject(serializedObject, { rootTypes: ['path'] })
        ) {
            return false;
        }
        const points = normalizePoints(value.points, 65_536);
        const bytes = new TextEncoder().encode(JSON.stringify(serializedObject)).byteLength;
        return (
            points.length >= 2 &&
            bytes <= MAX_DRAW_OBJECT_BYTES &&
            typeof serializedObject.type === 'string' &&
            serializedObject.type.toLowerCase() === 'path'
        );
    } catch {
        return false;
    }
}

function isStatePoint(value: unknown): value is OverlayStatePoint {
    return (
        isPlainRecord(value) &&
        typeof value.x === 'number' &&
        Number.isFinite(value.x) &&
        typeof value.y === 'number' &&
        Number.isFinite(value.y)
    );
}

function isDrawStateGeometry(value: unknown): value is DrawStateGeometry {
    return (
        isPlainRecord(value) &&
        value.type === 'path' &&
        Array.isArray(value.points) &&
        value.points.length >= 2 &&
        value.points.length <= 65_536 &&
        value.points.every(isStatePoint)
    );
}

function isDrawStateData(value: unknown): value is DrawStateData {
    if (!isPlainRecord(value) || value.version !== 1) return false;
    try {
        styleString(value.color, 'Draw color');
        finiteRange(value.width, 'Draw width ratio', 0.000_000_1, 100);
        finiteRange(value.opacity, 'Draw opacity', 0, 1);
        lineCap(value.lineCap);
        lineJoin(value.lineJoin);
        return Object.keys(value).every((key) =>
            ['version', 'color', 'width', 'opacity', 'lineCap', 'lineJoin'].includes(key),
        );
    } catch {
        return false;
    }
}

export class DrawAnnotationController {
    private brush: DrawBrushConfiguration;
    private eraser: EraserConfiguration;
    private session: DrawRuntimeSession | null = null;
    private previewSequence = 0;
    private nameSequence = 0;
    private disposed = false;

    constructor(
        private readonly host: DrawHost,
        private readonly authoring: AnnotationAuthoringPort,
        options: DrawAnnotationPluginOptions,
    ) {
        if (!isPlainRecord(options as unknown)) {
            throw new AnnotationValidationError('Draw options must be a plain object.');
        }
        if (Object.keys(options).some((key) => key !== 'brush' && key !== 'eraser')) {
            throw new AnnotationValidationError('Draw options contain unknown keys.');
        }
        this.brush = resolveBrushConfiguration(options.brush);
        this.eraser = resolveEraserConfiguration(options.eraser);
    }

    featureDefinition(): AnnotationFeatureDefinition<never> {
        const definition: AnnotationFeatureDefinition<never> = {
            kind: DRAW_ANNOTATION_KIND,
            ownerPluginId: DRAW_PLUGIN_ID,
            classify: (object) =>
                object instanceof this.host.fabric.Path &&
                Array.isArray((object as DrawObject).editorDrawPoints),
            codec: {
                type: 'annotation:draw-path',
                version: '1.0.0',
                serialize: (object) => {
                    const draw = object as DrawObject;
                    return Object.freeze({
                        version: 1,
                        points: draw.editorDrawPoints,
                        object: object.toObject(),
                    });
                },
                validate: isSerializedDraw,
                deserialize: async (value, context) => {
                    if (!isSerializedDraw(value)) {
                        throw new AnnotationValidationError('Serialized Draw data is malformed.');
                    }
                    const objects = await context.fabric.util.enlivenObjects<FabricNS.FabricObject>(
                        [value.object],
                    );
                    const object = objects[0];
                    if (!(object instanceof context.fabric.Path)) {
                        throw new AnnotationValidationError('Fabric did not restore a Draw path.');
                    }
                    (object as DrawObject).editorDrawPoints = normalizePoints(
                        value.points,
                        this.brush.maxPointCount,
                    );
                    return object;
                },
            },
            stateCodec: {
                type: 'annotation:draw',
                version: '1.0.0',
                serialize: (object, context) => {
                    const draw = object as DrawObject;
                    const points = normalizePoints(draw.editorDrawPoints, 65_536).map((point) =>
                        Object.freeze(
                            context.toImageNormalized(objectPointToCanvas(object, point)),
                        ),
                    );
                    return Object.freeze({
                        geometry: Object.freeze({
                            type: 'path',
                            points: Object.freeze(points),
                        } satisfies DrawStateGeometry),
                        data: Object.freeze({
                            version: 1,
                            color: typeof object.stroke === 'string' ? object.stroke : '#111111',
                            width: context.toImageNormalizedScalar(
                                Number(object.strokeWidth) || 0.1,
                            ),
                            opacity: Number.isFinite(object.opacity) ? object.opacity : 1,
                            lineCap: object.strokeLineCap ?? 'round',
                            lineJoin: object.strokeLineJoin ?? 'round',
                        } satisfies DrawStateData),
                    });
                },
                validate: (value) =>
                    isDrawStateGeometry(value.geometry) && isDrawStateData(value.data),
                deserialize: (value, context) => {
                    if (!isDrawStateGeometry(value.geometry) || !isDrawStateData(value.data)) {
                        throw new AnnotationValidationError(
                            'Serialized Draw Annotation State data is malformed.',
                        );
                    }
                    const points = Object.freeze(
                        value.geometry.points.map((point) =>
                            Object.freeze(context.toCanvasPoint(point)),
                        ),
                    );
                    const object = new this.host.fabric.Path(buildCurvedDrawPath(points), {
                        fill: '',
                        stroke: value.data.color,
                        strokeWidth: context.toCanvasScalar(value.data.width),
                        opacity: value.data.opacity,
                        strokeLineCap: value.data.lineCap,
                        strokeLineJoin: value.data.lineJoin,
                        objectCaching: false,
                    }) as DrawObject;
                    object.editorDrawPoints = points;
                    return object;
                },
            },
            bindToImageTransform: () => this.brush.bindToImageTransform,
        };
        return Object.freeze(definition);
    }

    enter(options: DrawEnterOptions = {}): void {
        this.assertActive('enter Draw');
        this.assertImageLoaded();
        if (this.session) throw new AnnotationValidationError('A Draw session is already active.');
        if (!isPlainRecord(options as unknown)) {
            throw new AnnotationValidationError('Draw enter options must be a plain object.');
        }
        if (Object.keys(options).some((key) => key !== 'subMode')) {
            throw new AnnotationValidationError('Draw enter options contain unknown keys.');
        }
        this.session = {
            subMode: subMode(options.subMode ?? 'brush'),
            points: [],
            previewId: null,
        };
    }

    setSubMode(mode: DrawSubMode): void {
        const session = this.requireSession('set Draw sub-mode');
        const normalized = subMode(mode);
        if (session.subMode === normalized) return;
        this.clearStroke(session);
        session.subMode = normalized;
    }

    beginStroke(value: AnnotationPoint): void {
        const session = this.requireSession('begin Draw stroke');
        if (session.points.length > 0) {
            throw new AnnotationValidationError('A Draw stroke is already active.');
        }
        let point: AnnotationPoint;
        try {
            point = normalizeDrawPoint(value);
        } catch {
            throw new AnnotationValidationError(
                'Draw point coordinates must be finite and bounded.',
            );
        }
        session.points = [point];
        this.refreshPreview(session);
    }

    appendStroke(value: AnnotationPoint): void {
        const session = this.requireActiveStroke('append Draw stroke');
        let point: AnnotationPoint;
        try {
            point = normalizeDrawPoint(value);
        } catch {
            throw new AnnotationValidationError(
                'Draw point coordinates must be finite and bounded.',
            );
        }
        const configuration = session.subMode === 'brush' ? this.brush : this.eraser;
        try {
            appendInterpolatedPoints(
                session.points,
                point,
                configuration.interpolationSpacing,
                configuration.maxPointCount,
            );
        } catch (error) {
            throw new AnnotationValidationError(
                error instanceof Error ? error.message : 'Draw point limit was exceeded.',
            );
        }
        this.refreshPreview(session);
    }

    async endStroke(): Promise<AnnotationId | null> {
        const session = this.requireActiveStroke('end Draw stroke');
        const points = Object.freeze([...session.points]);
        const mode = session.subMode;
        this.clearStroke(session);
        if (!this.isMeaningfulStroke(points)) return null;
        if (mode === 'erase') {
            const ids = this.intersectedDrawIds(points);
            if (ids.length === 0) return null;
            await this.authoring.removeFeatures({
                ids,
                kind: DRAW_ANNOTATION_KIND,
                operationId: 'annotation-draw:commit-erase',
            });
            return null;
        }
        const object = this.createPath(points);
        return this.authoring.create({
            kind: DRAW_ANNOTATION_KIND,
            object,
            name: `${this.brush.namePrefix} ${++this.nameSequence}`,
            operationId: 'annotation-draw:commit-stroke',
        });
    }

    cancelStroke(): void {
        const session = this.requireSession('cancel Draw stroke');
        this.clearStroke(session);
    }

    exit(): void {
        this.assertActive('exit Draw');
        if (!this.session) return;
        this.clearStroke(this.session);
        this.session = null;
    }

    configureBrush(patch: Partial<DrawBrushConfiguration>): void {
        this.assertActive('configure Draw brush');
        if (this.session?.points.length) {
            throw new AnnotationValidationError(
                'Cancel the active Draw stroke before configuring it.',
            );
        }
        this.brush = resolveBrushConfiguration(patch, this.brush);
    }

    configureEraser(patch: Partial<EraserConfiguration>): void {
        this.assertActive('configure Eraser');
        if (this.session?.points.length) {
            throw new AnnotationValidationError(
                'Cancel the active Eraser stroke before configuring it.',
            );
        }
        this.eraser = resolveEraserConfiguration(patch, this.eraser);
    }

    getConfiguration(): DrawConfiguration {
        this.assertActive('read Draw configuration');
        return Object.freeze({ brush: this.brush, eraser: this.eraser });
    }

    getSession(): DrawSessionState | null {
        this.assertActive('read Draw session');
        return this.session
            ? Object.freeze({
                  subMode: this.session.subMode,
                  isStrokeActive: this.session.points.length > 0,
                  pointCount: this.session.points.length,
              })
            : null;
    }

    closeForImage(): void {
        if (this.session) this.exit();
    }

    dispose(): void {
        if (this.disposed) return;
        if (this.session) this.exit();
        this.disposed = true;
    }

    private createPath(points: readonly AnnotationPoint[]): DrawObject {
        const object = new this.host.fabric.Path(buildCurvedDrawPath(points), {
            fill: '',
            stroke: this.brush.color,
            strokeWidth: this.brush.width,
            opacity: this.brush.opacity,
            strokeLineCap: this.brush.lineCap,
            strokeLineJoin: this.brush.lineJoin,
            selectable: this.brush.selectable,
            evented: this.brush.evented,
            objectCaching: false,
        }) as DrawObject;
        object.editorDrawPoints = Object.freeze([...points]);
        return object;
    }

    private refreshPreview(session: DrawRuntimeSession): void {
        let preview: FabricNS.FabricObject;
        if (session.subMode === 'brush') {
            preview = this.createPath(session.points);
        } else {
            const point = session.points[session.points.length - 1]!;
            preview = new this.host.fabric.Circle({
                left: point.x,
                top: point.y,
                radius: this.eraser.radius,
                originX: 'center',
                originY: 'center',
                fill: this.eraser.previewFill,
                stroke: this.eraser.previewStroke,
                strokeWidth: this.eraser.previewStrokeWidth,
                objectCaching: false,
            });
        }
        const previewId = `annotation-draw:preview:${++this.previewSequence}`;
        this.authoring.replacePreview(session.previewId ? [session.previewId] : [], {
            id: previewId,
            ownerKind: DRAW_ANNOTATION_KIND,
            object: preview,
        });
        session.previewId = previewId;
    }

    private intersectedDrawIds(points: readonly AnnotationPoint[]): readonly AnnotationId[] {
        const ids: AnnotationId[] = [];
        for (const object of this.authoring.listObjects(DRAW_ANNOTATION_KIND)) {
            const draw = object as DrawObject;
            if (draw.editorOverlayHidden || draw.editorOverlayLocked) continue;
            if (drawPathIntersects(draw, points, this.eraser.radius)) {
                const id = Reflect.get(draw, 'editorOverlayId');
                if (typeof id === 'string') ids.push(id);
            }
        }
        return Object.freeze(ids);
    }

    private isMeaningfulStroke(points: readonly AnnotationPoint[]): boolean {
        if (points.length < 2) return false;
        const first = points[0]!;
        return points.some((point) => Math.hypot(point.x - first.x, point.y - first.y) >= 0.5);
    }

    private clearStroke(session: DrawRuntimeSession): void {
        if (session.previewId) this.authoring.removePreview([session.previewId]);
        session.previewId = null;
        session.points = [];
    }

    private requireSession(operation: string): DrawRuntimeSession {
        this.assertActive(operation);
        if (!this.session) {
            throw new AnnotationValidationError(`Cannot ${operation} without a Draw session.`);
        }
        return this.session;
    }

    private requireActiveStroke(operation: string): DrawRuntimeSession {
        const session = this.requireSession(operation);
        if (session.points.length === 0) {
            throw new AnnotationValidationError(`Cannot ${operation} without an active stroke.`);
        }
        return session;
    }

    private assertImageLoaded(): void {
        if (!this.host.isImageLoaded()) {
            throw new AnnotationValidationError('Draw Annotation requires a loaded image.');
        }
    }

    private assertActive(operation: string): void {
        if (this.disposed) {
            throw new AnnotationValidationError(`Cannot ${operation} after disposal.`);
        }
    }
}
