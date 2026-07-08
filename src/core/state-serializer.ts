/**
 * Serializer for the editor's history-and-restore snapshot
 * wire format. Owns `saveState` and `loadFromState` so the
 * serialization format and the position-based metadata restorer
 * live in a single module.
 *
 * ## Owned contracts
 *
 * - `saveState` SHALL serialize the canvas via
 *   `canvas.toJSON([...customKeys])` including the custom keys
 *   `maskId`, `maskUid`, `maskName`, `isCropRect`, `maskLabel`, and `originalAlpha`.
 *   Crop rectangles (`isCropRect === true`) and mask labels
 *   (`maskLabel === true`) are filtered out before the snapshot is
 *   pushed to history — they are session-only objects.
 * - Every snapshot SHALL embed an `_editorState`
 *   object containing `currentScale`, `currentRotation`, and
 *   `baseImageScale` so undo/redo can fully restore editor metadata.
 *   When a single mask is active, `_editorState.activeMaskId` records
 *   that mask so the facade can rebuild the transient label/list
 *   selection after `loadFromState`.
 * - Falsy style values such as `strokeWidth: 0`
 *   or `hasControls: false` reach the snapshot unchanged because Fabric's
 *   `toJSON` preserves them and this module performs no defaulting on
 *   the per-object payload.
 * - Any active Fabric `ActiveSelection` is
 *   discarded before serialization so the multi-object selection wrapper
 *   never leaks into history.
 * - The serialized form is the JSON snapshot
 *   string consumed by `loadFromState`, providing the round-trip
 *   property `loadFromState(saveState(S)) ≈ S`.
 *
 * The pre-snapshot label-hide step and the post-snapshot label-restore
 * step live in `mask/mask-label-manager.ts`; the `ImageEditor` facade
 * brackets the call to {@link saveState} with those helpers so labels
 * (which are session-only `maskLabel === true` objects) never appear in
 * the serialized payload even if they happen to be on the canvas.
 *
 * Owner module references (per the documented "Mapping Contracts to
 * modules" table): this module is imported by `image-editor.ts`,
 * `crop/crop-controller.ts`, and `export/export-service.ts`. It is
 * intentionally NOT re-exported from `src/index.ts`.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import type {
    AnnotationObject,
    BaseImageObject,
    ImageMimeType,
    MaskObject,
    ResolvedImageFilterConfig,
} from './public-types.js';
import { isAnnotationObject, isBaseImageObject, isMaskObject } from './public-types.js';
import { markAnnotationObject, markBaseImageObject, markMaskObject } from './editor-object-kind.js';
import { StateRestoreError } from './errors.js';
import {
    cloneResolvedImageFilterConfig,
    DEFAULT_IMAGE_FILTER_CONFIG,
    hasActiveImageFilters,
    normalizeImageFilterConfigSnapshot,
} from './image-filter-config.js';
import { isSupportedImageDataUrl } from '../utils/file.js';

const DEFAULT_MAX_RESTORE_CANVAS_PIXELS = 50000000;
const DEFAULT_MAX_RESTORE_CANVAS_DIMENSION = 16384;
const DEFAULT_MAX_SNAPSHOT_BYTES = 50 * 1024 * 1024;
const DEFAULT_MAX_SNAPSHOT_OBJECTS = 5000;
const DEFAULT_MAX_PUBLIC_RESTORE_NESTING_DEPTH = 100;
const PUBLIC_RESTORE_IMAGE_SOURCE_KEYS = new Set(['src', 'source']);
const PUBLIC_RESTORE_FABRIC_OBJECT_KEYS = new Set(['clipPath', 'backgroundImage', 'overlayImage']);
const PUBLIC_RESTORE_FABRIC_OBJECT_ARRAY_KEYS = new Set(['objects']);
const ALLOWED_PUBLIC_RESTORE_OBJECT_TYPES = new Set([
    'circle',
    'ellipse',
    'image',
    'line',
    'path',
    'polygon',
    'polyline',
    'rect',
    'text',
    'textbox',
]);

// ─── Snapshot wire format ────────────────────────────────────────────────────

/**
 * Per-object payload inside a {@link CanvasJson} snapshot.
 *
 * The `isCropRect` and `maskLabel` markers are filtered out by
 * {@link saveState}, so a snapshot pushed to history will never contain
 * them — they are listed here purely for the live-canvas pre-filter
 * type. Custom mask metadata (`maskId`, `maskName`, `originalAlpha`) is
 * carried through verbatim.
 */
export interface CanvasJsonObject {
    /** Fabric shape type discriminator (`'rect'`, `'circle'`, `'image'`, etc.). */
    type?: string;
    /** Editor-owned object discriminator. */
    editorObjectKind?: string;
    /** Session object subtype discriminator. */
    sessionObjectType?: string;
    /** Left-edge pixel coordinate (Fabric serializes `originX: 'left'` masks here). */
    left?: number;
    /** Top-edge pixel coordinate. */
    top?: number;
    /** Fabric rotation in degrees. */
    angle?: number;
    /** Fabric horizontal scale. */
    scaleX?: number;
    /** Fabric vertical scale. */
    scaleY?: number;
    /** Stable mask identifier. */
    maskId?: number;
    /** Stable internal mask identifier used for deterministic restore. */
    maskUid?: string;
    /** Mask family name passed through `MaskConfig.name`. */
    maskName?: string;
    /** Pre-crop alpha cached so `cancelCrop` can restore it. */
    originalAlpha?: number;
    /** Stroke captured before transient hover or selection styling. */
    originalStroke?: unknown;
    /** Stroke width captured before transient hover or selection styling. */
    originalStrokeWidth?: number;
    /** Fabric control visibility flag. */
    hasControls?: boolean;
    /** Fabric selection flag. */
    selectable?: boolean;
    /** Fabric uniform stroke scaling flag. */
    strokeUniform?: boolean;
    /** Fabric rotation lock flag. */
    lockRotation?: boolean;
    /** Fabric transparent corner control flag. */
    transparentCorners?: boolean;
    /** Fabric selection border color. */
    borderColor?: string;
    /** Fabric corner control color. */
    cornerColor?: string;
    /** Fabric corner control size. */
    cornerSize?: number;
    /** Fabric horizontal flip flag. */
    flipX?: boolean;
    /** Fabric vertical flip flag. */
    flipY?: boolean;
    /** Marks the transient crop rectangle; filtered before history push. */
    isCropRect?: boolean;
    /** Marks a mask label text object; filtered before history push. */
    maskLabel?: boolean;
    /** Marks Mosaic preview objects; filtered before history push. */
    isMosaicPreview?: boolean;
    /** Annotation identifier. */
    annotationId?: number;
    /** Annotation subtype. */
    annotationType?: string;
    /** Shape annotation primitive subtype. */
    shapeAnnotationKind?: string;
    /** Annotation display name. */
    annotationName?: string;
    /** Business-level annotation visibility. */
    annotationHidden?: boolean;
    /** Business-level annotation lock state. */
    annotationLocked?: boolean;
    /** Base selectable intent restored when an annotation is unlocked. */
    annotationSelectable?: boolean;
    /** Base evented intent restored when an annotation is unlocked. */
    annotationEvented?: boolean;
    /** Base transform controls intent restored when an annotation is unlocked. */
    annotationHasControls?: boolean;
    /** Base text editability intent restored when a text annotation is unlocked. */
    annotationEditable?: boolean;
    /** Stable overlay-state ID carried across history restores. */
    overlayPersistentId?: string;
    /** JSON-compatible overlay metadata carried across history restores. */
    overlayMetadata?: unknown;
    /** Pass-through for every other Fabric-serialized shape property. */
    [key: string]: unknown;
}

