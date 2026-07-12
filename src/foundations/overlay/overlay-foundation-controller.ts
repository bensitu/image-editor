import type * as FabricNS from 'fabric';

import { CoreRuntimeError } from '../../core-runtime/errors.js';
import type { GeometryMutationCoordinator } from '../../core-runtime/geometry/index.js';
import type {
    CoreExportPort,
    CoreHostPort,
    CoreStatePort,
} from '../../core-runtime/internal-capabilities.js';
import {
    createDisposable,
    disposeInReverseSync,
    type Disposable,
} from '../../plugin-kernel/index.js';
import { applyDeltaToObject, type FabricUtilAccess } from './overlay-transform-delta.js';
import type {
    FlattenOptions,
    OverlayClassification,
    OverlayExportOptions,
    OverlayExportRenderer,
    OverlayFoundationApi,
    OverlayGeometryPolicy,
    OverlayKindDefinition,
    OverlayQuery,
    OverlaySelectionState,
    OverlaySerializer,
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

const OVERLAY_STATE_ID = 'foundation.overlay';
const OVERLAY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
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
        Object.prototype.hasOwnProperty.call(value, 'data')
    );
}

function validateState(value: unknown): value is OverlayFoundationState {
    return (
        isRecord(value) &&
        value.version === 1 &&
        Array.isArray(value.overlays) &&
        value.overlays.length <= 100_000 &&
        value.overlays.every(isSerializedRecord) &&
        new Set(value.overlays.map((record) => record.persistentId)).size ===
            value.overlays.length &&
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
    private readonly serializers = new Map<string, OverlaySerializer>();
    private readonly renderers = new Map<string, OverlayExportRenderer>();
    private readonly byId = new Map<string, IndexedOverlay>();
    private readonly byObject = new WeakMap<FabricNS.FabricObject, IndexedOverlay>();
    private readonly selectionListeners = new Set<(state: OverlaySelectionState) => void>();
    private readonly registrations: Disposable[] = [];
    private preservedRecords: SerializedOverlayRecord[] = [];
    private registrationSequence = 0;
    private generatedIdSequence = 0;
    private attached = false;
    private disposed = false;

    private readonly onObjectAdded = (event: { target?: FabricNS.FabricObject }): void => {
        if (event.target) this.indexObject(event.target);
    };

    private readonly onObjectRemoved = (event: { target?: FabricNS.FabricObject }): void => {
        if (event.target) this.unindexObject(event.target);
    };

    private readonly onSelectionChanged = (): void => this.emitSelection();

    constructor(
        private readonly host: CoreHostPort,
        private readonly state: CoreStatePort,
        private readonly geometry: GeometryMutationCoordinator,
        exportPort: CoreExportPort,
    ) {
        try {
            this.registrations.push(
                state.objectProperties.register({
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
                state.externalObjects.register(
                    OVERLAY_STATE_ID,
                    (object) =>
                        typeof (object as MarkedOverlayObject).editorOverlayKind === 'string',
                ),
            );
            this.registrations.push(
                state.slices.register({
                    id: OVERLAY_STATE_ID,
                    version: 1,
                    capture: () => this.captureState(),
                    validate: (value) =>
                        validateState(value)
                            ? { valid: true, value }
                            : { valid: false, message: 'Overlay Foundation state is malformed.' },
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
                        this.applyGeometry(
                            mutation,
                            prepared as readonly PreparedOverlay[],
                            context,
                        ),
                    synchronize: (mutation) => this.synchronizeGeometry(mutation),
                    rollback: (mutation, prepared) => {
                        void mutation;
                        this.rollbackGeometry(prepared as readonly PreparedOverlay[]);
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
            canvas.on('selection:created', this.onSelectionChanged);
            canvas.on('selection:updated', this.onSelectionChanged);
            canvas.on('selection:cleared', this.onSelectionChanged);
        }
        this.attached = true;
        this.rebuildIndex();
    }

    registerKind(definition: OverlayKindDefinition): Disposable {
        this.assertActive('register an overlay kind');
        this.assertIdentifier(definition.id, 'Overlay kind id');
        this.assertIdentifier(definition.ownerPluginId, 'Overlay kind owner');
        const existing = this.kinds.get(definition.id);
        if (existing) {
            throw new CoreRuntimeError(
                `[ImageEditor] Overlay kind "${definition.id}" is already registered by "${existing.definition.ownerPluginId}".`,
            );
        }
        const record: KindRecord = {
            definition: Object.freeze({ ...definition }),
            registrationOrder: this.registrationSequence++,
        };
        this.kinds.set(definition.id, record);
        this.rebuildIndex();
        return createDisposable(() => {
            if (this.kinds.get(definition.id) !== record) return;
            this.kinds.delete(definition.id);
            for (const indexed of [...this.byId.values()]) {
                if (indexed.kind === record) this.unindexObject(indexed.object);
            }
            this.rebuildIndex();
        });
    }

    registerGeometryPolicy(policy: OverlayGeometryPolicy): Disposable {
        this.assertActive('register an overlay geometry policy');
        this.assertIdentifier(policy.id, 'Overlay geometry policy id');
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

    registerSerializer(serializer: OverlaySerializer): Disposable {
        this.assertActive('register an overlay serializer');
        this.assertIdentifier(serializer.id, 'Overlay serializer id');
        this.requireKindOwner(serializer.kind, serializer.ownerPluginId);
        if (this.serializers.has(serializer.kind)) {
            throw new CoreRuntimeError(
                `[ImageEditor] Overlay kind "${serializer.kind}" already has a serializer.`,
            );
        }
        const frozen = Object.freeze({ ...serializer });
        this.serializers.set(serializer.kind, frozen);
        return createDisposable(() => {
            if (this.serializers.get(serializer.kind) === frozen)
                this.serializers.delete(serializer.kind);
        });
    }

    registerExportRenderer(renderer: OverlayExportRenderer): Disposable {
        this.assertActive('register an overlay export renderer');
        this.assertIdentifier(renderer.id, 'Overlay export renderer id');
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
        const canvas = this.host.requireCanvas('select overlays');
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

    setHidden(id: string, hidden: boolean): void {
        const indexed = this.requireIndexed(id);
        const marked = indexed.object as MarkedOverlayObject;
        marked.editorOverlayHidden = hidden;
        if (indexed.kind.definition.setHidden) {
            indexed.kind.definition.setHidden(indexed.object, hidden);
        } else {
            indexed.object.set({ visible: !hidden });
        }
        if (
            hidden &&
            getActiveCanvasObjects(this.host.requireCanvas('hide an overlay')).includes(
                indexed.object,
            )
        ) {
            this.discardSelection();
        }
        this.host.requestRender();
    }

    setLocked(id: string, locked: boolean): void {
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
        this.host.requestRender();
    }

    bringForward(id: string): void {
        this.moveRelative(id, 1);
    }

    sendBackward(id: string): void {
        this.moveRelative(id, -1);
    }

    bringToFront(id: string): void {
        const overlays = this.indexedCanvasObjects();
        this.moveToOverlayIndex(id, overlays.length - 1, overlays);
    }

    sendToBack(id: string): void {
        this.moveToOverlayIndex(id, 0, this.indexedCanvasObjects());
    }

    async flatten(query: OverlayQuery = {}, options: FlattenOptions = {}): Promise<void> {
        this.assertActive('flatten overlays');
        const selected = this.list({ ...query, includeHidden: false, includeLocked: true });
        if (selected.length === 0) return;
        await this.geometry.run({
            id: `overlay:flatten:${Date.now()}:${++this.generatedIdSequence}`,
            kind: 'flatten',
            operationId: 'overlay:flatten',
            metadata: Object.freeze({ overlayCount: selected.length }),
            mutateBase: async () => {
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
                    backgroundColor: this.host.options.backgroundColor,
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
                    this.host.replaceBaseImage(replacement, {
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
        const canvas = this.host.getCanvas();
        if (canvas && typeof canvas.off === 'function') {
            canvas.off('object:added', this.onObjectAdded);
            canvas.off('object:removed', this.onObjectRemoved);
            canvas.off('selection:created', this.onSelectionChanged);
            canvas.off('selection:updated', this.onSelectionChanged);
            canvas.off('selection:cleared', this.onSelectionChanged);
        }
        const registrationErrors = disposeInReverseSync(this.registrations, {
            pluginId: OVERLAY_STATE_ID,
        });
        this.registrations.length = 0;
        this.selectionListeners.clear();
        this.byId.clear();
        this.kinds.clear();
        this.policies.clear();
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
        const overlays: SerializedOverlayRecord[] = [];
        for (const object of this.indexedCanvasObjects()) {
            const indexed = this.byObject.get(object)!;
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
    }

    private async restoreState(value: OverlayFoundationState): Promise<void> {
        const canvas = this.host.requireCanvas('restore Overlay Foundation state');
        canvas.discardActiveObject();
        for (const indexed of [...this.byId.values()]) canvas.remove(indexed.object);
        this.byId.clear();
        this.preservedRecords = [];
        for (const record of value.overlays) {
            const serializer = this.serializers.get(record.kind);
            const kind = this.kinds.get(record.kind);
            if (!serializer || !kind) {
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
            this.setHidden(record.persistentId, record.hidden);
            this.setLocked(record.persistentId, record.locked);
        }
        this.rebuildIndex();
        const restoredSelection = value.selectionIds.filter((persistentId) =>
            this.byId.has(persistentId),
        );
        if (restoredSelection.length > 0) this.select(restoredSelection);
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

    private async prepareGeometry(
        mutation: import('../../core-runtime/geometry/index.js').GeometryMutationDescriptor,
    ): Promise<readonly PreparedOverlay[]> {
        const canvas = this.host.requireCanvas('prepare overlay geometry');
        for (const policy of this.policies.values()) {
            if (!policy.supports || policy.supports(mutation)) await policy.prepare?.(mutation);
        }
        canvas.discardActiveObject();
        return Object.freeze(
            this.indexedCanvasObjects().map((object) => {
                const indexed = this.byObject.get(object)!;
                return Object.freeze({
                    object,
                    persistentId: indexed.persistentId,
                    kind: indexed.kind.definition.id,
                    transform: captureTransform(object),
                });
            }),
        );
    }

    private async applyGeometry(
        mutation: Parameters<GeometryMutationCoordinator['run']>[0] extends never
            ? never
            : import('../../core-runtime/geometry/index.js').GeometryMutationDescriptor,
        prepared: readonly PreparedOverlay[],
        context: import('../../core-runtime/geometry/index.js').GeometryParticipantContext,
    ): Promise<void> {
        if (mutation.kind === 'flatten') return;
        const delta = mutation.affineDelta ? [...mutation.affineDelta] : null;
        for (const entry of prepared) {
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

    private async synchronizeGeometry(
        mutation: import('../../core-runtime/geometry/index.js').GeometryMutationDescriptor,
    ): Promise<void> {
        for (const policy of this.policies.values()) {
            if (!policy.supports || policy.supports(mutation)) await policy.synchronize?.(mutation);
        }
        this.rebuildIndex();
    }

    private rollbackGeometry(prepared: readonly PreparedOverlay[]): void {
        const canvas = this.host.getCanvas();
        if (!canvas) return;
        for (let index = prepared.length - 1; index >= 0; index -= 1) {
            const entry = prepared[index]!;
            if (!canvas.getObjects().includes(entry.object)) canvas.add(entry.object);
            entry.object.set(entry.transform);
            entry.object.setCoords();
        }
        this.rebuildIndex();
    }

    private async renderExport(
        targetCanvas: FabricNS.StaticCanvas,
        options: Readonly<import('../../core-runtime/public-types.js').CoreExportOptions>,
    ): Promise<void> {
        const overlayOptions = parseExportOptions(options.contributors?.[OVERLAY_STATE_ID]);
        const included = overlayOptions.includeKinds ? new Set(overlayOptions.includeKinds) : null;
        const excluded = overlayOptions.excludeKinds ? new Set(overlayOptions.excludeKinds) : null;
        const objects = this.indexedCanvasObjects().filter((object) => {
            const indexed = this.byObject.get(object)!;
            const classification = this.classificationFor(indexed);
            if (included && !included.has(classification.kind)) return false;
            if (excluded?.has(classification.kind)) return false;
            return !classification.hidden || overlayOptions.includeHidden;
        });
        await this.renderObjects(targetCanvas, objects, options);
    }

    private async renderObjects(
        targetCanvas: FabricNS.StaticCanvas,
        objects: readonly FabricNS.FabricObject[],
        options: Readonly<import('../../core-runtime/public-types.js').CoreExportOptions>,
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
        return Object.freeze({
            kind: definition.id,
            persistentId: indexed.persistentId,
            ownerPluginId: definition.ownerPluginId,
            hidden: definition.isHidden
                ? definition.isHidden(indexed.object)
                : marked.editorOverlayHidden === true || indexed.object.visible === false,
            locked: definition.isLocked
                ? definition.isLocked(indexed.object)
                : marked.editorOverlayLocked === true,
        });
    }

    private indexedCanvasObjects(): FabricNS.FabricObject[] {
        const canvas = this.host.requireCanvas('inspect overlay order');
        return canvas.getObjects().filter((object) => this.byObject.has(object));
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

    private assertIdentifier(value: string, label: string): void {
        if (value.trim().length === 0 || value.trim() !== value) {
            throw new CoreRuntimeError(`[ImageEditor] ${label} must be non-empty and trimmed.`);
        }
    }

    private assertActive(operation: string): void {
        if (this.disposed)
            throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} after disposal.`);
    }
}
