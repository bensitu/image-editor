/**
 * Implements Shape Annotation creation, updates, previews, codecs, and Foundation integration.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import { isSafeSerializedFabricObject } from '../../fabric/safe-fabric-serialization.js';
import type {
    AnnotationAuthoringPort,
    AnnotationFeatureDefinition,
    AnnotationId,
    AnnotationUpdate,
} from '../../foundations/annotation/index.js';
import { AnnotationValidationError } from '../../foundations/annotation/index.js';
import {
    captureOverlayStateBounds,
    isOverlayStateBoundsGeometry,
    objectPointToCanvas,
    restoreOverlayStateBounds,
    type OverlayStateBoundsGeometry,
    type OverlayStatePoint,
} from '../../foundations/overlay/index.js';
import type { BaseImageInfoPort, CoreDiagnosticsPort, FabricRuntimePort } from '../../sdk/index.js';
import type {
    LinearShapeGeometry,
    RectShapeGeometry,
    ShapeAnnotationConfiguration,
    ShapeAnnotationDefinition,
    ShapeAnnotationKind,
    ShapeAnnotationPluginOptions,
    ShapeAnnotationUpdate,
    ShapeGeometryInput,
    ShapeSessionOptions,
    ShapeSessionState,
} from './shape-annotation.js';

export const SHAPE_ANNOTATION_KIND = 'annotation:shape' as const;
const SHAPE_PLUGIN_ID = 'annotation:shape';
const MAX_COORDINATE = 10_000_000;
const MAX_SHAPE_OBJECT_BYTES = 256 * 1024;
const MIN_GEOMETRY_SIZE = 0.5;

type ShapeHost = CoreDiagnosticsPort & FabricRuntimePort & BaseImageInfoPort;
type ShapeObject = FabricNS.FabricObject & {
    editorShapeKind?: ShapeAnnotationKind;
    editorShapeGeometry?: ShapeGeometryInput;
};

interface ShapeFeatureUpdate {
    readonly stroke?: string;
    readonly strokeWidth?: number;
    readonly fill?: string;
    readonly opacity?: number;
    readonly strokeDashArray?: readonly number[] | null;
}

interface SerializedShape {
    readonly version: 1;
    readonly shapeKind: ShapeAnnotationKind;
    readonly geometry: ShapeGeometryInput;
    readonly object: Readonly<Record<string, unknown>>;
}

interface ShapeRuntimeSession {
    readonly options: ShapeSessionOptions;
    geometry: ShapeGeometryInput | null;
    previewId: string | null;
}

type ShapeStateGeometry =
    | Readonly<{
          kind: 'rect';
          bounds: OverlayStateBoundsGeometry;
      }>
    | Readonly<{
          kind: 'line' | 'arrow';
          start: OverlayStatePoint;
          end: OverlayStatePoint;
      }>;

interface ShapeStateData {
    readonly version: 1;
    readonly stroke: string;
    readonly strokeWidth: number;
    readonly fill: string;
    readonly opacity: number;
    readonly strokeDashArray: readonly number[] | null;
    readonly arrowHeadLength: number;
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

function dashArray(value: unknown): readonly number[] | null {
    if (value === null) return null;
    if (
        !Array.isArray(value) ||
        value.length > 16 ||
        value.some(
            (entry) =>
                typeof entry !== 'number' || !Number.isFinite(entry) || entry < 0 || entry > 1_000,
        )
    ) {
        throw new AnnotationValidationError('Shape stroke dash array is invalid.');
    }
    return Object.freeze([...value]);
}

function shapeKind(value: unknown): ShapeAnnotationKind {
    if (value === 'rect' || value === 'line' || value === 'arrow') return value;
    throw new AnnotationValidationError('Shape kind is invalid.');
}

function point(value: unknown, label: string) {
    if (!isPlainRecord(value)) throw new AnnotationValidationError(`${label} is invalid.`);
    return Object.freeze({
        x: finiteRange(value.x, `${label} x`, -MAX_COORDINATE, MAX_COORDINATE),
        y: finiteRange(value.y, `${label} y`, -MAX_COORDINATE, MAX_COORDINATE),
    });
}

export function normalizeShapeGeometry(value: unknown): ShapeGeometryInput {
    if (!isPlainRecord(value)) {
        throw new AnnotationValidationError('Shape geometry must be a plain object.');
    }
    const kind = shapeKind(value.kind);
    if (kind === 'rect') {
        const geometry: RectShapeGeometry = Object.freeze({
            kind,
            left: finiteRange(value.left, 'Shape left', -MAX_COORDINATE, MAX_COORDINATE),
            top: finiteRange(value.top, 'Shape top', -MAX_COORDINATE, MAX_COORDINATE),
            width: finiteRange(value.width, 'Shape width', MIN_GEOMETRY_SIZE, MAX_COORDINATE),
            height: finiteRange(value.height, 'Shape height', MIN_GEOMETRY_SIZE, MAX_COORDINATE),
        });
        return geometry;
    }
    const start = point(value.start, 'Shape start point');
    const end = point(value.end, 'Shape end point');
    if (Math.hypot(end.x - start.x, end.y - start.y) < MIN_GEOMETRY_SIZE) {
        throw new AnnotationValidationError('Shape line and arrow endpoints must be distinct.');
    }
    const geometry: LinearShapeGeometry = Object.freeze({ kind, start, end });
    return geometry;
}

const defaultConfiguration: ShapeAnnotationConfiguration = Object.freeze({
    stroke: '#111111',
    strokeWidth: 3,
    fill: 'rgba(0,0,0,0)',
    opacity: 1,
    strokeDashArray: null,
    arrowHeadLength: 16,
    selectable: true,
    evented: true,
    bindToImageTransform: false,
    namePrefix: 'Shape',
});

export function resolveShapeConfiguration(
    value: ShapeAnnotationPluginOptions | Partial<ShapeAnnotationConfiguration> = {},
    base: ShapeAnnotationConfiguration = defaultConfiguration,
): ShapeAnnotationConfiguration {
    if (!isPlainRecord(value as unknown)) {
        throw new AnnotationValidationError('Shape configuration must be a plain object.');
    }
    const allowed = new Set(Object.keys(defaultConfiguration));
    if (Object.keys(value).some((key) => !allowed.has(key))) {
        throw new AnnotationValidationError('Shape configuration contains unknown keys.');
    }
    const merged = { ...base, ...value };
    return Object.freeze({
        stroke: styleString(merged.stroke, 'Shape stroke'),
        strokeWidth: finiteRange(merged.strokeWidth, 'Shape stroke width', 0.1, 1_000),
        fill: styleString(merged.fill, 'Shape fill', true),
        opacity: finiteRange(merged.opacity, 'Shape opacity', 0, 1),
        strokeDashArray: dashArray(merged.strokeDashArray),
        arrowHeadLength: finiteRange(merged.arrowHeadLength, 'Arrow head length', 1, 1_000),
        selectable: booleanValue(merged.selectable, 'Shape selectable'),
        evented: booleanValue(merged.evented, 'Shape evented'),
        bindToImageTransform: booleanValue(merged.bindToImageTransform, 'Shape transform binding'),
        namePrefix: styleString(merged.namePrefix, 'Shape name prefix'),
    });
}

function normalizeFeatureUpdate(value: unknown): ShapeFeatureUpdate {
    if (!isPlainRecord(value)) {
        throw new AnnotationValidationError('Shape update must be a plain object.');
    }
    const allowed = new Set(['stroke', 'strokeWidth', 'fill', 'opacity', 'strokeDashArray']);
    if (Object.keys(value).some((key) => !allowed.has(key))) {
        throw new AnnotationValidationError('Shape update contains unknown keys.');
    }
    return Object.freeze({
        ...(value.stroke !== undefined
            ? { stroke: styleString(value.stroke, 'Shape stroke') }
            : {}),
        ...(value.strokeWidth !== undefined
            ? {
                  strokeWidth: finiteRange(value.strokeWidth, 'Shape stroke width', 0.1, 1_000),
              }
            : {}),
        ...(value.fill !== undefined ? { fill: styleString(value.fill, 'Shape fill', true) } : {}),
        ...(value.opacity !== undefined
            ? { opacity: finiteRange(value.opacity, 'Shape opacity', 0, 1) }
            : {}),
        ...(value.strokeDashArray !== undefined
            ? { strokeDashArray: dashArray(value.strokeDashArray) }
            : {}),
    });
}

function sharedUpdate(value: ShapeAnnotationUpdate): AnnotationUpdate {
    return Object.freeze({
        ...(value.name !== undefined ? { name: value.name } : {}),
        ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
        ...(value.hidden !== undefined ? { hidden: value.hidden } : {}),
        ...(value.locked !== undefined ? { locked: value.locked } : {}),
    });
}

function buildArrowPath(geometry: LinearShapeGeometry, headLength: number): string {
    const angle = Math.atan2(geometry.end.y - geometry.start.y, geometry.end.x - geometry.start.x);
    const wing = Math.PI / 7;
    const first = {
        x: geometry.end.x - headLength * Math.cos(angle - wing),
        y: geometry.end.y - headLength * Math.sin(angle - wing),
    };
    const second = {
        x: geometry.end.x - headLength * Math.cos(angle + wing),
        y: geometry.end.y - headLength * Math.sin(angle + wing),
    };
    return `M ${geometry.start.x} ${geometry.start.y} L ${geometry.end.x} ${geometry.end.y} M ${geometry.end.x} ${geometry.end.y} L ${first.x} ${first.y} M ${geometry.end.x} ${geometry.end.y} L ${second.x} ${second.y}`;
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

function isShapeStateGeometry(value: unknown): value is ShapeStateGeometry {
    if (!isPlainRecord(value)) return false;
    if (value.kind === 'rect') return isOverlayStateBoundsGeometry(value.bounds);
    return (
        (value.kind === 'line' || value.kind === 'arrow') &&
        isStatePoint(value.start) &&
        isStatePoint(value.end)
    );
}

function isShapeStateData(value: unknown): value is ShapeStateData {
    if (!isPlainRecord(value) || value.version !== 1) return false;
    try {
        styleString(value.stroke, 'Shape stroke');
        finiteRange(value.strokeWidth, 'Shape stroke width ratio', 0.000_000_1, 100);
        styleString(value.fill, 'Shape fill', true);
        finiteRange(value.opacity, 'Shape opacity', 0, 1);
        dashArray(value.strokeDashArray);
        finiteRange(value.arrowHeadLength, 'Arrow head ratio', 0.000_000_1, 100);
        return Object.keys(value).every((key) =>
            [
                'version',
                'stroke',
                'strokeWidth',
                'fill',
                'opacity',
                'strokeDashArray',
                'arrowHeadLength',
            ].includes(key),
        );
    } catch {
        return false;
    }
}

function isSerializedShape(value: unknown): value is SerializedShape {
    if (!isPlainRecord(value)) return false;
    try {
        const objectDescriptor = Object.getOwnPropertyDescriptor(value, 'object');
        if (!objectDescriptor || !('value' in objectDescriptor)) return false;
        const serializedObject = objectDescriptor.value;
        if (
            value.version !== 1 ||
            !isPlainRecord(serializedObject) ||
            !isSafeSerializedFabricObject(serializedObject, {
                rootTypes: ['rect', 'line', 'path'],
            })
        ) {
            return false;
        }
        const geometry = normalizeShapeGeometry(value.geometry);
        const bytes = new TextEncoder().encode(JSON.stringify(serializedObject)).byteLength;
        const type =
            typeof serializedObject.type === 'string' ? serializedObject.type.toLowerCase() : '';
        return (
            bytes <= MAX_SHAPE_OBJECT_BYTES &&
            geometry.kind === value.shapeKind &&
            ((geometry.kind === 'rect' && type === 'rect') ||
                (geometry.kind === 'line' && type === 'line') ||
                (geometry.kind === 'arrow' && type === 'path'))
        );
    } catch {
        return false;
    }
}

export class ShapeAnnotationController {
    private configuration: ShapeAnnotationConfiguration;
    private session: ShapeRuntimeSession | null = null;
    private nameSequence = 0;
    private previewSequence = 0;
    private disposed = false;

    constructor(
        private readonly host: ShapeHost,
        private readonly authoring: AnnotationAuthoringPort,
        options: ShapeAnnotationPluginOptions,
    ) {
        this.configuration = resolveShapeConfiguration(options);
    }

    featureDefinition(): AnnotationFeatureDefinition<ShapeFeatureUpdate> {
        const definition: AnnotationFeatureDefinition<ShapeFeatureUpdate> = {
            kind: SHAPE_ANNOTATION_KIND,
            ownerPluginId: SHAPE_PLUGIN_ID,
            classify: (object) => {
                const shape = object as ShapeObject;
                return (
                    (shape.editorShapeKind === 'rect' && object instanceof this.host.fabric.Rect) ||
                    (shape.editorShapeKind === 'line' && object instanceof this.host.fabric.Line) ||
                    (shape.editorShapeKind === 'arrow' && object instanceof this.host.fabric.Path)
                );
            },
            codec: {
                type: 'annotation:shape-object',
                version: '1.0.0',
                serialize: (object) => {
                    const shape = object as ShapeObject;
                    return Object.freeze({
                        version: 1,
                        shapeKind: shape.editorShapeKind,
                        geometry: shape.editorShapeGeometry,
                        object: object.toObject(),
                    });
                },
                validate: isSerializedShape,
                deserialize: async (value, context) => {
                    if (!isSerializedShape(value)) {
                        throw new AnnotationValidationError('Serialized Shape data is malformed.');
                    }
                    const objects = await context.fabric.util.enlivenObjects<FabricNS.FabricObject>(
                        [value.object],
                    );
                    const object = objects[0] as ShapeObject | undefined;
                    if (!object) {
                        throw new AnnotationValidationError('Fabric did not restore a Shape.');
                    }
                    object.editorShapeKind = value.shapeKind;
                    object.editorShapeGeometry = normalizeShapeGeometry(value.geometry);
                    return object;
                },
            },
            stateCodec: {
                type: 'annotation:shape',
                version: '1.0.0',
                serialize: (object, context) => {
                    const shape = object as ShapeObject;
                    const geometry = normalizeShapeGeometry(shape.editorShapeGeometry);
                    const stateGeometry: ShapeStateGeometry =
                        geometry.kind === 'rect'
                            ? Object.freeze({
                                  kind: 'rect',
                                  bounds: captureOverlayStateBounds(object, context),
                              })
                            : Object.freeze({
                                  kind: geometry.kind,
                                  start: Object.freeze(
                                      context.toImageNormalized(
                                          objectPointToCanvas(object, geometry.start),
                                      ),
                                  ),
                                  end: Object.freeze(
                                      context.toImageNormalized(
                                          objectPointToCanvas(object, geometry.end),
                                      ),
                                  ),
                              });
                    const strokeDashArray = Array.isArray(object.strokeDashArray)
                        ? Object.freeze(
                              object.strokeDashArray.map((entry) =>
                                  context.toImageNormalizedScalar(entry),
                              ),
                          )
                        : null;
                    return Object.freeze({
                        geometry: stateGeometry,
                        data: Object.freeze({
                            version: 1,
                            stroke: typeof object.stroke === 'string' ? object.stroke : '#111111',
                            strokeWidth: context.toImageNormalizedScalar(
                                Number(object.strokeWidth) || 0.1,
                            ),
                            fill: typeof object.fill === 'string' ? object.fill : '',
                            opacity: Number.isFinite(object.opacity) ? object.opacity : 1,
                            strokeDashArray,
                            arrowHeadLength: context.toImageNormalizedScalar(
                                this.configuration.arrowHeadLength,
                            ),
                        } satisfies ShapeStateData),
                    });
                },
                validate: (value) =>
                    isShapeStateGeometry(value.geometry) && isShapeStateData(value.data),
                deserialize: (value, context) => {
                    if (!isShapeStateGeometry(value.geometry) || !isShapeStateData(value.data)) {
                        throw new AnnotationValidationError(
                            'Serialized Shape Annotation State data is malformed.',
                        );
                    }
                    const data = value.data;
                    const common = {
                        stroke: data.stroke,
                        strokeWidth: context.toCanvasScalar(data.strokeWidth),
                        fill: data.fill,
                        opacity: data.opacity,
                        strokeDashArray: data.strokeDashArray
                            ? data.strokeDashArray.map((entry) => context.toCanvasScalar(entry))
                            : null,
                        arrowHeadLength: context.toCanvasScalar(data.arrowHeadLength),
                    };
                    if (value.geometry.kind === 'rect') {
                        const geometry: RectShapeGeometry = {
                            kind: 'rect',
                            left: 0,
                            top: 0,
                            width: 1,
                            height: 1,
                        };
                        const object = this.createObject(geometry, { geometry, ...common });
                        restoreOverlayStateBounds(
                            object,
                            value.geometry.bounds,
                            context,
                            this.host.fabric,
                        );
                        return object;
                    }
                    const geometry: LinearShapeGeometry = {
                        kind: value.geometry.kind,
                        start: context.toCanvasPoint(value.geometry.start),
                        end: context.toCanvasPoint(value.geometry.end),
                    };
                    return this.createObject(geometry, { geometry, ...common });
                },
            },
            normalizeUpdate: normalizeFeatureUpdate,
            hasUpdate: (object, patch) =>
                Object.entries(patch).some(([key, value]) => {
                    const current = Reflect.get(object, key);
                    return Array.isArray(value)
                        ? JSON.stringify(current) !== JSON.stringify(value)
                        : !Object.is(current, value);
                }),
            applyUpdate: (object, patch) => {
                object.set({
                    ...patch,
                    ...(patch.strokeDashArray
                        ? { strokeDashArray: [...patch.strokeDashArray] }
                        : {}),
                });
                object.setCoords();
            },
            bindToImageTransform: () => this.configuration.bindToImageTransform,
        };
        return Object.freeze(definition);
    }

    enter(options: ShapeSessionOptions): void {
        this.assertActive('enter Shape');
        this.assertImageLoaded();
        if (this.session) throw new AnnotationValidationError('A Shape session is already active.');
        if (!isPlainRecord(options as unknown)) {
            throw new AnnotationValidationError('Shape session options must be a plain object.');
        }
        shapeKind(options.kind);
        this.resolveStyle(options);
        this.session = { options: Object.freeze({ ...options }), geometry: null, previewId: null };
    }

    updatePreview(geometryInput: ShapeGeometryInput): void {
        const session = this.requireSession('update Shape preview');
        const geometry = normalizeShapeGeometry(geometryInput);
        if (geometry.kind !== session.options.kind) {
            throw new AnnotationValidationError('Shape preview kind does not match the session.');
        }
        const preview = this.createObject(geometry, session.options);
        const previewId = `annotation-shape:preview:${++this.previewSequence}`;
        this.authoring.replacePreview(session.previewId ? [session.previewId] : [], {
            id: previewId,
            ownerKind: SHAPE_ANNOTATION_KIND,
            object: preview,
        });
        session.geometry = geometry;
        session.previewId = previewId;
    }

    async commit(): Promise<AnnotationId> {
        const session = this.requireSession('commit Shape');
        if (!session.geometry) {
            throw new AnnotationValidationError('Shape commit requires preview geometry.');
        }
        const definition: ShapeAnnotationDefinition = {
            ...session.options,
            geometry: session.geometry,
        };
        this.closeSession();
        return this.createDefinition(definition, 'annotation-shape:commit');
    }

    cancel(): void {
        this.assertActive('cancel Shape');
        if (this.session) this.closeSession();
    }

    create(definition: ShapeAnnotationDefinition): Promise<AnnotationId> {
        return this.createDefinition(definition, 'annotation-shape:create');
    }

    private createDefinition(
        definition: ShapeAnnotationDefinition,
        operationId: 'annotation-shape:create' | 'annotation-shape:commit',
    ): Promise<AnnotationId> {
        this.assertActive('create Shape');
        this.assertImageLoaded();
        if (!isPlainRecord(definition as unknown)) {
            return Promise.reject(
                new AnnotationValidationError('Shape definition must be a plain object.'),
            );
        }
        const geometry = normalizeShapeGeometry(definition.geometry);
        const object = this.createObject(geometry, definition);
        return this.authoring.create({
            kind: SHAPE_ANNOTATION_KIND,
            object,
            name: definition.name ?? `${this.configuration.namePrefix} ${++this.nameSequence}`,
            ...(definition.metadata === undefined ? {} : { metadata: definition.metadata }),
            ...(definition.hidden === undefined ? {} : { hidden: definition.hidden }),
            ...(definition.locked === undefined ? {} : { locked: definition.locked }),
            ...(definition.select === undefined ? {} : { select: definition.select }),
            operationId,
        });
    }

    update(id: AnnotationId, patch: ShapeAnnotationUpdate): Promise<void> {
        this.assertActive('update Shape');
        if (!isPlainRecord(patch as unknown)) {
            return Promise.reject(new AnnotationValidationError('Shape update must be an object.'));
        }
        const featurePatch = normalizeFeatureUpdate({
            ...(patch.stroke !== undefined ? { stroke: patch.stroke } : {}),
            ...(patch.strokeWidth !== undefined ? { strokeWidth: patch.strokeWidth } : {}),
            ...(patch.fill !== undefined ? { fill: patch.fill } : {}),
            ...(patch.opacity !== undefined ? { opacity: patch.opacity } : {}),
            ...(patch.strokeDashArray !== undefined
                ? { strokeDashArray: patch.strokeDashArray }
                : {}),
        });
        return this.authoring.updateFeature({
            id,
            kind: SHAPE_ANNOTATION_KIND,
            patch: featurePatch,
            shared: sharedUpdate(patch),
            operationId: 'annotation-shape:update',
        });
    }

    configure(patch: Partial<ShapeAnnotationConfiguration>): void {
        this.assertActive('configure Shape');
        this.configuration = resolveShapeConfiguration(patch, this.configuration);
    }

    getConfiguration(): Readonly<ShapeAnnotationConfiguration> {
        this.assertActive('read Shape configuration');
        return Object.freeze({
            ...this.configuration,
            strokeDashArray: this.configuration.strokeDashArray
                ? Object.freeze([...this.configuration.strokeDashArray])
                : null,
        });
    }

    getSession(): ShapeSessionState | null {
        this.assertActive('read Shape session');
        return this.session
            ? Object.freeze({
                  kind: this.session.options.kind,
                  geometry: this.session.geometry,
              })
            : null;
    }

    closeForImage(): void {
        if (this.session) this.closeSession();
    }

    dispose(): void {
        if (this.disposed) return;
        if (this.session) this.closeSession();
        this.disposed = true;
    }

    private createObject(
        geometry: ShapeGeometryInput,
        style: ShapeAnnotationDefinition | ShapeSessionOptions,
    ): ShapeObject {
        const resolved = this.resolveStyle(style);
        const common = {
            stroke: resolved.stroke,
            strokeWidth: resolved.strokeWidth,
            fill: resolved.fill,
            opacity: resolved.opacity,
            strokeDashArray: resolved.strokeDashArray ? [...resolved.strokeDashArray] : null,
            selectable: resolved.selectable,
            evented: resolved.evented,
            strokeLineCap: 'round' as const,
            strokeLineJoin: 'round' as const,
            objectCaching: false,
        };
        let object: ShapeObject;
        if (geometry.kind === 'rect') {
            object = new this.host.fabric.Rect({
                ...common,
                left: geometry.left,
                top: geometry.top,
                width: geometry.width,
                height: geometry.height,
                originX: 'left',
                originY: 'top',
            });
        } else if (geometry.kind === 'line') {
            object = new this.host.fabric.Line(
                [geometry.start.x, geometry.start.y, geometry.end.x, geometry.end.y],
                common,
            );
        } else {
            object = new this.host.fabric.Path(
                buildArrowPath(geometry, resolved.arrowHeadLength),
                common,
            );
        }
        object.editorShapeKind = geometry.kind;
        object.editorShapeGeometry = geometry;
        return object;
    }

    private resolveStyle(
        value: ShapeAnnotationDefinition | ShapeSessionOptions,
    ): ShapeAnnotationConfiguration {
        return resolveShapeConfiguration({
            stroke: value.stroke ?? this.configuration.stroke,
            strokeWidth: value.strokeWidth ?? this.configuration.strokeWidth,
            fill: value.fill ?? this.configuration.fill,
            opacity: value.opacity ?? this.configuration.opacity,
            strokeDashArray:
                value.strokeDashArray === undefined
                    ? this.configuration.strokeDashArray
                    : value.strokeDashArray,
            arrowHeadLength: value.arrowHeadLength ?? this.configuration.arrowHeadLength,
            selectable: value.selectable ?? this.configuration.selectable,
            evented: value.evented ?? this.configuration.evented,
            bindToImageTransform: this.configuration.bindToImageTransform,
            namePrefix: this.configuration.namePrefix,
        });
    }

    private closeSession(): void {
        const session = this.session;
        if (!session) return;
        this.session = null;
        if (session.previewId) this.authoring.removePreview([session.previewId]);
    }

    private requireSession(operation: string): ShapeRuntimeSession {
        this.assertActive(operation);
        if (!this.session) {
            throw new AnnotationValidationError(`Cannot ${operation} without a Shape session.`);
        }
        return this.session;
    }

    private assertImageLoaded(): void {
        if (!this.host.isImageLoaded()) {
            throw new AnnotationValidationError('Shape Annotation requires a loaded image.');
        }
    }

    private assertActive(operation: string): void {
        if (this.disposed) {
            throw new AnnotationValidationError(`Cannot ${operation} after disposal.`);
        }
    }
}