/**
 * Editor-level metadata embedded into every snapshot so undo/redo can
 * restore not just the canvas objects but also the transform state that
 * the toolbar UI mirrors.
 */
export interface EditorStateMeta {
    /** Current zoom factor on the active image. */
    currentScale: number;
    /** Current rotation in degrees on the active image. */
    currentRotation: number;
    /** Base scale chosen by the layout manager when the image was loaded. */
    baseImageScale: number;
    /** MIME type of the currently committed image, when known. */
    currentImageMimeType?: ImageMimeType | null;
    /** Canonical editor-managed image filter config. */
    imageFilterConfig?: ResolvedImageFilterConfig;
    /** Active editor-owned object kind when the snapshot was captured, if any. */
    activeObjectKind?: 'mask' | 'annotation' | null;
    /** Mask selected when the snapshot was captured, if any. */
    activeMaskId?: number;
    /** Annotation selected when the snapshot was captured, if any. */
    activeAnnotationId?: number;
}

/**
 * Full snapshot envelope. Standard Fabric `toJSON` keys plus the editor
 * extension fields owned by this module.
 */
export interface CanvasJson {
    /** Fabric format version stamped by `canvas.toJSON`. */
    version?: string;
    /** Canvas pixel width — included by Fabric's `toJSON`. */
    width?: number;
    /** Canvas pixel height — included by Fabric's `toJSON`. */
    height?: number;
    /** Canvas CSS background — included by Fabric's `toJSON`. */
    background?: string;
    /** Per-object Fabric payloads, post-filter. */
    objects?: CanvasJsonObject[];
    /** Editor transform metadata. */
    _editorState?: EditorStateMeta;
    /** Pass-through for any other Fabric-emitted top-level keys. */
    [key: string]: unknown;
}

/**
 * The exact set of custom property names passed to `canvas.toJSON` so
 * Fabric serializes them onto each object. Frozen as a tuple so callers
 * cannot mutate the shared array.
 *
 */
export const SNAPSHOT_CUSTOM_KEYS = Object.freeze([
    'editorObjectKind',
    'sessionObjectType',
    'maskId',
    'maskUid',
    'maskName',
    'isCropRect',
    'maskLabel',
    'originalAlpha',
    'originalStroke',
    'originalStrokeWidth',
    'hasControls',
    'selectable',
    'strokeUniform',
    'lockRotation',
    'transparentCorners',
    'borderColor',
    'cornerColor',
    'cornerSize',
    'flipX',
    'flipY',
    'isMosaicPreview',
    'annotationId',
    'annotationType',
    'shapeAnnotationKind',
    'annotationName',
    'annotationHidden',
    'annotationLocked',
    'annotationSelectable',
    'annotationEvented',
    'annotationHasControls',
    'annotationEditable',
    'overlayPersistentId',
    'overlayMetadata',
] as const);

type SnapshotLiveObject = FabricNS.FabricObject &
    Partial<MaskObject> & {
        editorObjectKind?: string;
        sessionObjectType?: string;
        isCropRect?: boolean;
        maskLabel?: boolean;
        isMosaicPreview?: boolean;
        annotationId?: number;
        annotationType?: string;
        shapeAnnotationKind?: string;
        annotationName?: string;
        annotationHidden?: boolean;
        annotationLocked?: boolean;
        annotationSelectable?: boolean;
        annotationEvented?: boolean;
        annotationHasControls?: boolean;
        annotationEditable?: boolean;
        overlayPersistentId?: string;
        overlayMetadata?: unknown;
    };

