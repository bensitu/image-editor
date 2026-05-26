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
export declare const SNAPSHOT_CUSTOM_KEYS: readonly ["maskId", "maskName", "isCropRect", "maskLabel", "originalAlpha", "originalStroke", "originalStrokeWidth"];
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
export declare function saveState(input: SaveStateInput): string;
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
export declare function loadFromState(input: LoadFromStateInput): Promise<LoadFromStateResult>;
//# sourceMappingURL=state-serializer.d.ts.map