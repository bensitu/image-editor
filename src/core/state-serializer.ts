/**
 * @file state-serializer.ts
 * @description Serializer for the editor's history-and-restore snapshot
 *              wire format. Owns `saveState` and `loadFromState` so the
 *              serialization format and the position-based metadata restorer
 *              live in a single module.
 *
 * ## Owned contracts
 *
 * - `saveState` SHALL serialize the canvas via
 *   `canvas.toJSON([...customKeys])` including the custom keys
 *   `maskId`, `maskName`, `isCropRect`, `maskLabel`, and `originalAlpha`.
 *   Crop rectangles (`isCropRect === true`) and mask labels
 *   (`maskLabel === true`) are filtered out before the snapshot is
 *   pushed to history — they are session-only objects.
 * - Every snapshot SHALL embed an `_editorState`
 *   object containing `currentScale`, `currentRotation`, and
 *   `baseImageScale` so undo/redo can fully restore editor metadata.
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
 */

import type * as FabricNS from 'fabric';

import { isMaskObject } from './public-types.js';

// ─── Snapshot wire format ────────────────────────────────────────────────────

/**
 * Per-object payload inside a {@link CanvasJSON} snapshot. Mirrors the
 * Pretty_Printer wire format used by the canvas serializer.
 *
 * The `isCropRect` and `maskLabel` markers are filtered out by
 * {@link saveState}, so a snapshot pushed to history will never contain
 * them — they are listed here purely for the live-canvas pre-filter
 * type. Custom mask metadata (`maskId`, `maskName`, `originalAlpha`) is
 * carried through verbatim.
 */
export interface CanvasJSONObject {
    /** Fabric shape type discriminator (`'rect'`, `'circle'`, `'image'`, etc.). */
    type?: string;
    /** Left-edge pixel coordinate (Fabric serializes `originX: 'left'` masks here). */
    left?: number;
    /** Top-edge pixel coordinate. */
    top?: number;
    /** Stable mask identifier. */
    maskId?: number;
    /** Mask family name passed through `MaskConfig.name`. */
    maskName?: string;
    /** Pre-crop alpha cached so `cancelCrop` can restore it. */
    originalAlpha?: number;
    /** Stroke captured before transient hover or selection styling. */
    originalStroke?: unknown;
    /** Stroke width captured before transient hover or selection styling. */
    originalStrokeWidth?: number;
    /** Marks the transient crop rectangle; filtered before history push. */
    isCropRect?: boolean;
    /** Marks a mask label text object; filtered before history push. */
    maskLabel?: boolean;
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
}

/**
 * Full snapshot envelope. Standard Fabric `toJSON` keys plus the editor
 * extension fields owned by this module.
 */