function readFiniteNumber(value: unknown): number | null {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function serializedTypeMatches(
    liveObject: FabricNS.FabricObject,
    jsonObject: CanvasJsonObject,
): boolean {
    const jsonType = typeof jsonObject.type === 'string' ? jsonObject.type.toLowerCase() : '';
    const liveType = typeof liveObject.type === 'string' ? liveObject.type.toLowerCase() : '';
    return !jsonType || liveType === jsonType;
}

function serializedPositionMatches(
    liveObject: FabricNS.FabricObject,
    jsonObject: CanvasJsonObject,
): boolean {
    const jsonLeft = readFiniteNumber(jsonObject.left);
    const jsonTop = readFiniteNumber(jsonObject.top);
    if (jsonLeft === null || jsonTop === null) return true;
    return (
        Math.abs((liveObject.left ?? 0) - jsonLeft) < 0.5 &&
        Math.abs((liveObject.top ?? 0) - jsonTop) < 0.5
    );
}

function serializedNumberMatches(
    liveValue: unknown,
    jsonValue: unknown,
    fallback: number,
    tolerance: number,
): boolean {
    const jsonNumber = readFiniteNumber(jsonValue);
    if (jsonNumber === null) return true;
    const liveNumber = readFiniteNumber(liveValue) ?? fallback;
    return Math.abs(liveNumber - jsonNumber) < tolerance;
}

function serializedTransformMatches(
    liveObject: FabricNS.FabricObject,
    jsonObject: CanvasJsonObject,
): boolean {
    return (
        serializedNumberMatches(liveObject.angle, jsonObject.angle, 0, 0.5) &&
        serializedNumberMatches(liveObject.scaleX, jsonObject.scaleX, 1, 0.0001) &&
        serializedNumberMatches(liveObject.scaleY, jsonObject.scaleY, 1, 0.0001)
    );
}

function serializedObjectMatches(
    liveObject: FabricNS.FabricObject,
    jsonObject: CanvasJsonObject,
): boolean {
    const live = liveObject as SnapshotLiveObject;

    if (typeof jsonObject.maskUid === 'string' && typeof live.maskUid === 'string') {
        return live.maskUid === jsonObject.maskUid;
    }
    if (typeof jsonObject.maskId === 'number' && typeof live.maskId === 'number') {
        return live.maskId === jsonObject.maskId;
    }
    if (typeof jsonObject.annotationId === 'number' && typeof live.annotationId === 'number') {
        return live.annotationId === jsonObject.annotationId;
    }
    if (
        typeof jsonObject.sessionObjectType === 'string' &&
        typeof live.sessionObjectType === 'string'
    ) {
        return live.sessionObjectType === jsonObject.sessionObjectType;
    }
    if (
        typeof jsonObject.editorObjectKind === 'string' &&
        typeof live.editorObjectKind === 'string' &&
        live.editorObjectKind !== jsonObject.editorObjectKind
    ) {
        return false;
    }

    return (
        serializedTypeMatches(liveObject, jsonObject) &&
        serializedPositionMatches(liveObject, jsonObject) &&
        serializedTransformMatches(liveObject, jsonObject)
    );
}

function findCanvasObjectForJson(
    canvasObjects: FabricNS.FabricObject[],
    jsonObject: CanvasJsonObject,
    preferredIndex: number,
    consumedIndexes: Set<number>,
): { object: SnapshotLiveObject; index: number } | null {
    const preferred = canvasObjects[preferredIndex];
    if (
        preferred &&
        !consumedIndexes.has(preferredIndex) &&
        serializedObjectMatches(preferred, jsonObject)
    ) {
        consumedIndexes.add(preferredIndex);
        return { object: preferred as SnapshotLiveObject, index: preferredIndex };
    }

    const matchedIndex = canvasObjects.findIndex(
        (candidate, index) =>
            !consumedIndexes.has(index) && serializedObjectMatches(candidate, jsonObject),
    );
    if (matchedIndex < 0) return null;
    consumedIndexes.add(matchedIndex);
    return { object: canvasObjects[matchedIndex] as SnapshotLiveObject, index: matchedIndex };
}

/**
 * Fabric v7 does not consistently honor `propertiesToInclude` for
 * non-standard object fields across all builds. History cannot depend on
 * that behavior because mask identity and hover/selection style metadata are
 * editor-owned fields. After Fabric produces the base JSON payload, copy the
 * custom fields from the corresponding live object into the JSON object before
 * session-only filtering runs. Matching prefers stable IDs and falls back to
 * type/position because Fabric may reorder objects during serialization.
 */
function copySnapshotCustomPropsFromCanvas(
    canvasObjects: FabricNS.FabricObject[],
    jsonObjects: CanvasJsonObject[] | undefined,
): void {
    if (!Array.isArray(jsonObjects)) return;

    const consumedIndexes = new Set<number>();
    for (let index = 0; index < jsonObjects.length; index += 1) {
        const jsonObject = jsonObjects[index];
        if (!jsonObject) continue;

        const match = findCanvasObjectForJson(canvasObjects, jsonObject, index, consumedIndexes);
        if (!match) continue;
        const liveObject = match.object;

        if (typeof liveObject.editorObjectKind === 'string') {
            jsonObject.editorObjectKind = liveObject.editorObjectKind;
        }
        if (typeof liveObject.sessionObjectType === 'string') {
            jsonObject.sessionObjectType = liveObject.sessionObjectType;
        }
        if (typeof liveObject.maskId === 'number') jsonObject.maskId = liveObject.maskId;
        if (typeof liveObject.maskUid === 'string') jsonObject.maskUid = liveObject.maskUid;
        if (typeof liveObject.maskName === 'string') jsonObject.maskName = liveObject.maskName;
        if (typeof liveObject.originalAlpha === 'number') {
            jsonObject.originalAlpha = liveObject.originalAlpha;
        }
        if (liveObject.originalStroke !== undefined) {
            jsonObject.originalStroke = liveObject.originalStroke;
        }
        if (typeof liveObject.originalStrokeWidth === 'number') {
            jsonObject.originalStrokeWidth = liveObject.originalStrokeWidth;
        }
        if (typeof liveObject.hasControls === 'boolean') {
            jsonObject.hasControls = liveObject.hasControls;
        }
        if (typeof liveObject.selectable === 'boolean') {
            jsonObject.selectable = liveObject.selectable;
        }
        if (typeof liveObject.strokeUniform === 'boolean') {
            jsonObject.strokeUniform = liveObject.strokeUniform;
        }
        if (typeof liveObject.lockRotation === 'boolean') {
            jsonObject.lockRotation = liveObject.lockRotation;
        }
        if (typeof liveObject.transparentCorners === 'boolean') {
            jsonObject.transparentCorners = liveObject.transparentCorners;
        }
        if (typeof liveObject.borderColor === 'string') {
            jsonObject.borderColor = liveObject.borderColor;
        }
        if (typeof liveObject.cornerColor === 'string') {
            jsonObject.cornerColor = liveObject.cornerColor;
        }
        if (typeof liveObject.cornerSize === 'number') {
            jsonObject.cornerSize = liveObject.cornerSize;
        }
        if (typeof liveObject.flipX === 'boolean') {
            jsonObject.flipX = liveObject.flipX;
        }
        if (typeof liveObject.flipY === 'boolean') {
            jsonObject.flipY = liveObject.flipY;
        }
        if (liveObject.isCropRect === true) jsonObject.isCropRect = true;
        if (liveObject.maskLabel === true) jsonObject.maskLabel = true;
        if (liveObject.isMosaicPreview === true) jsonObject.isMosaicPreview = true;
        if (typeof liveObject.annotationId === 'number') {
            jsonObject.annotationId = liveObject.annotationId;
        }
        if (typeof liveObject.annotationType === 'string') {
            jsonObject.annotationType = liveObject.annotationType;
        }
        if (typeof liveObject.shapeAnnotationKind === 'string') {
            jsonObject.shapeAnnotationKind = liveObject.shapeAnnotationKind;
        }
        if (typeof liveObject.annotationName === 'string') {
            jsonObject.annotationName = liveObject.annotationName;
        }
        if (typeof liveObject.annotationHidden === 'boolean') {
            jsonObject.annotationHidden = liveObject.annotationHidden;
        }
        if (typeof liveObject.annotationLocked === 'boolean') {
            jsonObject.annotationLocked = liveObject.annotationLocked;
        }
        if (typeof liveObject.annotationSelectable === 'boolean') {
            jsonObject.annotationSelectable = liveObject.annotationSelectable;
        }
        if (typeof liveObject.annotationEvented === 'boolean') {
            jsonObject.annotationEvented = liveObject.annotationEvented;
        }
        if (typeof liveObject.annotationHasControls === 'boolean') {
            jsonObject.annotationHasControls = liveObject.annotationHasControls;
        }
        if (typeof liveObject.annotationEditable === 'boolean') {
            jsonObject.annotationEditable = liveObject.annotationEditable;
        }
        if (typeof liveObject.overlayPersistentId === 'string') {
            jsonObject.overlayPersistentId = liveObject.overlayPersistentId;
        }
        if (liveObject.overlayMetadata !== undefined) {
            jsonObject.overlayMetadata = liveObject.overlayMetadata;
        }
    }
}

function isActiveSelectionObject(object: FabricNS.FabricObject | null | undefined): boolean {
    if (!object) return false;

    const type = typeof object.type === 'string' ? object.type.toLowerCase() : '';
    if (type === 'activeselection') return true;

    const isType = (object as { isType?: (...types: string[]) => boolean }).isType;
    return (
        typeof isType === 'function' &&
        (isType.call(object, 'ActiveSelection') || isType.call(object, 'activeSelection'))
    );
}

// ─── saveState ──────────────────────────────────────────────────────────────

/**
 * Inputs to {@link saveState}. The editor facade passes the live canvas
 * plus the three transform fields that make up `_editorState`.
 */
export interface SaveStateInput {
    /** Fabric canvas to serialize. */
    canvas: FabricNS.Canvas;
    /** Active mask id supplied by the facade when Fabric active state is unavailable. */
    activeMaskId?: number | null;
    /** Active annotation id supplied by the facade when Fabric active state is unavailable. */
    activeAnnotationId?: number | null;
    /** Current image zoom factor (mirrored into `_editorState.currentScale`). */
    currentScale: number;
    /** Current image rotation in degrees (mirrored into `_editorState.currentRotation`). */
    currentRotation: number;
    /** Base scale chosen at load time (mirrored into `_editorState.baseImageScale`). */
    baseImageScale: number;
    /** MIME type of the current image, persisted for source-preserving crop. */
    currentImageMimeType?: ImageMimeType | null;
    /** Canonical editor-managed image filter config. */
    imageFilterConfig?: ResolvedImageFilterConfig;
}

/**
 * Serialize the current canvas into the snapshot string consumed by
 * `loadFromState` and stored in the undo/redo history.
 *
 * Steps, in order:
 *
 * 1. Discard any active Fabric `ActiveSelection` so multi-object
 *    selection wrappers never appear in the snapshot.
 * 2. Call `canvas.toJSON([...SNAPSHOT_CUSTOM_KEYS])` so the custom mask
 *    metadata keys (`maskId`, `maskName`, `isCropRect`, `maskLabel`,
 *    `originalAlpha`) are serialized onto each object.
 * 3. Filter out objects whose `isCropRect === true` (transient crop
 *    rectangle) or `maskLabel === true` (transient label text) — those
 *    are session-only and must never enter history.
 * 4. Embed an `_editorState` object with `currentScale`,
 *    `currentRotation`, and `baseImageScale` so undo/redo restores the
 *    full transform state.
 * 5. Return `JSON.stringify(snapshot)`.
 *
 * Falsy style values (`strokeWidth: 0`, `hasControls: false`, etc.) are
 * preserved verbatim because no defaulting happens on the serialized
 * payload.
 *
 * The function is pure with respect to the canvas object set — it does
 * not add or remove canvas objects. It only discards Fabric's multi-object
 * `ActiveSelection` wrapper and preserves ordinary single-object selection
 * state.
 *
 * @param input - The canvas plus the three transform fields to embed.
 * @returns The JSON snapshot string ready for the history stack.
 *
 */
export function saveState(input: SaveStateInput): string {
    const { canvas, currentScale, currentRotation, baseImageScale } = input;
    const activeObject = (
        canvas as { getActiveObject?: () => FabricNS.FabricObject | null }
    ).getActiveObject?.();
    const activeMaskId =
        activeObject && isMaskObject(activeObject)
            ? activeObject.maskId
            : typeof input.activeMaskId === 'number'
              ? input.activeMaskId
              : null;
    const activeAnnotationId =
        activeObject && isAnnotationObject(activeObject)
            ? activeObject.annotationId
            : typeof input.activeAnnotationId === 'number'
              ? input.activeAnnotationId
              : null;

    // 1. discard ActiveSelection before serializing, while preserving ordinary
    // single-object selection state so mask control styles do not churn during
    // history capture.
    if (isActiveSelectionObject(activeObject)) {
        canvas.discardActiveObject();
    }

    // 2. serialize with the custom keys so mask
    //    metadata, the crop marker, and the label marker round-trip onto
    //    each per-object payload.
    const jsonObj = (
        canvas as unknown as {
            toJSON(propertiesToInclude: readonly string[]): CanvasJson;
        }
    ).toJSON(SNAPSHOT_CUSTOM_KEYS) as CanvasJson;

    copySnapshotCustomPropsFromCanvas(canvas.getObjects(), jsonObj.objects);

    // 3. drop session-only objects (crop
    //    rectangle, mask labels) before the snapshot enters history.
    if (Array.isArray(jsonObj.objects)) {
        jsonObj.objects = jsonObj.objects.filter(
            (o) =>
                o.editorObjectKind !== 'session' &&
                o.isCropRect !== true &&
                o.maskLabel !== true &&
                o.isMosaicPreview !== true,
        );
    }

    // 4. embed editor-level transform metadata.
    jsonObj._editorState = {
        currentScale,
        currentRotation,
        baseImageScale,
        currentImageMimeType: input.currentImageMimeType ?? null,
        activeObjectKind:
            activeMaskId !== null ? 'mask' : activeAnnotationId !== null ? 'annotation' : null,
    };
    const imageFilterConfig = cloneResolvedImageFilterConfig(
        input.imageFilterConfig ?? DEFAULT_IMAGE_FILTER_CONFIG,
    );
    if (hasActiveImageFilters(imageFilterConfig)) {
        jsonObj._editorState.imageFilterConfig = imageFilterConfig;
    }
    if (activeMaskId !== null) jsonObj._editorState.activeMaskId = activeMaskId;
    if (activeAnnotationId !== null) {
        jsonObj._editorState.activeAnnotationId = activeAnnotationId;
    }

    // 5. emit the JSON string used by loadFromState.
    return JSON.stringify(jsonObj);
}

// ─── loadFromState ──────────────────────────────────────────────────────────

/**
 * Inputs to {@link loadFromState}. The editor facade passes the live canvas,
 * the snapshot to restore, and a callback that atomically sets the canvas
 * pixel dimensions (delegating to `image/layout-manager.ts`).
 */
export interface LoadFromStateInput {
    /** Fabric canvas to deserialize into. */
    canvas: FabricNS.Canvas;
    /**
     * The snapshot to restore. May be the JSON string emitted by
     * {@link saveState} or the already-parsed {@link CanvasJson} object — both
     * are accepted because callers occasionally hand in a pre-parsed object
     * (for example, when chaining through the crop session). The value is
     * always normalized to a string via `JSON.stringify` if necessary so the
     * returned `jsonString` is canonical.
     */
    jsonString: string | CanvasJson;
    /**
     * Sets canvas pixel dimensions atomically. The pixel size is restored
     * before `loadFromJSON`.
     */
    setCanvasSize: (width: number, height: number) => void;
    /**
     * Upper bound for restored canvas area. Defaults to 50 million pixels,
     * matching the default export pixel budget.
     */
    maxCanvasPixels?: number;
    /**
     * Trust level for snapshot validation. Public restores apply strict
     * limits and content checks before Fabric deserialization; trusted
     * internal restores preserve history/rollback behavior for snapshots
     * already produced by this editor.
     */
    restoreTrustLevel?: 'public' | 'trusted';
    /** Upper bound for public snapshot JSON byte length. */
    maxSnapshotBytes?: number;
    /** Upper bound for public snapshot object count. */
    maxSnapshotObjects?: number;
    /** Upper bound for a public snapshot canvas width or height. */
    maxRestoreCanvasDimension?: number;
}

/**
 * Output of {@link loadFromState}. The state serializer performs the
 * snapshot-format-aware steps and returns the restored metadata so the
 * editor facade can finish wiring transient state (mask label hiding,
 * `originalImage` selectability, hover-handler re-attach, `lastSnapshot`
 * baseline, UI refresh) — those concerns belong to the facade, not to the
 * serializer.
 *
 */
export interface LoadFromStateResult {
    /**
     * Restored editor transform metadata from `_editorState`, or `null` when
     * the snapshot did not carry one (older snapshots, hand-built JSON, or
     * any payload that omitted the optional field). The facade decides
     * whether to apply the values, so this is forwarded verbatim.
     */
    editorState: EditorStateMeta | null;
    /**
     * Highest `maskId` observed on restored mask objects, or `0` if none
     * exist. The facade assigns this to `maskCounter` so subsequent
     * `createMask` calls do not collide with restored IDs.
     */
    maxMaskId: number;
    /** Highest `annotationId` observed on restored annotation objects. */
    maxAnnotationId: number;
    /**
     * The first `'image'` object that is NOT a mask, or `null`. Used by the
     * facade to set `selectable: false`, `evented: false`, and to send the
     * image to the back of the stacking order. The serializer does not
     * mutate the object itself.
     */
    originalImage: BaseImageObject | null;
    /**
     * All canvas objects after restore, in `getObjects` order. The facade
     * uses this list to re-attach mask hover handlers and to drive the
     * `isImageLoadedToCanvas` flag.
     */
    objects: FabricNS.FabricObject[];
    /** Restored mask objects. */
    masks: MaskObject[];
    /** Restored annotation objects. */
    annotations: AnnotationObject[];
    /**
     * The canonical JSON string for the snapshot — equal to the input string
     * if a string was passed, or `JSON.stringify(input)` if a `CanvasJson`
     * object was passed. The facade uses this as the `lastSnapshot` baseline
     * so the next `saveState` produces a correct `before` pointer.
     */
    jsonString: string;
}

/**
 * Restore a snapshot produced by {@link saveState} into the live canvas.
 *
 * Steps, in order:
 *
 * 1. Normalize the input to a JSON string and parse it. Both string and
 *    pre-parsed forms are accepted to support callers that already hold a
 *    `CanvasJson` (for example, a crop-session snapshot).
 * 2. Restore canvas pixel dimensions via `setCanvasSize` BEFORE calling
 *    `loadFromJSON`. Fabric's `loadFromJSON` may also touch width/height,
 *    but the explicit pre-call ensures the canvas matches the snapshot
 *    even if the fabric build skips that step.
 * 3. Await `canvas.loadFromJSON(json)` (Fabric v7 returns a Promise here,
 * 4. Run {@link restoreMaskPropsFromJson} to position-match each JSON
 *    mask object against the freshly-loaded canvas objects by `maskUid`
 *    first, then by legacy `(type, left, top)`, and unconditionally re-apply the mask metadata
 *    (`maskId`, `maskName`, `originalAlpha`). Label-text objects are
 *    re-flagged via a parallel index-based pass. This is required because
 *    Fabric v7's `_setOptions` is inconsistent across point releases for
 *    unknown shape properties, and `getObjects` order may not match
 *    `json.objects` order.
 * 5. Compute and return `editorState`, `maxMaskId`, `originalImage`,
 *    `objects`, and the canonical `jsonString` so the facade can finish
 *    the restore.
 *
 * The function does NOT call `renderAll`, does NOT mutate `originalImage`
 * properties, and does NOT touch the editor's `lastSnapshot` field —
 * those are facade concerns. This keeps the serializer free of
 * editor-instance state and makes the round-trip property of
 * round-trip property testable in isolation.
 *
 * Errors are propagated to the caller. The facade wraps the call in a
 * `try/catch` and routes the error through the callback reporter so the
 * editor's `onError` handler still fires.
 *
 * @param input - The canvas, the snapshot, and the size-restore callback.
 * @returns Resolves with the restored metadata bundle.
 *
 */
export async function loadFromState(input: LoadFromStateInput): Promise<LoadFromStateResult> {
    const { canvas, jsonString: snapshotInput, setCanvasSize } = input;
    const restoreTrustLevel = input.restoreTrustLevel ?? 'public';
    const isPublicRestore = restoreTrustLevel === 'public';

    // 1. Normalize the snapshot to a canonical JSON string and parse.
    let jsonString: string;
    try {
        jsonString =
            typeof snapshotInput === 'string' ? snapshotInput : JSON.stringify(snapshotInput);
    } catch (error) {
        throw new StateRestoreError('loadFromState: snapshot JSON is malformed.', error);
    }
    if (isPublicRestore) {
        assertSnapshotByteSizeAllowed(
            jsonString,
            input.maxSnapshotBytes ?? DEFAULT_MAX_SNAPSHOT_BYTES,
        );
    }

    let json: CanvasJson;
    try {
        json = JSON.parse(jsonString) as CanvasJson;
    } catch (error) {
        throw new StateRestoreError('loadFromState: snapshot JSON is malformed.', error);
    }
    if (isPublicRestore) {
        validatePublicSnapshot(json, {
            maxSnapshotObjects: input.maxSnapshotObjects ?? DEFAULT_MAX_SNAPSHOT_OBJECTS,
        });
    }

    // 2. restore canvas pixel dimensions before
    //    Fabric touches the canvas. Guard against malformed payloads
    //    (missing or non-positive width/height) by skipping the resize.
    if (
        typeof json.width === 'number' &&
        json.width > 0 &&
        typeof json.height === 'number' &&
        json.height > 0
    ) {
        assertRestoredCanvasSizeAllowed(
            json.width,
            json.height,
            input.maxCanvasPixels ?? DEFAULT_MAX_RESTORE_CANVAS_PIXELS,
            isPublicRestore
                ? (input.maxRestoreCanvasDimension ?? DEFAULT_MAX_RESTORE_CANVAS_DIMENSION)
                : null,
        );
        setCanvasSize(json.width, json.height);
    }

    // 3. Fabric v7 `loadFromJSON` returns a Promise.
    await (
        canvas as unknown as {
            loadFromJSON(json: CanvasJson): Promise<FabricNS.Canvas>;
        }
    ).loadFromJSON(json);

    // 4. re-apply mask metadata by position-based
    //    matching, unconditionally overriding any value Fabric may or may
    //    not have applied during `_setOptions`.
    const objects = canvas.getObjects();
    restoreEditorObjectPropsFromJson(objects, json.objects ?? []);

    // 5a. forward `_editorState` for the facade to
    //     apply to its `currentScale` / `currentRotation` /
    //     `baseImageScale` fields.
    const editorState: EditorStateMeta | null =
        json._editorState && typeof json._editorState === 'object'
            ? {
                  currentScale:
                      typeof json._editorState.currentScale === 'number'
                          ? json._editorState.currentScale
                          : 1,
                  currentRotation:
                      typeof json._editorState.currentRotation === 'number'
                          ? json._editorState.currentRotation
                          : 0,
                  baseImageScale:
                      typeof json._editorState.baseImageScale === 'number'
                          ? json._editorState.baseImageScale
                          : 1,
              }
            : null;
    if (editorState && json._editorState && typeof json._editorState.activeMaskId === 'number') {
        editorState.activeMaskId = json._editorState.activeMaskId;
    }
    if (
        editorState &&
        json._editorState &&
        typeof json._editorState.activeAnnotationId === 'number'
    ) {
        editorState.activeAnnotationId = json._editorState.activeAnnotationId;
    }
    if (editorState && json._editorState && 'activeObjectKind' in json._editorState) {
        const kind = json._editorState.activeObjectKind;
        editorState.activeObjectKind =
            kind === 'mask' || kind === 'annotation' || kind === null ? kind : null;
    }
    if (editorState && json._editorState && 'currentImageMimeType' in json._editorState) {
        const mimeType = json._editorState.currentImageMimeType;
        editorState.currentImageMimeType =
            mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp'
                ? mimeType
                : null;
    }
    if (editorState && json._editorState && 'imageFilterConfig' in json._editorState) {
        editorState.imageFilterConfig = normalizeImageFilterConfigSnapshot(
            json._editorState.imageFilterConfig,
        );
    }

    // 5b. `maskCounter` is the maximum restored
    //     `maskId`, or `0` if no masks survived the filter.
    const maxMaskId = objects
        .filter(isMaskObject)
        .reduce((max, maskObject) => Math.max(max, maskObject.maskId), 0);
    const maxAnnotationId = objects
        .filter(isAnnotationObject)
        .reduce((max, annotationObject) => Math.max(max, annotationObject.annotationId), 0);

    const masks = objects.filter(isMaskObject);
    const annotations = objects.filter(isAnnotationObject);
    const originalImage = objects.find(isBaseImageObject) ?? null;

    return {
        editorState,
        maxMaskId,
        maxAnnotationId,
        originalImage,
        objects,
        masks,
        annotations,
        jsonString,
    };
}

function assertRestoredCanvasSizeAllowed(
    width: number,
    height: number,
    maxCanvasPixels: number,
    maxCanvasDimension: number | null,
): void {
    const safeMaxCanvasPixels =
        Number.isFinite(maxCanvasPixels) && maxCanvasPixels > 0
            ? Math.floor(maxCanvasPixels)
            : DEFAULT_MAX_RESTORE_CANVAS_PIXELS;
    const safeMaxCanvasDimension =
        maxCanvasDimension !== null && Number.isFinite(maxCanvasDimension) && maxCanvasDimension > 0
            ? Math.floor(maxCanvasDimension)
            : null;
    if (
        safeMaxCanvasDimension !== null &&
        (width > safeMaxCanvasDimension || height > safeMaxCanvasDimension)
    ) {
        throw new StateRestoreError(
            `loadFromState: snapshot canvas size ${width}x${height} exceeds maxRestoreCanvasDimension (${safeMaxCanvasDimension}).`,
        );
    }
    const pixelCount = width * height;
    if (!Number.isFinite(pixelCount) || pixelCount > safeMaxCanvasPixels) {
        throw new StateRestoreError(
            `loadFromState: snapshot canvas size ${width}x${height} exceeds maxCanvasPixels (${safeMaxCanvasPixels}).`,
        );
    }
}

function getUtf8ByteLength(value: string): number {
    if (typeof TextEncoder === 'function') {
        return new TextEncoder().encode(value).byteLength;
    }
    return value.length;
}

function toPositiveIntegerLimit(value: number, fallback: number): number {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function assertSnapshotByteSizeAllowed(jsonString: string, maxSnapshotBytes: number): void {
    const safeMaxSnapshotBytes = toPositiveIntegerLimit(
        maxSnapshotBytes,
        DEFAULT_MAX_SNAPSHOT_BYTES,
    );
    if (jsonString.length > safeMaxSnapshotBytes) {
        throw new StateRestoreError(
            `loadFromState: snapshot JSON size exceeds maxSnapshotBytes (${safeMaxSnapshotBytes}).`,
        );
    }

    const worstCaseUtf8Bytes = jsonString.length * 3;
    if (worstCaseUtf8Bytes <= safeMaxSnapshotBytes) return;

    const byteLength = getUtf8ByteLength(jsonString);
    if (byteLength > safeMaxSnapshotBytes) {
        throw new StateRestoreError(
            `loadFromState: snapshot JSON size ${byteLength} bytes exceeds maxSnapshotBytes (${safeMaxSnapshotBytes}).`,
        );
    }
}

interface PublicSnapshotValidationContext {
    maxSnapshotObjects: number;
    objectCount: number;
    seen: WeakSet<object>;
    countedFabricObjects: WeakSet<object>;
}

interface PublicSnapshotValueValidationOptions {
    validateFabricObject: boolean;
    allowEditorOwnedCustomMask: boolean;
    arrayEntriesAreFabricObjects: boolean;
}

function validatePublicSnapshot(json: CanvasJson, options: { maxSnapshotObjects: number }): void {
    if (json.objects !== undefined && !Array.isArray(json.objects)) {
        throw new StateRestoreError('loadFromState: snapshot objects must be an array.');
    }

    const objects = json.objects ?? [];
    const safeMaxSnapshotObjects = toPositiveIntegerLimit(
        options.maxSnapshotObjects,
        DEFAULT_MAX_SNAPSHOT_OBJECTS,
    );
    if (objects.length > safeMaxSnapshotObjects) {
        throw new StateRestoreError(
            `loadFromState: snapshot contains ${objects.length} objects, exceeding maxSnapshotObjects (${safeMaxSnapshotObjects}).`,
        );
    }

    const context: PublicSnapshotValidationContext = {
        maxSnapshotObjects: safeMaxSnapshotObjects,
        objectCount: 0,
        seen: new WeakSet(),
        countedFabricObjects: new WeakSet(),
    };

    objects.forEach((object, index) =>
        validatePublicSnapshotValue(
            object,
            `objects[${index}]`,
            {
                validateFabricObject: true,
                allowEditorOwnedCustomMask: true,
                arrayEntriesAreFabricObjects: false,
            },
            context,
            0,
        ),
    );

    for (const [key, value] of Object.entries(json)) {
        if (key === 'objects') continue;
        validatePublicSnapshotValue(
            value,
            key,
            {
                validateFabricObject: PUBLIC_RESTORE_FABRIC_OBJECT_KEYS.has(key),
                allowEditorOwnedCustomMask: false,
                arrayEntriesAreFabricObjects: PUBLIC_RESTORE_FABRIC_OBJECT_ARRAY_KEYS.has(key),
            },
            context,
            0,
        );
    }
}

function validatePublicSnapshotValue(
    value: unknown,
    path: string,
    options: PublicSnapshotValueValidationOptions,
    context: PublicSnapshotValidationContext,
    depth: number,
): void {
    if (depth > DEFAULT_MAX_PUBLIC_RESTORE_NESTING_DEPTH) {
        throw new StateRestoreError(
            `loadFromState: snapshot field "${path}" exceeds max nested object depth (${DEFAULT_MAX_PUBLIC_RESTORE_NESTING_DEPTH}).`,
        );
    }

    if (!value || typeof value !== 'object') return;

    const alreadySeen = context.seen.has(value);
    if (!alreadySeen) context.seen.add(value);

    if (options.validateFabricObject) {
        validatePublicSnapshotFabricObjectPayload(
            value,
            path,
            options.allowEditorOwnedCustomMask,
            context,
        );
    }

    if (alreadySeen) return;

    if (Array.isArray(value)) {
        value.forEach((entry, entryIndex) =>
            validatePublicSnapshotValue(
                entry,
                `${path}[${entryIndex}]`,
                {
                    validateFabricObject: options.arrayEntriesAreFabricObjects,
                    allowEditorOwnedCustomMask: false,
                    arrayEntriesAreFabricObjects: false,
                },
                context,
                depth + 1,
            ),
        );
        return;
    }

    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
        const nestedPath = path ? `${path}.${key}` : key;
        if (
            typeof nestedValue === 'string' &&
            nestedValue.trim() !== '' &&
            isPublicRestoreImageSourceKey(key) &&
            !isSupportedImageDataUrl(nestedValue)
        ) {
            throw new StateRestoreError(
                `loadFromState: snapshot field "${nestedPath}" must use a supported data URL source.`,
            );
        }
        validatePublicSnapshotValue(
            nestedValue,
            nestedPath,
            {
                validateFabricObject: shouldValidatePublicRestoreNestedFabricObject(
                    key,
                    nestedValue,
                ),
                allowEditorOwnedCustomMask: false,
                arrayEntriesAreFabricObjects: PUBLIC_RESTORE_FABRIC_OBJECT_ARRAY_KEYS.has(key),
            },
            context,
            depth + 1,
        );
    }
}

function validatePublicSnapshotFabricObjectPayload(
    value: unknown,
    path: string,
    allowEditorOwnedCustomMask: boolean,
    context: PublicSnapshotValidationContext,
): void {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new StateRestoreError(`loadFromState: snapshot field "${path}" is invalid.`);
    }

    if (!context.countedFabricObjects.has(value)) {
        context.countedFabricObjects.add(value);
        context.objectCount += 1;
        if (context.objectCount > context.maxSnapshotObjects) {
            throw new StateRestoreError(
                `loadFromState: snapshot contains more than ${context.maxSnapshotObjects} Fabric objects.`,
            );
        }
    }

    const object = value as CanvasJsonObject;
    const type = typeof object.type === 'string' ? object.type.toLowerCase() : '';
    if (type && ALLOWED_PUBLIC_RESTORE_OBJECT_TYPES.has(type)) return;
    if (allowEditorOwnedCustomMask && isPublicRestoreEditorOwnedCustomMaskPayload(object)) return;

    const typePath = path ? `${path}.type` : 'type';
    if (!type) {
        throw new StateRestoreError(
            `loadFromState: snapshot field "${typePath}" must be a supported Fabric type.`,
        );
    }

    throw new StateRestoreError(
        `loadFromState: snapshot field "${typePath}" has unsupported Fabric type "${String(object.type)}".`,
    );
}

