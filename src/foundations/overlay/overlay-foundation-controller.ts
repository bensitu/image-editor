/**
 * Owns Overlay registration, persistence, interaction, geometry, and export coordination.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import {
    CoreRuntimeError,
    type CoreExportOptions,
    type DocumentMutationContext,
    type DocumentMutationPort,
    type GeometryMutationDescriptor,
    type GeometryMutationPort,
    type GeometryParticipantContext,
} from '../../core/index.js';
import type {
    BaseImageReadPort,
    CanvasReadPort,
    CoreDiagnosticsPort,
    CorePresentationPort,
    Disposable,
    FabricRuntimePort,
    ExportContributionPort,
    RasterMutationPort,
    RenderRequestPort,
    SnapshotRegistrationPort,
} from '../../sdk/index.js';
import {
    PluginManifestError,
    createDisposable,
    disposeInReverseSync,
    isRuntimeIdentifier,
    isValidSemVer,
} from '../../sdk/index.js';
import { applyDeltaToObject, type FabricUtilAccess } from './overlay-transform-delta.js';
import { OverlayRecoverableObjectError } from './overlay-errors.js';
import type {
    FlattenOptions,
    FabricObjectCodec,
    OverlayClassification,
    OverlayExportOptions,
    OverlayExportRenderer,
    OverlayFoundationApi,
    OverlayGeometryPolicy,
    OverlayInteractionContext,
    OverlayInteractionPolicy,
    OverlayKindDefinition,
    OverlayMutationAction,
    OverlayMutationContext,
    OverlayMutationDescriptor,
    OverlayMutationRequest,
    OverlayQuery,
    OverlaySelectionState,
    OverlayStateKindAdapter,
    SerializedOverlayRecord,
} from './overlay-types.js';

type MarkedOverlayObject = FabricNS.FabricObject & {
    editorOverlayKind?: string;
    editorOverlayId?: string;
    editorOverlayHidden?: boolean;
    editorOverlayLocked?: boolean;
};

interface KindRecord {
    readonly definition: OverlayKindDefinition;
    readonly registrationOrder: number;
}

interface IndexedOverlay {
    readonly object: FabricNS.FabricObject;
    readonly kind: KindRecord;
    readonly persistentId: string;
    preview?: [boolean, boolean, number];
}

interface ActiveOverlayGesture {
    readonly id: string;
    action: OverlayMutationAction;
    readonly targets: readonly IndexedOverlay[];
    readonly completion: Promise<void>;
    readonly resolve: () => void;
    readonly reject: (error: unknown) => void;
    completionSettled: boolean;
    previewWork: Promise<void>;
    transaction: Promise<void> | null;
    context: DocumentMutationContext | null;
}

interface OverlayTransformEvent {
    readonly target?: FabricNS.FabricObject;
    readonly transform?: Readonly<{ action?: string }>;
}

function getActiveCanvasObjects(canvas: FabricNS.Canvas): FabricNS.FabricObject[] {
    const candidate = canvas as FabricNS.Canvas & {
        getActiveObjects?: () => FabricNS.FabricObject[];
        getActiveObject?: () => FabricNS.FabricObject | null;
    };
    if (typeof candidate.getActiveObjects === 'function') return candidate.getActiveObjects();
    const active = candidate.getActiveObject?.();
    return active ? [active] : [];
}

function isAbortError(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'AbortError'
    );
}

function abortError(message: string): Error {
    if (typeof DOMException === 'function') return new DOMException(message, 'AbortError');
    const error = new Error(message);
    error.name = 'AbortError';
    return error;
}

function gestureAction(value: string | undefined): OverlayMutationAction {
    if (value === 'rotate' || value?.includes('rotate')) return 'rotate';
    if (value === 'scale' || value?.includes('scale')) return 'scale';
    return 'move';
}

interface OverlayFoundationState {
    readonly version: 1;
    readonly overlays: readonly SerializedOverlayRecord[];
    readonly selectionIds: readonly string[];
}

interface PreparedOverlay {
    readonly object: FabricNS.FabricObject;
    readonly persistentId: string;
    readonly kind: string;
    readonly transform: Readonly<{
        left: number;
        top: number;
        scaleX: number;
        scaleY: number;
        angle: number;
        skewX: number;
        skewY: number;
        flipX: boolean;
        flipY: boolean;
        originX: FabricNS.TOriginX;
        originY: FabricNS.TOriginY;
        visible: boolean;
        selectable: boolean;
        evented: boolean;
    }>;
}

interface PreparedOverlayGeometry {
    readonly entries: readonly PreparedOverlay[];
    readonly selectionIds: readonly string[];
}

type OverlayCoreAccess = CoreDiagnosticsPort &
    CorePresentationPort &
    FabricRuntimePort &
    CanvasReadPort &
    BaseImageReadPort &
    RenderRequestPort &
    RasterMutationPort & {
        runOperation(operationId: string, task: () => void | Promise<void>): Promise<void>;
    };

const OVERLAY_STATE_ID = 'foundation:overlay';
const OVERLAY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function freezePersistence(
    definition: OverlayKindDefinition,
): OverlayKindDefinition['persistence'] {
    const persistence = definition.persistence as unknown;
    const failure = (message: string): never => {
        throw new PluginManifestError(
            `Plugin "${definition.ownerPluginId}" Overlay Kind "${definition.id}" ${message}`,
            { pluginId: definition.ownerPluginId },
        );
    };
    if (!isRecord(persistence)) return failure('must declare persistence.');
    if (persistence.mode === 'transient') {
        if (Object.prototype.hasOwnProperty.call(persistence, 'codec')) {
            return failure('must not attach a Codec in transient mode.');
        }
        return Object.freeze({ mode: 'transient' });
    }
    if (persistence.mode !== 'persistent') {
        return failure('must use persistent or transient mode.');
    }
    const codec = persistence.codec;
    if (
        !isRecord(codec) ||
        typeof codec.type !== 'string' ||
        !isRuntimeIdentifier(codec.type) ||
        typeof codec.version !== 'string' ||
        !isValidSemVer(codec.version) ||
        typeof codec.serialize !== 'function' ||
        typeof codec.validate !== 'function' ||
        typeof codec.deserialize !== 'function'
    ) {
        return failure(
            'requires a valid Codec with type, SemVer version, serialize, validate, and deserialize.',
        );
    }
    const frozenCodec: FabricObjectCodec = Object.freeze({
        type: codec.type,
        version: codec.version,
        serialize: codec.serialize as FabricObjectCodec['serialize'],
        validate: codec.validate as FabricObjectCodec['validate'],
        deserialize: codec.deserialize as FabricObjectCodec['deserialize'],
    });
    return Object.freeze({ mode: 'persistent', codec: frozenCodec });
}

function isSerializedRecord(value: unknown): value is SerializedOverlayRecord {
    return (
        isRecord(value) &&
        typeof value.kind === 'string' &&
        value.kind.trim().length > 0 &&
        typeof value.persistentId === 'string' &&
        OVERLAY_ID_PATTERN.test(value.persistentId) &&
        typeof value.hidden === 'boolean' &&
        typeof value.locked === 'boolean' &&
        isRecord(value.codec) &&
        typeof value.codec.type === 'string' &&
        isRuntimeIdentifier(value.codec.type) &&
        typeof value.codec.version === 'string' &&
        isValidSemVer(value.codec.version) &&
        Object.prototype.hasOwnProperty.call(value, 'data')
    );
}

function validateStateShape(value: unknown): value is OverlayFoundationState {
    return (
        isRecord(value) &&
        value.version === 1 &&
        Array.isArray(value.overlays) &&
        value.overlays.length <= 100_000 &&
        value.overlays.every(isSerializedRecord) &&
        Array.isArray(value.selectionIds) &&
        value.selectionIds.every(
            (persistentId) =>
                typeof persistentId === 'string' && OVERLAY_ID_PATTERN.test(persistentId),
        ) &&
        new Set(value.selectionIds).size === value.selectionIds.length
    );
}

function getImageExportRegion(
    image: FabricNS.FabricImage,
    canvas: FabricNS.Canvas,
): Readonly<{ left: number; top: number; width: number; height: number }> {
    image.setCoords();
    const bounds = image.getBoundingRect();
    const canvasWidth = Math.max(1, Math.round(canvas.getWidth()));
    const canvasHeight = Math.max(1, Math.round(canvas.getHeight()));
    const left = Math.min(canvasWidth - 1, Math.max(0, Math.floor(bounds.left)));
    const top = Math.min(canvasHeight - 1, Math.max(0, Math.floor(bounds.top)));
    const right = Math.min(canvasWidth, Math.max(left + 1, Math.ceil(bounds.left + bounds.width)));
    const bottom = Math.min(canvasHeight, Math.max(top + 1, Math.ceil(bounds.top + bounds.height)));
    return Object.freeze({
        left,
        top,
        width: Math.max(1, right - left),
        height: Math.max(1, bottom - top),
    });
}

function captureTransform(object: FabricNS.FabricObject): PreparedOverlay['transform'] {
    return Object.freeze({
        left: Number(object.left) || 0,
        top: Number(object.top) || 0,
        scaleX: Number(object.scaleX) || 1,
        scaleY: Number(object.scaleY) || 1,
        angle: Number(object.angle) || 0,
        skewX: Number(object.skewX) || 0,
        skewY: Number(object.skewY) || 0,
        flipX: object.flipX === true,
        flipY: object.flipY === true,
        originX: object.originX ?? 'left',
        originY: object.originY ?? 'top',
        visible: object.visible !== false,
        selectable: object.selectable !== false,
        evented: object.evented !== false,
    });
}

function parseExportOptions(value: unknown): OverlayExportOptions {
    if (!isRecord(value)) return {};
    const includeKinds = Array.isArray(value.includeKinds)
        ? value.includeKinds.filter((kind): kind is string => typeof kind === 'string')
        : undefined;
    const excludeKinds = Array.isArray(value.excludeKinds)
        ? value.excludeKinds.filter((kind): kind is string => typeof kind === 'string')
        : undefined;
    return Object.freeze({
        includeKinds: includeKinds ? Object.freeze(includeKinds) : undefined,
        excludeKinds: excludeKinds ? Object.freeze(excludeKinds) : undefined,
        includeHidden: value.includeHidden === true,
    });
}

export class OverlayFoundationController implements OverlayFoundationApi, Disposable {
    private readonly kinds = new Map<string, KindRecord>();
    private readonly policies = new Map<string, OverlayGeometryPolicy>();
    private readonly interactionPolicies = new Map<string, OverlayInteractionPolicy>();
    private readonly serializers = new Map<string, FabricObjectCodec>();
    private readonly renderers = new Map<string, OverlayExportRenderer>();
    private readonly byId = new Map<string, IndexedOverlay>();
    private readonly byObject = new WeakMap<FabricNS.FabricObject, IndexedOverlay>();
    private readonly selectionListeners = new Set<(state: OverlaySelectionState) => void>();
    private readonly registrations: Disposable[] = [];
    private preservedRecords: SerializedOverlayRecord[] = [];
    private registrationSequence = 0;
    private generatedIdSequence = 0;
    private activeGesture: ActiveOverlayGesture | null = null;
    private lastGestureTransaction: Promise<void> | null = null;
    private attached = false;
    private disposed = false;

    private readonly onObjectAdded = (event: { target?: FabricNS.FabricObject }): void => {
        if (event.target) this.indexObject(event.target);
    };

    private readonly onObjectRemoved = (event: { target?: FabricNS.FabricObject }): void => {
        if (event.target) this.unindexObject(event.target);
    };

    private readonly onSelectionChanged = (): void => this.emitSelection();

    private readonly onBeforeTransform = (event: OverlayTransformEvent): void => {
        if (!event.target) return;
        this.beginGesture(event.target, gestureAction(event.transform?.action));
    };

    private readonly onObjectMoving = (event: OverlayTransformEvent): void => {
        this.previewGesture(event.target, 'move');
    };

    private readonly onObjectScaling = (event: OverlayTransformEvent): void => {
        this.previewGesture(event.target, 'scale');
    };

    private readonly onObjectRotating = (event: OverlayTransformEvent): void => {
        this.previewGesture(event.target, 'rotate');
    };

    private readonly onObjectModified = (event: OverlayTransformEvent): void => {
        if (!event.target || !this.activeGesture) return;
        const eventIds = new Set(
            this.resolveOverlayTargets(event.target).map((entry) => entry.persistentId),
        );
        if (
            eventIds.size > 0 &&
            this.activeGesture.targets.some((entry) => !eventIds.has(entry.persistentId))
        ) {
            this.failGesture(
                this.activeGesture,
                new CoreRuntimeError('[ImageEditor] Overlay gesture target changed before commit.'),
            );
            return;
        }
        this.resolveGesture(this.activeGesture);
    };

    constructor(
        private readonly host: OverlayCoreAccess,
        state: SnapshotRegistrationPort,
        private readonly geometry: GeometryMutationPort,
        private readonly mutations: DocumentMutationPort,
        exportPort: ExportContributionPort,
    ) {
        try {
            this.registrations.push(
                state.registerObjectProperties({
                    owner: OVERLAY_STATE_ID,
                    keys: [
                        'editorOverlayKind',
                        'editorOverlayId',
                        'editorOverlayHidden',
                        'editorOverlayLocked',
                    ],
                }),
            );
            this.registrations.push(
                state.registerExternalObject(
                    OVERLAY_STATE_ID,
                    (object) =>
                        typeof (object as MarkedOverlayObject).editorOverlayKind === 'string',
                ),
            );
            this.registrations.push(
                state.registerSlice({
                    id: OVERLAY_STATE_ID,
                    version: 1,
                    capturePolicy: 'always',
                    capture: () => this.captureState(),
                    validate: (value) => this.validateSnapshotState(value),
                    restore: (value) => this.restoreState(value),
                    clearState: () => this.resetState(),
                }),
            );
            this.registrations.push(
                geometry.registerParticipant({
                    id: OVERLAY_STATE_ID,
                    order: 100,
                    supports: () => true,
                    prepare: (mutation) => this.prepareGeometry(mutation),
                    apply: (mutation, prepared, context) =>
                        this.applyGeometry(mutation, prepared as PreparedOverlayGeometry, context),
                    synchronize: (mutation) => this.synchronizeGeometry(mutation),
                    rollback: (mutation, prepared) => {
                        void mutation;
                        this.rollbackGeometry(prepared as PreparedOverlayGeometry);
                    },
                }),
            );
            this.registrations.push(
                exportPort.register(OVERLAY_STATE_ID, {
                    id: OVERLAY_STATE_ID,
                    order: 100,
                    isEnabled: () => this.byId.size > 0,
                    render: (context) => this.renderExport(context.canvas, context.options),
                }),
            );
        } catch (error) {
            disposeInReverseSync(this.registrations, { pluginId: OVERLAY_STATE_ID });
            this.registrations.length = 0;
            throw error;
        }
        if (host.getCanvas()) this.attach();
    }

    attach(): void {
        this.assertActive('attach Overlay Foundation');
        if (this.attached) return;
        const canvas = this.host.requireCanvas('attach Overlay Foundation');
        if (typeof canvas.on === 'function') {
            canvas.on('object:added', this.onObjectAdded);
            canvas.on('object:removed', this.onObjectRemoved);
            canvas.on('before:transform', this.onBeforeTransform);
            canvas.on('object:moving', this.onObjectMoving);
            canvas.on('object:scaling', this.onObjectScaling);
            canvas.on('object:rotating', this.onObjectRotating);
            canvas.on('object:modified', this.onObjectModified);
            canvas.on('selection:created', this.onSelectionChanged);
            canvas.on('selection:updated', this.onSelectionChanged);
            canvas.on('selection:cleared', this.onSelectionChanged);
        }
        this.attached = true;
        this.rebuildIndex();
    }

    registerKind(definition: OverlayKindDefinition): Disposable {
        this.assertActive('register an overlay kind');
        if (
            !isRecord(definition) ||
            typeof definition.classify !== 'function' ||
            typeof definition.getPersistentId !== 'function' ||
            (definition.setPersistentId !== undefined &&
                typeof definition.setPersistentId !== 'function')
        ) {
            throw new PluginManifestError(
                'Overlay Kind registration requires callable classify and persistent identity members.',
                {
                    pluginId:
                        isRecord(definition) && typeof definition.ownerPluginId === 'string'
                            ? definition.ownerPluginId
                            : undefined,
                },
            );
        }
        this.assertRuntimeIdentifier(definition.id, 'Overlay kind id');
        this.assertRuntimeIdentifier(definition.ownerPluginId, 'Overlay kind owner');
        const persistence = freezePersistence(definition);
        const existing = this.kinds.get(definition.id);
        if (existing) {
            throw new CoreRuntimeError(
                `[ImageEditor] Overlay kind "${definition.id}" is already registered by "${existing.definition.ownerPluginId}".`,
            );
        }
        const record: KindRecord = {
            definition: Object.freeze({ ...definition, persistence }),
            registrationOrder: this.registrationSequence++,
        };
        this.kinds.set(definition.id, record);
        if (persistence.mode === 'persistent') {
            this.serializers.set(definition.id, persistence.codec);
        }
        this.rebuildIndex();
        return createDisposable(() => {
            if (this.kinds.get(definition.id) !== record) return;
            this.kinds.delete(definition.id);
            this.serializers.delete(definition.id);
            const canvas = this.host.getCanvas();
            for (const indexed of [...this.byId.values()]) {
                if (indexed.kind !== record) continue;
                if (persistence.mode === 'transient' && canvas) canvas.remove(indexed.object);
                else this.unindexObject(indexed.object);
            }
            this.rebuildIndex();
        });
    }

    registerGeometryPolicy(policy: OverlayGeometryPolicy): Disposable {
        this.assertActive('register an overlay geometry policy');
        this.assertRuntimeIdentifier(policy.id, 'Overlay geometry policy id');
        this.requireKindOwner(policy.kind, policy.ownerPluginId);
        if (this.policies.has(policy.kind)) {
            throw new CoreRuntimeError(
                `[ImageEditor] Overlay kind "${policy.kind}" already has a geometry policy.`,
            );
        }
        const frozen = Object.freeze({ ...policy });
        this.policies.set(policy.kind, frozen);
        return createDisposable(() => {
            if (this.policies.get(policy.kind) === frozen) this.policies.delete(policy.kind);
        });
    }

    registerInteractionPolicy(policy: OverlayInteractionPolicy): Disposable {
        this.assertActive('register an overlay interaction policy');
        this.assertRuntimeIdentifier(policy.id, 'Overlay interaction policy id');
        this.requireKindOwner(policy.kind, policy.ownerPluginId);
        if (this.interactionPolicies.has(policy.kind)) {
            throw new CoreRuntimeError(
                `[ImageEditor] Overlay kind "${policy.kind}" already has an interaction policy.`,
            );
        }
        const frozen = Object.freeze({ ...policy });
        this.interactionPolicies.set(policy.kind, frozen);
        return createDisposable(() => {
            if (this.interactionPolicies.get(policy.kind) === frozen) {
                this.interactionPolicies.delete(policy.kind);
            }
        });
    }

    registerExportRenderer(renderer: OverlayExportRenderer): Disposable {
        this.assertActive('register an overlay export renderer');
        this.assertRuntimeIdentifier(renderer.id, 'Overlay export renderer id');
        this.requireKindOwner(renderer.kind, renderer.ownerPluginId);
        if (!Number.isFinite(renderer.order)) {
            throw new CoreRuntimeError(
                '[ImageEditor] Overlay export renderer order must be finite.',
            );
        }
        if (this.renderers.has(renderer.kind)) {
            throw new CoreRuntimeError(
                `[ImageEditor] Overlay kind "${renderer.kind}" already has an export renderer.`,
            );
        }
        const frozen = Object.freeze({ ...renderer });
        this.renderers.set(renderer.kind, frozen);
        return createDisposable(() => {
            if (this.renderers.get(renderer.kind) === frozen) this.renderers.delete(renderer.kind);
        });
    }

    list(query: OverlayQuery = {}): readonly FabricNS.FabricObject[] {
        this.assertActive('list overlays');
        const kinds = query.kinds ? new Set(query.kinds) : null;
        const ids = query.ids ? new Set(query.ids) : null;
        const canvas = this.host.requireCanvas('list overlays');
        return Object.freeze(
            canvas.getObjects().filter((object) => {
                const indexed = this.byObject.get(object);
                if (!indexed) return false;
                const classification = this.classificationFor(indexed);
                return (
                    (!kinds || kinds.has(classification.kind)) &&
                    (!ids || ids.has(classification.persistentId)) &&
                    (query.includeHidden === true || !classification.hidden) &&
                    (query.includeLocked === true || !classification.locked)
                );
            }),
        );
    }

    getByPersistentId(id: string): FabricNS.FabricObject | null {
        this.assertActive('get an overlay');
        return this.byId.get(id)?.object ?? null;
    }

    classify(object: FabricNS.FabricObject): OverlayClassification | null {
        this.assertActive('classify an overlay');
        const indexed = this.byObject.get(object);
        return indexed ? this.classificationFor(indexed) : null;
    }

    getStateKind(kind: string): OverlayStateKindAdapter | null {
        return this.kinds.get(kind)?.definition ?? null;
    }

    getSelection(): OverlaySelectionState {
        this.assertActive('read overlay selection');
        const active = getActiveCanvasObjects(this.host.requireCanvas('read overlay selection'));
        const classifications = active
            .map((object) => this.byObject.get(object))
            .filter((entry): entry is IndexedOverlay => entry !== undefined)
            .map((entry) => this.classificationFor(entry));
        return Object.freeze({
            ids: Object.freeze(classifications.map((entry) => entry.persistentId)),
            primaryId: classifications[0]?.persistentId ?? null,
            kinds: Object.freeze([...new Set(classifications.map((entry) => entry.kind))]),
        });
    }

    select(ids: readonly string[]): void {
        this.assertActive('select overlays');
        this.applySelection(ids);
    }

    private applySelection(ids: readonly string[]): void {
        const canvas = this.host.getCanvas();
        if (!canvas) throw new CoreRuntimeError('[ImageEditor] Overlay selection requires Canvas.');
        const objects = ids.map((id) => this.requireIndexed(id).object);
        if (objects.length === 0) {
            canvas.discardActiveObject();
        } else if (objects.length === 1) {
            canvas.setActiveObject(objects[0]!);
        } else {
            canvas.setActiveObject(new this.host.fabric.ActiveSelection(objects, { canvas }));
        }
        this.host.requestRender();
        this.emitSelection();
    }

    discardSelection(): void {
        this.assertActive('discard overlay selection');
        this.host.requireCanvas('discard overlay selection').discardActiveObject();
        this.host.requestRender();
        this.emitSelection();
    }

    onSelectionChange(listener: (state: OverlaySelectionState) => void): Disposable {
        this.assertActive('subscribe to overlay selection');
        this.selectionListeners.add(listener);
        return createDisposable(() => {
            this.selectionListeners.delete(listener);
        });
    }

    hideForPreview(ids: readonly string[]): Disposable {
        this.assertActive('hide overlays');
        const targets = this.resolveOverlayIds(ids);
        for (const target of targets) {
            const existing = target.preview;
            if (existing) {
                existing[2] += 1;
                continue;
            }
            target.preview = [
                target.object.visible !== false,
                this.classificationFor(target).hidden,
                1,
            ];
            target.object.visible = false;
        }
        if (targets.length) this.host.requestRender();
        return createDisposable(() => {
            let restored = false;
            for (const target of targets) {
                const record = target.preview;
                if (!record) continue;
                if (--record[2]) continue;
                target.preview = undefined;
                target.object.visible = record[0];
                restored = true;
            }
            if (restored && !this.disposed) this.host.requestRender();
        });
    }

    setHidden(id: string, hidden: boolean): Promise<void> {
        return this.mutate({
            id: this.nextMutationId('visibility'),
            operationId: 'overlay:set-hidden',
            action: 'visibility',
            objectIds: [id],
            metadata: Object.freeze({ hidden }),
            mutate: () => this.applyHidden(id, hidden),
        });
    }

    setLocked(id: string, locked: boolean): Promise<void> {
        return this.mutate({
            id: this.nextMutationId('locking'),
            operationId: 'overlay:set-locked',
            action: 'locking',
            objectIds: [id],
            metadata: Object.freeze({ locked }),
            mutate: () => this.applyLocked(id, locked),
        });
    }

    bringForward(id: string): Promise<void> {
        return this.mutateLayer(id, 'forward', () => this.moveRelative(id, 1));
    }

    sendBackward(id: string): Promise<void> {
        return this.mutateLayer(id, 'backward', () => this.moveRelative(id, -1));
    }

    bringToFront(id: string): Promise<void> {
        return this.mutateLayer(id, 'front', () => {
            const overlays = this.indexedCanvasObjects();
            this.moveToOverlayIndex(id, overlays.length - 1, overlays);
        });
    }

    sendToBack(id: string): Promise<void> {
        return this.mutateLayer(id, 'back', () =>
            this.moveToOverlayIndex(id, 0, this.indexedCanvasObjects()),
        );
    }

    async mutate<TResult>(request: OverlayMutationRequest<TResult>): Promise<TResult> {
        this.assertActive('run an overlay mutation');
        this.assertOpaqueIdentifier(request.id, 'Overlay mutation id');
        this.assertRuntimeIdentifier(request.operationId, 'Overlay mutation operation id');
        this.assertOpaqueIdentifier(request.action, 'Overlay mutation action');
        const initialTargets = this.resolveOverlayIds(request.objectIds ?? []);
        let affectedTargets = initialTargets;
        let descriptor: OverlayMutationDescriptor | null = null;
        return this.mutations.run({
            id: request.id,
            kind: 'overlay',
            operationId: request.operationId,
            conflictDomains: ['document', 'overlay', 'selection', 'state'],
            parent: request.parent,
            metadata: request.metadata,
            mutate: async (transaction) => {
                const context = this.createMutationContext(
                    transaction,
                    request.action,
                    initialTargets,
                );
                return request.mutate(context);
            },
            synchronize: async (result, transaction) => {
                this.rebuildIndex();
                const context = this.createMutationContext(
                    transaction,
                    request.action,
                    initialTargets,
                );
                const additional = request.affectedObjects
                    ? await request.affectedObjects(result, context)
                    : [];
                affectedTargets = this.mergeTargets(
                    initialTargets,
                    this.resolveOverlayObjects(additional),
                );
                descriptor = this.createMutationDescriptor(
                    request.id,
                    request.operationId,
                    request.action,
                    affectedTargets,
                    transaction.metadata,
                );
                await this.runInteractionPolicies(
                    affectedTargets,
                    descriptor,
                    transaction,
                    'synchronize',
                );
                await request.synchronize?.(result, context);
            },
            validate: async (result, transaction) => {
                const currentDescriptor = descriptor;
                if (!currentDescriptor) {
                    throw new CoreRuntimeError(
                        '[ImageEditor] Overlay mutation synchronization did not produce a descriptor.',
                    );
                }
                await this.validateMutation(affectedTargets, currentDescriptor, transaction);
                await request.validate?.(
                    result,
                    this.createMutationContext(transaction, request.action, affectedTargets),
                );
            },
            describeCommit: () => {
                if (!descriptor) {
                    throw new CoreRuntimeError(
                        '[ImageEditor] Overlay mutation descriptor is unavailable at commit.',
                    );
                }
                return descriptor;
            },
        });
    }

    add(objects: readonly FabricNS.FabricObject[]): Promise<void> {
        if (objects.length === 0) return Promise.resolve();
        const uniqueObjects = Object.freeze([...new Set(objects)]);
        return this.mutate({
            id: this.nextMutationId('create'),
            operationId: 'overlay:add',
            action: 'create',
            metadata: Object.freeze({ objectCount: uniqueObjects.length }),
            mutate: () => {
                const canvas = this.host.requireCanvas('add overlays');
                for (const object of uniqueObjects) canvas.add(object);
            },
            affectedObjects: () => {
                const indexed = this.resolveOverlayObjects(uniqueObjects);
                if (
                    indexed.length !== uniqueObjects.length ||
                    indexed.some((entry) => entry.kind.definition.persistence.mode !== 'persistent')
                ) {
                    throw new CoreRuntimeError(
                        '[ImageEditor] Overlay insertion accepts only registered persistent kinds.',
                    );
                }
                return uniqueObjects;
            },
        });
    }

    addTransient(objects: readonly FabricNS.FabricObject[]): Promise<void> {
        if (objects.length === 0) return Promise.resolve();
        const uniqueObjects = Object.freeze([...new Set(objects)]);
        return this.host.runOperation('overlay:transient', async () => {
            const canvas = this.host.requireCanvas('add transient overlays');
            try {
                for (const object of uniqueObjects) canvas.add(object);
                this.rebuildIndex();
                const indexed = this.resolveOverlayObjects(uniqueObjects);
                if (
                    indexed.length !== uniqueObjects.length ||
                    indexed.some((entry) => entry.kind.definition.persistence.mode !== 'transient')
                ) {
                    throw new CoreRuntimeError(
                        '[ImageEditor] Transient overlay insertion accepts only registered transient kinds.',
                    );
                }
                this.host.requestRender();
            } catch (error) {
                for (const object of uniqueObjects) canvas.remove(object);
                this.rebuildIndex();
                throw error;
            }
        });
    }

    replaceTransient(
        ids: readonly string[],
        objects: readonly FabricNS.FabricObject[],
    ): Promise<void> {
        const uniqueIds = Object.freeze([...new Set(ids)]);
        const uniqueObjects = Object.freeze([...new Set(objects)]);
        if (uniqueIds.length === 0) return this.addTransient(uniqueObjects);
        if (uniqueObjects.length === 0) return this.removeTransient(uniqueIds);
        return this.host.runOperation('overlay:transient', async () => {
            const canvas = this.host.requireCanvas('replace transient overlays');
            const removed = uniqueIds.map((id) => this.requireIndexed(id));
            if (removed.some((entry) => entry.kind.definition.persistence.mode !== 'transient')) {
                throw new CoreRuntimeError(
                    '[ImageEditor] Transient overlay replacement accepts only transient kinds.',
                );
            }
            try {
                for (const entry of removed) canvas.remove(entry.object);
                for (const object of uniqueObjects) canvas.add(object);
                this.rebuildIndex();
                const inserted = this.resolveOverlayObjects(uniqueObjects);
                if (
                    inserted.length !== uniqueObjects.length ||
                    inserted.some((entry) => entry.kind.definition.persistence.mode !== 'transient')
                ) {
                    throw new CoreRuntimeError(
                        '[ImageEditor] Transient overlay replacement produced an invalid kind.',
                    );
                }
                this.host.requestRender();
            } catch (error) {
                for (const object of uniqueObjects) canvas.remove(object);
                for (const entry of removed) {
                    if (!canvas.getObjects().includes(entry.object)) canvas.add(entry.object);
                }
                this.rebuildIndex();
                throw error;
            }
        });
    }

    remove(ids: readonly string[]): Promise<void> {
        if (ids.length === 0) return Promise.resolve();
        const uniqueIds = Object.freeze([...new Set(ids)]);
        return this.mutate({
            id: this.nextMutationId('delete'),
            operationId: 'overlay:remove',
            action: 'delete',
            objectIds: uniqueIds,
            metadata: Object.freeze({ objectCount: uniqueIds.length }),
            mutate: () => {
                const canvas = this.host.requireCanvas('remove overlays');
                const objects = uniqueIds.map((id) => this.requireIndexed(id).object);
                if (getActiveCanvasObjects(canvas).some((object) => objects.includes(object))) {
                    canvas.discardActiveObject();
                }
                for (const object of objects) canvas.remove(object);
            },
        });
    }

    removeTransient(ids: readonly string[]): Promise<void> {
        if (ids.length === 0) return Promise.resolve();
        const uniqueIds = Object.freeze([...new Set(ids)]);
        return this.host.runOperation('overlay:transient', async () => {
            const entries = uniqueIds.map((id) => this.requireIndexed(id));
            if (entries.some((entry) => entry.kind.definition.persistence.mode !== 'transient')) {
                throw new CoreRuntimeError(
                    '[ImageEditor] Transient overlay removal accepts only transient kinds.',
                );
            }
            const canvas = this.host.requireCanvas('remove transient overlays');
            if (
                getActiveCanvasObjects(canvas).some((object) =>
                    entries.some((entry) => entry.object === object),
                )
            ) {
                canvas.discardActiveObject();
            }
            for (const entry of entries) canvas.remove(entry.object);
            this.rebuildIndex();
            this.host.requestRender();
        });
    }

    async cancelActiveGesture(
        reason: unknown = abortError('Overlay gesture was cancelled.'),
    ): Promise<void> {
        const gesture = this.activeGesture;
        if (!gesture?.transaction) return;
        this.failGesture(gesture, reason);
        try {
            await gesture.transaction;
        } catch (error) {
            if (!isAbortError(error) && error !== reason) throw error;
        }
    }

    waitForIdle(): Promise<void> {
        return this.activeGesture?.transaction ?? this.lastGestureTransaction ?? Promise.resolve();
    }

    async flatten(query: OverlayQuery = {}, options: FlattenOptions = {}): Promise<void> {
        this.assertActive('flatten overlays');
        const selected = this.list({
            ...query,
            includeHidden: query.includeHidden === true,
            includeLocked: true,
        });
        if (selected.length === 0) return;
        await this.geometry.run({
            id: `overlay:flatten:${Date.now()}:${++this.generatedIdSequence}`,
            kind: 'flatten',
            operationId: 'overlay:flatten',
            metadata: Object.freeze({ overlayCount: selected.length }),
            mutateBase: async ({ transaction }) => {
                const canvas = this.host.requireCanvas('flatten overlays');
                const baseImage = this.host.getBaseImage();
                if (!baseImage) {
                    throw new CoreRuntimeError(
                        '[ImageEditor] Cannot flatten without a base image.',
                    );
                }
                const exportElement = canvas.lowerCanvasEl.ownerDocument.createElement('canvas');
                const exportCanvas = new this.host.fabric.StaticCanvas(exportElement, {
                    width: canvas.getWidth(),
                    height: canvas.getHeight(),
                    backgroundColor: this.host.backgroundColor,
                    renderOnAddRemove: false,
                });
                try {
                    const format = options.format ?? 'png';
                    const quality = Math.max(0, Math.min(1, options.quality ?? 0.92));
                    const exportOptions = Object.freeze({
                        area: 'image' as const,
                        format,
                        quality,
                        multiplier: 1,
                    });
                    const baseClone = await baseImage.clone();
                    exportCanvas.add(baseClone);
                    exportCanvas.sendObjectToBack(baseClone);
                    await this.renderObjects(exportCanvas, selected, exportOptions);
                    exportCanvas.renderAll();
                    const dataUrl = exportCanvas.toDataURL({
                        format,
                        quality,
                        multiplier: 1,
                        ...getImageExportRegion(baseImage, canvas),
                    });
                    const replacement = await this.host.fabric.FabricImage.fromURL(dataUrl);
                    replacement.set({
                        left: 0,
                        top: 0,
                        originX: 'left',
                        originY: 'top',
                        scaleX: 1,
                        scaleY: 1,
                        selectable: false,
                        evented: false,
                    });
                    replacement.setCoords();
                    this.host.replaceBaseImage(transaction, replacement, {
                        baseScale: 1,
                        mimeType: format === 'jpeg' ? 'image/jpeg' : `image/${format}`,
                    });
                    for (const object of selected) canvas.remove(object);
                } finally {
                    await exportCanvas.dispose();
                }
            },
        });
    }

    dispose(): void {
        if (this.disposed) return;
        if (this.activeGesture) {
            this.failGesture(
                this.activeGesture,
                abortError('Overlay Foundation was disposed during an active gesture.'),
            );
        }
        const canvas = this.host.getCanvas();
        if (canvas) {
            for (const indexed of [...this.byId.values()]) {
                if (indexed.kind.definition.persistence.mode === 'transient') {
                    canvas.remove(indexed.object);
                }
            }
        }
        if (canvas && typeof canvas.off === 'function') {
            canvas.off('object:added', this.onObjectAdded);
            canvas.off('object:removed', this.onObjectRemoved);
            canvas.off('before:transform', this.onBeforeTransform);
            canvas.off('object:moving', this.onObjectMoving);
            canvas.off('object:scaling', this.onObjectScaling);
            canvas.off('object:rotating', this.onObjectRotating);
            canvas.off('object:modified', this.onObjectModified);
            canvas.off('selection:created', this.onSelectionChanged);
            canvas.off('selection:updated', this.onSelectionChanged);
            canvas.off('selection:cleared', this.onSelectionChanged);
        }
        const registrationErrors = disposeInReverseSync(this.registrations, {
            pluginId: OVERLAY_STATE_ID,
        });
        this.registrations.length = 0;
        this.selectionListeners.clear();
        this.setPreviewObjectsHidden(false);
        this.byId.clear();
        this.kinds.clear();
        this.policies.clear();
        this.interactionPolicies.clear();
        this.serializers.clear();
        this.renderers.clear();
        this.preservedRecords = [];
        this.attached = false;
        this.disposed = true;
        if (registrationErrors.length > 0) {
            throw new CoreRuntimeError(
                `[ImageEditor] Overlay Foundation disposal had ${registrationErrors.length} registration cleanup error(s).`,
            );
        }
    }

    private captureState(): OverlayFoundationState {
        this.setPreviewObjectsHidden(false);
        try {
            const canvas = this.host.getCanvas();
            for (const object of canvas?.getObjects() ?? []) {
                const marked = object as MarkedOverlayObject;
                if (typeof marked.editorOverlayKind === 'string' && !this.byObject.has(object)) {
                    throw new CoreRuntimeError(
                        `[ImageEditor] Persistent overlay kind "${marked.editorOverlayKind}" is not registered.`,
                    );
                }
            }
            const overlays: SerializedOverlayRecord[] = [];
            for (const object of this.indexedCanvasObjects()) {
                const indexed = this.byObject.get(object)!;
                if (indexed.kind.definition.persistence.mode === 'transient') continue;
                const serializer = this.serializers.get(indexed.kind.definition.id);
                if (!serializer) {
                    throw new CoreRuntimeError(
                        `[ImageEditor] Overlay kind "${indexed.kind.definition.id}" has no serializer.`,
                    );
                }
                const classification = this.classificationFor(indexed);
                overlays.push(
                    Object.freeze({
                        kind: classification.kind,
                        persistentId: classification.persistentId,
                        hidden: classification.hidden,
                        locked: classification.locked,
                        codec: Object.freeze({
                            type: serializer.type,
                            version: serializer.version,
                        }),
                        data: serializer.serialize(object),
                    }),
                );
            }
            overlays.push(...this.preservedRecords);
            return Object.freeze({
                version: 1,
                overlays: Object.freeze(overlays),
                selectionIds: this.getSelection().ids,
            });
        } finally {
            this.setPreviewObjectsHidden(true);
        }
    }

    private validateSnapshotState(value: unknown) {
        if (!validateStateShape(value)) {
            return { valid: false as const, message: 'Overlay Foundation state is malformed.' };
        }
        const persistentIds = value.overlays.map((record) => record.persistentId);
        if (new Set(persistentIds).size !== persistentIds.length) {
            return {
                valid: false as const,
                message: 'Overlay Foundation state is malformed: duplicate persistent ID detected.',
            };
        }
        for (const record of value.overlays) {
            const kind = this.kinds.get(record.kind);
            const serializer = this.serializers.get(record.kind);
            if (!kind || !serializer) {
                return {
                    valid: false as const,
                    message: `Overlay kind "${record.kind}" has no installed Object Codec.`,
                };
            }
            if (
                kind.definition.persistence.mode !== 'persistent' ||
                record.codec.type !== serializer.type ||
                record.codec.version !== serializer.version
            ) {
                return {
                    valid: false as const,
                    message: `Overlay kind "${record.kind}" Object Codec identity is incompatible.`,
                };
            }
            if (!serializer.validate(record.data)) {
                return {
                    valid: false as const,
                    message: `Overlay "${record.persistentId}" failed Object Codec validation.`,
                };
            }
        }
        return { valid: true as const, value };
    }

    private async restoreState(value: OverlayFoundationState): Promise<void> {
        const canvas = this.host.getCanvas();
        if (!canvas) {
            throw new CoreRuntimeError('[ImageEditor] Overlay state restore requires Canvas.');
        }
        canvas.discardActiveObject();
        for (const indexed of [...this.byId.values()]) canvas.remove(indexed.object);
        this.byId.clear();
        this.preservedRecords = [];
        for (const record of value.overlays) {
            const serializer = this.serializers.get(record.kind);
            const kind = this.kinds.get(record.kind);
            if (
                !serializer ||
                !kind ||
                kind.definition.persistence.mode !== 'persistent' ||
                record.codec.type !== serializer.type ||
                record.codec.version !== serializer.version
            ) {
                this.preservedRecords.push(record);
                continue;
            }
            if (!serializer.validate(record.data)) {
                throw new CoreRuntimeError(
                    `[ImageEditor] Serialized overlay "${record.persistentId}" is invalid.`,
                );
            }
            const object = await serializer.deserialize(record.data, { fabric: this.host.fabric });
            const marked = object as MarkedOverlayObject;
            marked.editorOverlayKind = record.kind;
            marked.editorOverlayId = record.persistentId;
            marked.editorOverlayHidden = record.hidden;
            marked.editorOverlayLocked = record.locked;
            kind.definition.setPersistentId?.(object, record.persistentId);
            canvas.add(object);
            this.applyHidden(record.persistentId, record.hidden);
            this.applyLocked(record.persistentId, record.locked);
        }
        this.rebuildIndex();
        const restoredSelection = value.selectionIds.filter((persistentId) =>
            this.byId.has(persistentId),
        );
        if (restoredSelection.length > 0) this.applySelection(restoredSelection);
        this.host.requestRender();
    }

    private resetState(): void {
        const canvas = this.host.getCanvas();
        if (canvas) {
            canvas.discardActiveObject();
            for (const indexed of [...this.byId.values()]) canvas.remove(indexed.object);
        }
        this.byId.clear();
        this.preservedRecords = [];
    }

    private beginGesture(target: FabricNS.FabricObject, action: OverlayMutationAction): void {
        if (this.disposed) return;
        const targets = this.resolveOverlayTargets(target);
        if (targets.length === 0) return;
        if (this.activeGesture) {
            const currentIds = this.activeGesture.targets.map((entry) => entry.persistentId);
            const nextIds = targets.map((entry) => entry.persistentId);
            if (JSON.stringify(currentIds) === JSON.stringify(nextIds)) return;
            this.failGesture(
                this.activeGesture,
                abortError('Overlay gesture was superseded by another target.'),
            );
            return;
        }

        let resolveCompletion!: () => void;
        let rejectCompletion!: (error: unknown) => void;
        const completion = new Promise<void>((resolve, reject) => {
            resolveCompletion = resolve;
            rejectCompletion = reject;
        });
        const id = this.nextMutationId('gesture');
        const gesture: ActiveOverlayGesture = {
            id,
            action,
            targets,
            completion,
            resolve: resolveCompletion,
            reject: rejectCompletion,
            completionSettled: false,
            previewWork: Promise.resolve(),
            transaction: null,
            context: null,
        };
        this.activeGesture = gesture;
        const transaction = this.mutations
            .run({
                id,
                kind: 'overlay',
                operationId: 'overlay:gesture',
                conflictDomains: ['document', 'overlay', 'selection', 'state'],
                metadata: Object.freeze({
                    interactive: true,
                    objectIds: targets.map((entry) => entry.persistentId),
                }),
                mutate: async (context) => {
                    gesture.context = context;
                    await this.waitForGestureCompletion(gesture, context.signal);
                    await gesture.previewWork;
                    return this.createMutationDescriptor(
                        id,
                        'overlay:gesture',
                        gesture.action,
                        targets,
                        context.metadata,
                    );
                },
                synchronize: (descriptor, context) =>
                    this.runInteractionPolicies(targets, descriptor, context, 'synchronize'),
                validate: (descriptor, context) =>
                    this.validateMutation(targets, descriptor, context),
                describeCommit: (descriptor) => descriptor,
            })
            .then(() => undefined);
        gesture.transaction = transaction;
        this.lastGestureTransaction = transaction;
        transaction.then(
            () => this.clearGesture(gesture),
            () => this.clearGesture(gesture),
        );
        void transaction.catch((error: unknown) => {
            if (!isAbortError(error)) {
                this.host.reportError(error, 'Overlay gesture transaction failed.');
            }
        });
    }

    private previewGesture(
        target: FabricNS.FabricObject | undefined,
        action: OverlayMutationAction,
    ): void {
        const gesture = this.activeGesture;
        if (!target || !gesture || !gesture.context || gesture.completionSettled) return;
        const previewIds = new Set(
            this.resolveOverlayTargets(target).map((entry) => entry.persistentId),
        );
        if (gesture.targets.some((entry) => !previewIds.has(entry.persistentId))) {
            this.failGesture(
                gesture,
                new CoreRuntimeError('[ImageEditor] Overlay preview target changed mid-gesture.'),
            );
            return;
        }
        gesture.action = action;
        const descriptor = this.createMutationDescriptor(
            gesture.id,
            'overlay:gesture',
            action,
            gesture.targets,
            gesture.context.metadata,
        );
        gesture.previewWork = gesture.previewWork
            .then(() =>
                this.runInteractionPolicies(
                    gesture.targets,
                    descriptor,
                    gesture.context!,
                    'preview',
                ),
            )
            .catch((error: unknown) => {
                this.failGesture(gesture, error);
            });
    }

    private resolveGesture(gesture: ActiveOverlayGesture): void {
        if (gesture.completionSettled) return;
        gesture.completionSettled = true;
        gesture.resolve();
    }

    private failGesture(gesture: ActiveOverlayGesture, error: unknown): void {
        if (gesture.completionSettled) return;
        gesture.completionSettled = true;
        gesture.reject(error);
    }

    private clearGesture(gesture: ActiveOverlayGesture): void {
        if (this.activeGesture === gesture) this.activeGesture = null;
    }

    private async waitForGestureCompletion(
        gesture: ActiveOverlayGesture,
        signal: AbortSignal,
    ): Promise<void> {
        if (signal.aborted) {
            throw signal.reason ?? abortError('Overlay gesture was aborted.');
        }
        let abort!: () => void;
        const aborted = new Promise<never>((resolve, reject) => {
            void resolve;
            abort = () => reject(signal.reason ?? abortError('Overlay gesture was aborted.'));
            signal.addEventListener('abort', abort, { once: true });
        });
        try {
            await Promise.race([gesture.completion, aborted]);
        } finally {
            signal.removeEventListener('abort', abort);
        }
    }

    private createMutationContext(
        transaction: DocumentMutationContext,
        action: OverlayMutationAction,
        targets: readonly IndexedOverlay[],
    ): OverlayMutationContext {
        return Object.freeze({
            transaction,
            action,
            objectIds: Object.freeze(targets.map((entry) => entry.persistentId)),
        });
    }

    private createMutationDescriptor(
        id: string,
        operationId: string,
        action: OverlayMutationAction,
        targets: readonly IndexedOverlay[],
        metadata: Readonly<Record<string, unknown>>,
    ): OverlayMutationDescriptor {
        return Object.freeze({
            id,
            operationId,
            action,
            objectIds: Object.freeze(targets.map((entry) => entry.persistentId)),
            objectKinds: Object.freeze(targets.map((entry) => entry.kind.definition.id)),
            metadata,
        });
    }

    private async runInteractionPolicies(
        targets: readonly IndexedOverlay[],
        descriptor: OverlayMutationDescriptor,
        transaction: DocumentMutationContext,
        phase: OverlayInteractionContext['phase'],
    ): Promise<void> {
        for (const target of targets) {
            const policy = this.interactionPolicies.get(target.kind.definition.id);
            if (!policy) continue;
            const context: OverlayInteractionContext = Object.freeze({
                ...this.createMutationContext(transaction, descriptor.action, targets),
                descriptor,
                phase,
            });
            try {
                if (phase === 'preview') await policy.preview?.(target.object, context);
                else if (phase === 'synchronize') {
                    await policy.synchronize?.(target.object, context);
                } else {
                    await policy.validate?.(target.object, context);
                }
            } catch (error) {
                if (error instanceof OverlayRecoverableObjectError) {
                    this.host.reportWarning(
                        error,
                        `A recoverable overlay ${phase} failure was isolated for "${target.persistentId}".`,
                    );
                    continue;
                }
                throw error;
            }
        }
    }

    private async validateMutation(
        targets: readonly IndexedOverlay[],
        descriptor: OverlayMutationDescriptor,
        transaction: DocumentMutationContext,
    ): Promise<void> {
        this.rebuildIndex();
        const canvas = this.host.requireCanvas('validate an overlay mutation');
        const liveObjects = new Set(canvas.getObjects());
        if (new Set(descriptor.objectIds).size !== descriptor.objectIds.length) {
            throw new CoreRuntimeError('[ImageEditor] Overlay mutation contains duplicate ids.');
        }
        for (const target of targets) {
            const currentId = target.kind.definition.getPersistentId(target.object);
            if (currentId !== target.persistentId) {
                throw new CoreRuntimeError(
                    `[ImageEditor] Overlay "${target.persistentId}" changed persistent identity.`,
                );
            }
            if (
                descriptor.action !== 'delete' &&
                (!liveObjects.has(target.object) ||
                    this.byId.get(target.persistentId)?.object !== target.object)
            ) {
                throw new CoreRuntimeError(
                    `[ImageEditor] Overlay "${target.persistentId}" is missing from the committed index.`,
                );
            }
        }
        const selection = this.getSelection();
        if (selection.ids.some((id) => !this.byId.has(id))) {
            canvas.discardActiveObject();
            this.emitSelection();
        }
        await this.runInteractionPolicies(targets, descriptor, transaction, 'validate');
    }

    private resolveOverlayTargets(target: FabricNS.FabricObject): readonly IndexedOverlay[] {
        const direct = this.byObject.get(target);
        if (direct) return Object.freeze([direct]);
        const grouped = target as FabricNS.FabricObject & {
            getObjects?: () => FabricNS.FabricObject[];
        };
        if (typeof grouped.getObjects !== 'function') return Object.freeze([]);
        return this.resolveOverlayObjects(grouped.getObjects());
    }

    private resolveOverlayObjects(
        objects: readonly FabricNS.FabricObject[],
    ): readonly IndexedOverlay[] {
        const targets: IndexedOverlay[] = [];
        const ids = new Set<string>();
        for (const object of objects) {
            const indexed = this.byObject.get(object);
            if (!indexed || ids.has(indexed.persistentId)) continue;
            ids.add(indexed.persistentId);
            targets.push(indexed);
        }
        return Object.freeze(targets);
    }

    private resolveOverlayIds(ids: readonly string[]): readonly IndexedOverlay[] {
        return Object.freeze([...new Set(ids)].map((id) => this.requireIndexed(id)));
    }

    private mergeTargets(
        first: readonly IndexedOverlay[],
        second: readonly IndexedOverlay[],
    ): readonly IndexedOverlay[] {
        const merged = new Map<string, IndexedOverlay>();
        for (const target of [...first, ...second]) merged.set(target.persistentId, target);
        return Object.freeze([...merged.values()]);
    }

    private applyHidden(id: string, hidden: boolean): void {
        const indexed = this.requireIndexed(id);
        const object = indexed.object;
        const preview = indexed.preview;
        const marked = object as MarkedOverlayObject;
        marked.editorOverlayHidden = hidden;
        if (indexed.kind.definition.setHidden) {
            indexed.kind.definition.setHidden(object, hidden);
        } else {
            object.set({ visible: !hidden });
        }
        if (preview) {
            preview[0] = !hidden;
            preview[1] = hidden;
            object.visible = false;
        }
        if (
            hidden &&
            getActiveCanvasObjects(this.host.requireCanvas('hide an overlay')).includes(object)
        ) {
            this.discardSelection();
        }
    }

    private applyLocked(id: string, locked: boolean): void {
        const indexed = this.requireIndexed(id);
        const marked = indexed.object as MarkedOverlayObject;
        marked.editorOverlayLocked = locked;
        if (indexed.kind.definition.setLocked) {
            indexed.kind.definition.setLocked(indexed.object, locked);
        } else {
            indexed.object.set({ selectable: !locked, evented: !locked });
        }
        if (
            locked &&
            getActiveCanvasObjects(this.host.requireCanvas('lock an overlay')).includes(
                indexed.object,
            )
        ) {
            this.discardSelection();
        }
    }

    private mutateLayer(id: string, direction: string, mutate: () => void): Promise<void> {
        return this.mutate({
            id: this.nextMutationId('layer'),
            operationId: 'overlay:layer',
            action: 'layer',
            objectIds: [id],
            metadata: Object.freeze({ direction }),
            mutate,
        });
    }

    private nextMutationId(action: string): string {
        return `overlay:${action}:${Date.now()}:${++this.generatedIdSequence}`;
    }

    private async prepareGeometry(
        mutation: GeometryMutationDescriptor,
    ): Promise<PreparedOverlayGeometry> {
        const canvas = this.host.requireCanvas('prepare overlay geometry');
        for (const policy of this.policies.values()) {
            if (!policy.supports || policy.supports(mutation)) await policy.prepare?.(mutation);
        }
        const selectionIds = this.getSelection().ids;
        canvas.discardActiveObject();
        const entries = this.indexedCanvasObjects().map((object) => {
            const indexed = this.byObject.get(object)!;
            return Object.freeze({
                object,
                persistentId: indexed.persistentId,
                kind: indexed.kind.definition.id,
                transform: captureTransform(object),
            });
        });
        return Object.freeze({ entries: Object.freeze(entries), selectionIds });
    }

    private async applyGeometry(
        mutation: Parameters<GeometryMutationPort['run']>[0] extends never
            ? never
            : GeometryMutationDescriptor,
        prepared: PreparedOverlayGeometry,
        context: GeometryParticipantContext,
    ): Promise<void> {
        if (mutation.kind === 'flatten') return;
        const delta = mutation.kind === 'crop' ? null : (mutation.affineDelta as number[] | null);
        for (const entry of prepared.entries) {
            const policy = this.policies.get(entry.kind);
            if (policy?.supports && !policy.supports(mutation)) continue;
            try {
                if (policy?.apply) {
                    await policy.apply(entry.object, mutation);
                } else if (delta) {
                    applyDeltaToObject(entry.object, delta, {
                        fabricUtil: this.createFabricUtilAccess(),
                        preserveReadableText: policy?.preserveReadable === true,
                    });
                }
            } catch (error) {
                context.warnRecoverable(error, entry.persistentId, entry.kind);
            }
        }
    }

    private async synchronizeGeometry(mutation: GeometryMutationDescriptor): Promise<void> {
        for (const policy of this.policies.values()) {
            if (!policy.supports || policy.supports(mutation)) await policy.synchronize?.(mutation);
        }
        this.rebuildIndex();
    }

    private rollbackGeometry(prepared: PreparedOverlayGeometry): void {
        const canvas = this.host.getCanvas();
        if (!canvas) return;
        for (let index = prepared.entries.length - 1; index >= 0; index -= 1) {
            const entry = prepared.entries[index]!;
            if (!canvas.getObjects().includes(entry.object)) canvas.add(entry.object);
            entry.object.set(entry.transform);
            entry.object.setCoords();
        }
        this.rebuildIndex();
        this.applySelection(prepared.selectionIds);
    }

    private async renderExport(
        targetCanvas: FabricNS.StaticCanvas,
        options: Readonly<CoreExportOptions>,
    ): Promise<void> {
        this.setPreviewObjectsHidden(false);
        try {
            const overlayOptions = parseExportOptions(options.contributors?.[OVERLAY_STATE_ID]);
            const included = overlayOptions.includeKinds
                ? new Set(overlayOptions.includeKinds)
                : null;
            const excluded = overlayOptions.excludeKinds
                ? new Set(overlayOptions.excludeKinds)
                : null;
            const objects = this.indexedCanvasObjects().filter((object) => {
                const indexed = this.byObject.get(object)!;
                const classification = this.classificationFor(indexed);
                if (included && !included.has(classification.kind)) return false;
                if (excluded?.has(classification.kind)) return false;
                return !classification.hidden || overlayOptions.includeHidden;
            });
            await this.renderObjects(targetCanvas, objects, options);
        } finally {
            this.setPreviewObjectsHidden(true);
        }
    }

    private async renderObjects(
        targetCanvas: FabricNS.StaticCanvas,
        objects: readonly FabricNS.FabricObject[],
        options: Readonly<CoreExportOptions>,
    ): Promise<void> {
        for (const object of objects) {
            const indexed = this.byObject.get(object);
            if (!indexed) continue;
            const classification = this.classificationFor(indexed);
            const renderer = this.renderers.get(classification.kind);
            if (renderer) {
                await renderer.render({ source: object, targetCanvas, options });
            } else {
                const clone = await object.clone();
                clone.set({ visible: true });
                targetCanvas.add(clone);
            }
        }
    }

    private indexObject(object: FabricNS.FabricObject): void {
        if (this.byObject.has(object)) return;
        const records = [...this.kinds.values()].sort(
            (left, right) => left.registrationOrder - right.registrationOrder,
        );
        for (const kind of records) {
            let matches = false;
            try {
                matches = kind.definition.classify(object);
            } catch (error) {
                this.host.reportWarning(
                    error,
                    `Overlay kind predicate "${kind.definition.id}" failed.`,
                );
            }
            if (!matches) continue;
            let persistentId = kind.definition.getPersistentId(object);
            if (!persistentId && kind.definition.setPersistentId) {
                persistentId = this.generatePersistentId(kind.definition.id);
                kind.definition.setPersistentId(object, persistentId);
            }
            if (!persistentId || !OVERLAY_ID_PATTERN.test(persistentId)) {
                this.host.reportWarning(
                    new Error('Malformed persistent overlay id.'),
                    `Overlay kind "${kind.definition.id}" produced an invalid persistent id.`,
                );
                return;
            }
            const duplicate = this.byId.get(persistentId);
            if (duplicate && duplicate.object !== object) {
                this.host.reportWarning(
                    new Error(`Duplicate overlay id: ${persistentId}`),
                    `Overlay "${persistentId}" was not indexed because its id is already in use.`,
                );
                return;
            }
            const indexed: IndexedOverlay = { object, kind, persistentId };
            this.byId.set(persistentId, indexed);
            this.byObject.set(object, indexed);
            const marked = object as MarkedOverlayObject;
            marked.editorOverlayKind = kind.definition.id;
            marked.editorOverlayId = persistentId;
            return;
        }
    }

    private unindexObject(object: FabricNS.FabricObject): void {
        const indexed = this.byObject.get(object);
        if (!indexed) return;
        if (this.byId.get(indexed.persistentId) === indexed) this.byId.delete(indexed.persistentId);
        this.byObject.delete(object);
    }

    private rebuildIndex(): void {
        const canvas = this.host.getCanvas();
        if (!canvas) return;
        const live = new Set(canvas.getObjects());
        for (const indexed of [...this.byId.values()]) {
            if (!live.has(indexed.object)) this.unindexObject(indexed.object);
        }
        for (const object of canvas.getObjects()) this.indexObject(object);
    }

    private classificationFor(indexed: IndexedOverlay): OverlayClassification {
        const definition = indexed.kind.definition;
        const marked = indexed.object as MarkedOverlayObject;
        const preview = indexed.preview;
        const hidden = preview
            ? preview[1]
            : definition.isHidden
              ? definition.isHidden(indexed.object)
              : marked.editorOverlayHidden === true || indexed.object.visible === false;
        return Object.freeze({
            kind: definition.id,
            persistentId: indexed.persistentId,
            ownerPluginId: definition.ownerPluginId,
            hidden,
            locked: definition.isLocked
                ? definition.isLocked(indexed.object)
                : marked.editorOverlayLocked === true,
        });
    }

    private indexedCanvasObjects(): FabricNS.FabricObject[] {
        const canvas = this.host.requireCanvas('inspect overlay order');
        return canvas.getObjects().filter((object) => this.byObject.has(object));
    }

    private setPreviewObjectsHidden(hidden: boolean): void {
        for (const target of this.byId.values()) {
            if (target.preview) {
                target.object.visible = hidden ? false : target.preview[0];
            }
        }
    }

    private moveRelative(id: string, delta: number): void {
        const overlays = this.indexedCanvasObjects();
        const current = overlays.indexOf(this.requireIndexed(id).object);
        this.moveToOverlayIndex(
            id,
            Math.max(0, Math.min(overlays.length - 1, current + delta)),
            overlays,
        );
    }

    private moveToOverlayIndex(
        id: string,
        target: number,
        overlays: FabricNS.FabricObject[],
    ): void {
        if (overlays.length === 0) return;
        const canvas = this.host.requireCanvas('change overlay layer');
        const object = this.requireIndexed(id).object;
        const targetObject = overlays[Math.max(0, Math.min(overlays.length - 1, target))]!;
        const targetCanvasIndex = canvas.getObjects().indexOf(targetObject);
        const movableCanvas = canvas as FabricNS.Canvas & {
            moveObjectTo?: (candidate: FabricNS.FabricObject, index: number) => boolean;
        };
        if (movableCanvas.moveObjectTo) {
            movableCanvas.moveObjectTo(object, targetCanvasIndex);
        } else {
            canvas.remove(object);
            canvas.insertAt(targetCanvasIndex, object);
        }
        this.host.requestRender();
    }

    private requireIndexed(id: string): IndexedOverlay {
        this.assertActive('access an overlay');
        const indexed = this.byId.get(id);
        if (!indexed) throw new CoreRuntimeError(`[ImageEditor] Overlay "${id}" was not found.`);
        return indexed;
    }

    private requireKindOwner(kindId: string, ownerPluginId: string): void {
        const kind = this.kinds.get(kindId);
        if (!kind)
            throw new CoreRuntimeError(`[ImageEditor] Overlay kind "${kindId}" is not registered.`);
        if (kind.definition.ownerPluginId !== ownerPluginId) {
            throw new CoreRuntimeError(
                `[ImageEditor] Overlay kind "${kindId}" belongs to "${kind.definition.ownerPluginId}", not "${ownerPluginId}".`,
            );
        }
    }

    private emitSelection(): void {
        if (this.disposed) return;
        const selection = this.getSelection();
        for (const listener of [...this.selectionListeners]) {
            try {
                listener(selection);
            } catch (error) {
                this.host.reportWarning(error, 'Overlay selection listener failed.');
            }
        }
    }

    private generatePersistentId(kind: string): string {
        const randomId = globalThis.crypto?.randomUUID?.();
        return randomId
            ? `${kind}:${randomId}`
            : `${kind}:${Date.now().toString(36)}:${++this.generatedIdSequence}`;
    }

    private createFabricUtilAccess(): FabricUtilAccess {
        return {
            multiplyTransformMatrices: (left, right) =>
                this.host.fabric.util.multiplyTransformMatrices(
                    left as FabricNS.TMat2D,
                    right as FabricNS.TMat2D,
                ),
            invertTransform: (matrix) =>
                this.host.fabric.util.invertTransform(matrix as FabricNS.TMat2D),
            qrDecompose: (matrix) => this.host.fabric.util.qrDecompose(matrix as FabricNS.TMat2D),
            Point: this.host.fabric.Point,
        };
    }

    private assertRuntimeIdentifier(value: string, label: string): void {
        if (!isRuntimeIdentifier(value)) {
            throw new CoreRuntimeError(`[ImageEditor] Invalid ${label} Runtime ID.`);
        }
    }

    private assertOpaqueIdentifier(value: string, label: string): void {
        if (!OVERLAY_ID_PATTERN.test(value)) {
            throw new CoreRuntimeError(
                `[ImageEditor] ${label} must be a safe identifier no longer than 128 characters.`,
            );
        }
    }

    private assertActive(operation: string): void {
        if (this.disposed)
            throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} after disposal.`);
    }
}