export interface CanvasJSON {
    /** Fabric format version stamped by `canvas.toJSON`. */
    version?: string;
    /** Canvas pixel width — included by Fabric's `toJSON`. */
    width?: number;
    /** Canvas pixel height — included by Fabric's `toJSON`. */
    height?: number;
    /** Canvas CSS background — included by Fabric's `toJSON`. */
    background?: string;
    /** Per-object Fabric payloads, post-filter. */
    objects?: CanvasJSONObject[];
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
export const SNAPSHOT_CUSTOM_KEYS = [
    'maskId',
    'maskName',
    'isCropRect',
    'maskLabel',
    'originalAlpha',
    'originalStroke',
    'originalStrokeWidth',
] as const;

// ─── saveState ──────────────────────────────────────────────────────────────

/**
 * Inputs to {@link saveState}. The editor facade passes the live canvas
 * plus the three transform fields that make up `_editorState`.
 */
export interface SaveStateInput {
    /** Fabric canvas to serialize. */
    canvas: FabricNS.Canvas;
    /** Current image zoom factor (mirrored into `_editorState.currentScale`). */
    currentScale: number;
    /** Current image rotation in degrees (mirrored into `_editorState.currentRotation`). */
    currentRotation: number;
    /** Base scale chosen at load time (mirrored into `_editorState.baseImageScale`). */
    baseImageScale: number;
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
 * not add or remove canvas objects. Discarding the active selection is
 * a no-op when no `ActiveSelection` is present.
 *
 * @param input The canvas plus the three transform fields to embed.
 * @returns The JSON snapshot string ready for the history stack.
 *
 */
export function saveState(input: SaveStateInput): string {
    const { canvas, currentScale, currentRotation, baseImageScale } = input;

    // 1. discard ActiveSelection before serializing.
    canvas.discardActiveObject();

    // 2. serialize with the custom keys so mask
    //    metadata, the crop marker, and the label marker round-trip onto
    //    each per-object payload.
    const jsonObj = (
        canvas as unknown as {
            toJSON(propertiesToInclude: readonly string[]): CanvasJSON;
        }
    ).toJSON(SNAPSHOT_CUSTOM_KEYS) as CanvasJSON;

    // 3. drop session-only objects (crop
    //    rectangle, mask labels) before the snapshot enters history.
    if (Array.isArray(jsonObj.objects)) {
        jsonObj.objects = jsonObj.objects.filter(
            (o) => o.isCropRect !== true && o.maskLabel !== true,
        );
    }

    // 4. embed editor-level transform metadata.
    jsonObj._editorState = {
        currentScale,
        currentRotation,
        baseImageScale,
    };

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
     * {@link saveState} or the already-parsed {@link CanvasJSON} object — both
     * are accepted because callers occasionally hand in a pre-parsed object
     * (for example, when chaining through the crop session). The value is
     * always normalized to a string via `JSON.stringify` if necessary so the
     * returned `jsonString` is canonical.
     */
    jsonString: string | CanvasJSON;
    /**
     * Sets canvas pixel dimensions atomically. The pixel size is restored
     * before `loadFromJSON`.
     */
    setCanvasSize: (width: number, height: number) => void;
}

/**
 * Output of {@link loadFromState}. The state serializer performs the
 * snapshot-format-aware steps and returns the restored metadata so the
 * editor facade can finish wiring transient state (mask label hiding,
 * `originalImage` selectability, hover-handler re-attach, `_lastSnapshot`
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
    /**
     * The first `'image'` object that is NOT a mask, or `null`. Used by the
     * facade to set `selectable: false`, `evented: false`, and to send the
     * image to the back of the stacking order. The serializer does not
     * mutate the object itself.
     */
    originalImage: FabricNS.FabricImage | null;
    /**
     * All canvas objects after restore, in `getObjects` order. The facade
     * uses this list to re-attach mask hover handlers and to drive the
     * `isImageLoadedToCanvas` flag.
     */
    objects: FabricNS.FabricObject[];
    /**
     * The canonical JSON string for the snapshot — equal to the input string
     * if a string was passed, or `JSON.stringify(input)` if a `CanvasJSON`
     * object was passed. The facade uses this as the `_lastSnapshot` baseline
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
 *    `CanvasJSON` (for example, a crop-session snapshot).
 * 2. Restore canvas pixel dimensions via `setCanvasSize` BEFORE calling
 *    `loadFromJSON`. Fabric's `loadFromJSON` may also touch width/height,
 *    but the explicit pre-call ensures the canvas matches the snapshot
 *    even if the fabric build skips that step.
 * 3. Await `canvas.loadFromJSON(json)` (Fabric v7 returns a Promise here,
 * 4. Run {@link restoreMaskPropsFromJSON} to position-match each JSON
 *    mask object against the freshly-loaded canvas objects by
 *    `(type, left, top)` and unconditionally re-apply the mask metadata
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
 * properties, and does NOT touch the editor's `_lastSnapshot` field —
 * those are facade concerns. This keeps the serializer free of
 * editor-instance state and makes the round-trip property of
 * round-trip property testable in isolation.
 *
 * Errors are propagated to the caller. The facade wraps the call in a
 * `try/catch` and routes the error through the callback reporter so the
 * editor's `onError` handler still fires.
 *
 * @param input The canvas, the snapshot, and the size-restore callback.
 * @returns Resolves with the restored metadata bundle.
 *
 */
export async function loadFromState(input: LoadFromStateInput): Promise<LoadFromStateResult> {
    const { canvas, jsonString: snapshotInput, setCanvasSize } = input;

    // 1. Normalize the snapshot to a canonical JSON string and parse.
    const jsonString =
        typeof snapshotInput === 'string' ? snapshotInput : JSON.stringify(snapshotInput);
    const json: CanvasJSON = JSON.parse(jsonString) as CanvasJSON;

    // 2. restore canvas pixel dimensions before
    //    Fabric touches the canvas. Guard against malformed payloads
    //    (missing or non-positive width/height) by skipping the resize.
    if (
        typeof json.width === 'number' &&
        json.width > 0 &&
        typeof json.height === 'number' &&
        json.height > 0
    ) {
        setCanvasSize(json.width, json.height);
    }

    // 3. Fabric v7 `loadFromJSON` returns a Promise.
    await (
        canvas as unknown as {
            loadFromJSON(json: CanvasJSON): Promise<FabricNS.Canvas>;
        }
    ).loadFromJSON(json);

    // 4. re-apply mask metadata by position-based
    //    matching, unconditionally overriding any value Fabric may or may
    //    not have applied during `_setOptions`.
    const objects = canvas.getObjects();
    restoreMaskPropsFromJSON(objects, json.objects ?? []);

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

    // 5b. `maskCounter` is the maximum restored
    //     `maskId`, or `0` if no masks survived the filter.
    const maxMaskId = objects
        .filter(isMaskObject)
        .reduce((max, maskObject) => Math.max(max, maskObject.maskId), 0);

    // 5c. The first non-mask image object is the editor's
    //     `originalImage`. Returning `null` when missing keeps the facade
    //     free of "did the snapshot have an image?" guesses.
    const originalImage = (objects.find(isOriginalImageObject) ??
        null) as FabricNS.FabricImage | null;

    return {
        editorState,
        maxMaskId,
        originalImage,
        objects,
        jsonString,
    };
}

function isOriginalImageObject(object: FabricNS.FabricObject): boolean {
    if (isMaskObject(object)) return false;

    const type = typeof object.type === 'string' ? object.type.toLowerCase() : '';
    if (type === 'image') return true;

    const isType = (object as { isType?: (...types: string[]) => boolean }).isType;
    return typeof isType === 'function' && isType.call(object, 'image');
}

/**
 * Position-based mask metadata restorer. Iterates the JSON object list
 * and finds each entry's counterpart in the freshly-loaded canvas
 * objects by `(type, left, top)`, then unconditionally overrides
 * `maskId`, `maskName`, `originalAlpha`, and `maskLabel`.
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
 * restore via `_hideAllMaskLabels`, so an occasional index mismatch is
 * harmless.
 *
 * @param canvasObjs Live canvas objects produced by `loadFromJSON`.
 * @param jsonObjs   Per-object payloads from the snapshot.
 *
 */
function restoreMaskPropsFromJSON(
    canvasObjs: FabricNS.FabricObject[],
    jsonObjs: CanvasJSONObject[],
): void {
    // ── Pass 1: masks — match by type + left + top ───────────────────────
    const consumedCanvasIndexes = new Set<number>();

    for (const jObj of jsonObjs) {
        if (typeof jObj.maskId !== 'number') continue;

        const jType = String(jObj.type ?? '');
        const jLeft = Number(jObj.left ?? 0);
        const jTop = Number(jObj.top ?? 0);

        const matchIndex = canvasObjs.findIndex((o, index) => {
            if (consumedCanvasIndexes.has(index)) return false;
            if (jType && o.type !== jType) return false;
            return Math.abs((o.left ?? 0) - jLeft) < 0.5 && Math.abs((o.top ?? 0) - jTop) < 0.5;
        });
        if (matchIndex < 0) continue;
        consumedCanvasIndexes.add(matchIndex);
        const match = canvasObjs[matchIndex];

        // Unconditional override — never trust Fabric's `_setOptions` to
        // have applied custom keys consistently across 7.x builds.
        const maskObject = match as FabricNS.FabricObject & {
            maskId?: number;
            maskName?: string;
            originalAlpha?: number;
            originalStroke?: unknown;
            originalStrokeWidth?: number;
            opacity?: number;
        };
        maskObject.maskId = jObj.maskId;
        maskObject.maskName = String(jObj.maskName ?? '');
        maskObject.originalAlpha =
            typeof jObj.originalAlpha === 'number'
                ? jObj.originalAlpha
                : (maskObject.opacity ?? 0.5);
        if ('originalStroke' in jObj) {
            maskObject.originalStroke = jObj.originalStroke;
        }
        if (typeof jObj.originalStrokeWidth === 'number') {
            maskObject.originalStrokeWidth = jObj.originalStrokeWidth;
        }
    }

    // ── Pass 2: label texts — flag for `_hideAllMaskLabels` ──────────────
    // Labels are session-only and removed immediately after restore, so
    // index-based matching is sufficient — a stray flag on a non-label
    // object would only matter if the label-manager pass was skipped.
    jsonObjs.forEach((jObj, idx) => {
        if (jObj.maskLabel !== true) return;
        const canvasObj = canvasObjs[idx];
        if (canvasObj) {
            (canvasObj as FabricNS.FabricObject & { maskLabel?: boolean }).maskLabel = true;
        }
    });
}