function shouldValidatePublicRestoreNestedFabricObject(key: string, value: unknown): boolean {
    if (PUBLIC_RESTORE_FABRIC_OBJECT_KEYS.has(key)) return true;
    return isPublicRestoreImageSourceKey(key) && hasFabricObjectType(value);
}

function hasFabricObjectType(value: unknown): boolean {
    return (
        !!value && typeof value === 'object' && typeof (value as CanvasJsonObject).type === 'string'
    );
}

function isPublicRestoreEditorOwnedCustomMaskPayload(value: unknown): boolean {
    if (!isMaskObject(value)) return false;

    const candidate = value as Partial<MaskObject>;
    const expectedMaskUid =
        typeof candidate.maskId === 'number' ? `mask-${candidate.maskId}` : null;
    return (
        Number.isInteger(candidate.maskId) &&
        typeof candidate.maskId === 'number' &&
        candidate.maskId > 0 &&
        typeof candidate.maskUid === 'string' &&
        candidate.maskUid === expectedMaskUid &&
        typeof candidate.maskName === 'string' &&
        candidate.maskName.trim() !== '' &&
        typeof candidate.originalAlpha === 'number' &&
        Number.isFinite(candidate.originalAlpha)
    );
}

function isPublicRestoreImageSourceKey(key: string): boolean {
    const normalized = key.toLowerCase();
    return (
        PUBLIC_RESTORE_IMAGE_SOURCE_KEYS.has(normalized) ||
        normalized.endsWith('src') ||
        normalized.endsWith('source')
    );
}

/**
 * Mask metadata restorer. Iterates the JSON object list and finds each
 * entry's counterpart in the freshly-loaded canvas objects by stable
 * `maskUid` first, then by legacy `(type, left, top)`, then
 * unconditionally overrides `maskId`, `maskUid`, `maskName`,
 * `originalAlpha`, and `maskLabel`.
 *
 * **Why position-based instead of index-based?** Fabric v7 does not
 * guarantee that `canvas.getObjects` returns objects in the same order
 * as `json.objects`; some builds reorder during `loadFromJSON`. Matching
 * by `(type, left, top)` with a sub-pixel tolerance handles object
 * reordering during restore.
 *
 * **Why unconditional override?** Some Fabric 7.x point releases drop
 * unknown shape properties during `_setOptions`. Re-applying the values
 * even when Fabric appears to have done so makes the restore
 * deterministic regardless of which Fabric build is in use.
 *
 * Label-text objects are matched in a separate index-based pass because
 * they often share `(type, left, top)` with overlapping labels and are
 * disposable — `mask-label-manager` removes them immediately after the
 * restore via `hideAllMaskLabels`, so an occasional index mismatch is
 * harmless.
 *
 * @param canvasObjs - Live canvas objects produced by `loadFromJSON`.
 * @param jsonObjs - Per-object payloads from the snapshot.
 *
 */
function restoreEditorObjectPropsFromJson(
    canvasObjs: FabricNS.FabricObject[],
    jsonObjs: CanvasJsonObject[],
): void {
    // ── Pass 0: base images, annotations, and sessions by stable object match ─
    const consumedMetadataIndexes = new Set<number>();
    jsonObjs.forEach((jObj, index) => {
        if (
            jObj.editorObjectKind !== 'baseImage' &&
            jObj.editorObjectKind !== 'annotation' &&
            jObj.editorObjectKind !== 'session'
        ) {
            return;
        }

        const match = findCanvasObjectForJson(canvasObjs, jObj, index, consumedMetadataIndexes);
        const canvasObj = match?.object;
        if (!canvasObj) return;
        if (jObj.editorObjectKind === 'baseImage') {
            markBaseImageObject(canvasObj as unknown as FabricNS.FabricImage);
            return;
        }
        if (
            jObj.editorObjectKind === 'annotation' &&
            typeof jObj.annotationId === 'number' &&
            typeof jObj.annotationType === 'string' &&
            typeof jObj.annotationName === 'string'
        ) {
            const annotationType =
                jObj.annotationType === 'draw'
                    ? 'draw'
                    : jObj.annotationType === 'shape'
                      ? 'shape'
                      : 'text';
            const shapeAnnotationKind =
                jObj.shapeAnnotationKind === 'line' || jObj.shapeAnnotationKind === 'arrow'
                    ? jObj.shapeAnnotationKind
                    : 'rect';
            markAnnotationObject(canvasObj, {
                annotationId: jObj.annotationId,
                annotationType,
                annotationName: jObj.annotationName,
                annotationHidden:
                    typeof jObj.annotationHidden === 'boolean' ? jObj.annotationHidden : false,
                annotationLocked:
                    typeof jObj.annotationLocked === 'boolean' ? jObj.annotationLocked : false,
                annotationSelectable:
                    typeof jObj.annotationSelectable === 'boolean'
                        ? jObj.annotationSelectable
                        : undefined,
                annotationEvented:
                    typeof jObj.annotationEvented === 'boolean'
                        ? jObj.annotationEvented
                        : undefined,
                annotationHasControls:
                    typeof jObj.annotationHasControls === 'boolean'
                        ? jObj.annotationHasControls
                        : undefined,
                annotationEditable:
                    typeof jObj.annotationEditable === 'boolean'
                        ? jObj.annotationEditable
                        : undefined,
                shapeAnnotationKind: annotationType === 'shape' ? shapeAnnotationKind : undefined,
            });
            if (typeof jObj.overlayPersistentId === 'string') {
                (canvasObj as { overlayPersistentId?: string }).overlayPersistentId =
                    jObj.overlayPersistentId;
            }
            if (jObj.overlayMetadata !== undefined) {
                (canvasObj as { overlayMetadata?: unknown }).overlayMetadata = jObj.overlayMetadata;
            }
            return;
        }
        if (jObj.editorObjectKind === 'session' && typeof jObj.sessionObjectType === 'string') {
            (
                canvasObj as { editorObjectKind?: string; sessionObjectType?: string }
            ).editorObjectKind = 'session';
            (
                canvasObj as { editorObjectKind?: string; sessionObjectType?: string }
            ).sessionObjectType = jObj.sessionObjectType;
        }
    });

    // ── Pass 1: masks — match by maskUid, then type + left + top ─
    const consumedCanvasIndexes = new Set<number>();
    const canvasIndexesByMaskUid = new Map<string, number[]>();
    canvasObjs.forEach((canvasObj, index) => {
        const maskUid = (canvasObj as { maskUid?: unknown }).maskUid;
        if (typeof maskUid !== 'string') return;
        const indexes = canvasIndexesByMaskUid.get(maskUid);
        if (indexes) {
            indexes.push(index);
        } else {
            canvasIndexesByMaskUid.set(maskUid, [index]);
        }
    });

    const takeUnconsumedCanvasIndex = (indexes: number[] | undefined): number => {
        if (!indexes) return -1;
        while (indexes.length > 0) {
            const index = indexes.shift()!;
            if (!consumedCanvasIndexes.has(index)) return index;
        }
        return -1;
    };

    for (const jObj of jsonObjs) {
        if (jObj.editorObjectKind !== 'mask' || typeof jObj.maskId !== 'number') continue;

        const jType = String(jObj.type ?? '');
        const jLeft = Number(jObj.left ?? 0);
        const jTop = Number(jObj.top ?? 0);
        const jUid = typeof jObj.maskUid === 'string' ? jObj.maskUid : null;

        let matchIndex = -1;
        if (jUid) {
            matchIndex = takeUnconsumedCanvasIndex(canvasIndexesByMaskUid.get(jUid));
        }
        if (matchIndex < 0) {
            matchIndex = canvasObjs.findIndex((o, index) => {
                if (consumedCanvasIndexes.has(index)) return false;
                if (jType && o.type !== jType) return false;
                return (
                    Math.abs((o.left ?? 0) - jLeft) < 0.5 &&
                    Math.abs((o.top ?? 0) - jTop) < 0.5 &&
                    serializedTransformMatches(o, jObj)
                );
            });
        }
        if (matchIndex < 0) continue;
        consumedCanvasIndexes.add(matchIndex);
        const match = canvasObjs[matchIndex];

        // Unconditional override — never trust Fabric's `_setOptions` to
        // have applied custom keys consistently across 7.x builds.
        const maskObject = match as FabricNS.FabricObject & {
            maskId?: number;
            maskUid?: string;
            maskName?: string;
            originalAlpha?: number;
            originalStroke?: unknown;
            originalStrokeWidth?: number;
            hasControls?: boolean;
            selectable?: boolean;
            strokeUniform?: boolean;
            lockRotation?: boolean;
            transparentCorners?: boolean;
            borderColor?: string;
            cornerColor?: string;
            cornerSize?: number;
            overlayPersistentId?: string;
            overlayMetadata?: unknown;
            opacity?: number;
        };
        const originalStroke =
            'originalStroke' in jObj
                ? (jObj.originalStroke as FabricNS.TFiller | string | null)
                : undefined;
        markMaskObject(maskObject, {
            maskId: jObj.maskId,
            maskUid: typeof jObj.maskUid === 'string' ? jObj.maskUid : `mask-${jObj.maskId}`,
            maskName: typeof jObj.maskName === 'string' ? jObj.maskName : '',
            originalAlpha:
                typeof jObj.originalAlpha === 'number'
                    ? jObj.originalAlpha
                    : (maskObject.opacity ?? 0.5),
            originalStroke,
            originalStrokeWidth:
                typeof jObj.originalStrokeWidth === 'number' ? jObj.originalStrokeWidth : undefined,
        });
        if ('originalStroke' in jObj) {
            maskObject.originalStroke = jObj.originalStroke;
        }
        if (typeof jObj.originalStrokeWidth === 'number') {
            maskObject.originalStrokeWidth = jObj.originalStrokeWidth;
        }
        if (typeof jObj.hasControls === 'boolean') {
            maskObject.hasControls = jObj.hasControls;
        }
        if (typeof jObj.selectable === 'boolean') {
            maskObject.selectable = jObj.selectable;
        }
        if (typeof jObj.strokeUniform === 'boolean') {
            maskObject.strokeUniform = jObj.strokeUniform;
        }
        if (typeof jObj.lockRotation === 'boolean') {
            maskObject.lockRotation = jObj.lockRotation;
        }
        if (typeof jObj.transparentCorners === 'boolean') {
            maskObject.transparentCorners = jObj.transparentCorners;
        }
        if (typeof jObj.borderColor === 'string') {
            maskObject.borderColor = jObj.borderColor;
        }
        if (typeof jObj.cornerColor === 'string') {
            maskObject.cornerColor = jObj.cornerColor;
        }
        if (typeof jObj.cornerSize === 'number') {
            maskObject.cornerSize = jObj.cornerSize;
        }
        if (typeof jObj.overlayPersistentId === 'string') {
            maskObject.overlayPersistentId = jObj.overlayPersistentId;
        }
        if (jObj.overlayMetadata !== undefined) {
            maskObject.overlayMetadata = jObj.overlayMetadata;
        }
    }

    // ── Pass 2: label texts — flag for `hideAllMaskLabels` ──────────────
    // Labels are session-only and removed immediately after restore, so
    // index-based matching is sufficient — a stray flag on a non-label
    // object would only matter if the label-manager pass was skipped.
    jsonObjs.forEach((jObj, index) => {
        if (jObj.maskLabel !== true) return;
        const canvasObj = canvasObjs[index];
        if (canvasObj) {
            (canvasObj as FabricNS.FabricObject & { maskLabel?: boolean }).maskLabel = true;
        }
    });
}
