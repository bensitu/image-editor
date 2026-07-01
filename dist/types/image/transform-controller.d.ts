/**
 * Animated scale, rotate, base-image flip, and reset operations on the
 * `originalImage` with history integration. Owns the current
 * transform pipeline that the `ImageEditor` facade routes through the
 * runtime `AnimationQueue`.
 *
 * ## Owned contracts
 *
 * - `scaleImage(factor)` clamps `factor` to
 *   `[options.minScale, options.maxScale]` and animates the image scale
 *   to the clamped factor over `options.animationDuration` milliseconds.
 *   `scaleX` and `scaleY` are tweened together; {@link animateProps}
 *   hides the v7 per-property
 *   `onComplete` shape.
 * - `rotateImage(degrees)` animates `angle` to
 *   the requested value over `options.animationDuration` milliseconds.
 *   The animation tweens around the visual centroid by temporarily
 *   switching the image origin to `'center'/'center'`; the original
 *   `'left'/'top'` origin is restored after the animation settles.
 * - `scaleImage()` and `rotateImage()` return resolved promises for
 *   non-finite inputs without modifying canvas state. The guards are the
 *   first checks so no rollback bundle is needed.
 * - `resetImageTransform` records exactly
 *   one history entry covering the full reset. Per-operation
 *   `saveCanvasState` calls inside the chained `scaleImage(1)` and
 *   `rotateImage(0)` are suppressed via
 *   {@link TransformContext.setSuppressSaveState}, and a single
 *   `saveCanvasState` is emitted at the very end (success path) so
 *   the entire reset is one undoable step. Failures inside the chain
 *   still release the suppression flag in `finally` so subsequent
 *   transforms continue to record history.
 * - `flipHorizontal` and `flipVertical` toggle only the base image's
 *   Fabric `flipX` / `flipY` flags. Masks and annotations are not
 *   mirrored; they remain in their existing canvas positions by design.
 * - `scaleImage`, `rotateImage`, flip operations, and
 *   `resetImageTransform` each call `saveCanvasState` on success so
 *   the new state is undoable. The facade wires
 *   `saveCanvasState` to the full `core/state-serializer.ts → saveState`
 *   path; this module does not serialize the canvas itself.
 *
 * ## Dispose, animation guard, and origin safety
 *
 * The transform pipeline cooperates with three guards:
 *
 * 1. The runtime's {@link TransformContext.guard} sets
 *    `isAnimating` true/false around the Fabric animation. The
 *    `OperationGuard.runAnimation()` bracket clears the flag inside a
 *    `finally` so the public promise sees `isAnimating === false` before
 *    settling.
 * 2. The animation queue (owned by the runtime) serializes
 *    `scaleImage`, `rotateImage`, flip operations, and `resetImageTransform` so concurrent
 *    callers do not interleave mid-animation Fabric mutations. The
 *    transform controller does NOT enqueue on the queue itself; the
 *    action layer wraps each call through `animQueue.add(...)` before
 *    invoking the controller method.
 * 3. The dispose flag on {@link TransformContext.guard} lets animation
 *    callbacks consult `guard.isDisposed()` before touching the canvas.
 *    Rotation animations also restore the `'left'/'top'` origin via
 *    {@link restoreOrigin} when dispose interrupts the animation so a
 *    post-dispose inspector or a re-init that reuses the image reference
 *    still sees the documented origin.
 *
 * ## Why a class with a context bundle?
 *
 * This module keeps transform state on the editor runtime so `currentScale`,
 * `currentRotation`, `baseImageScale`, and `shouldSuppressSaveState`
 * remain on a single owner (these are part of the snapshot wire format).
 * The controller therefore reads and writes through the
 * {@link TransformContext} accessor pairs rather than duplicating the
 * fields. It mirrors the same pattern used by `LoadImageContext`.
 *
 * Owner module references (per the documented "Mapping Contracts to
 * modules" table): this module is imported by `image-editor.ts`. It is
 * intentionally NOT re-exported from `src/index.ts`.
 *
 * @module
 */
import type * as FabricNS from 'fabric';
import type { ResolvedOptions } from '../core/public-types.js';
import type { OperationGuard } from '../core/operation-guard.js';
/**
 * Dependency bundle passed by the `ImageEditor` facade into
 * {@link TransformController}. Mirrors the
 * `LoadImageContext` shape so each pipeline
 * keeps the editor runtime as the single owner of editor state.
 *
 * The facade and action layer are responsible for:
 *
 * - constructing a single {@link OperationGuard} per editor and reusing it
 *   across pipelines so `isAnimating` and `isDisposed` live in one place,
 * - routing each public transform method through the animation queue
 *   before calling into the controller,
 * - wiring {@link TransformContext.saveCanvasState} to the shared
 *   `core/state-serializer.ts → saveState` path so the snapshot embeds
 *   `_editorState`,
 * - honouring {@link TransformContext.setSuppressSaveState} by making
 *   `saveCanvasState` a no-op while the suppression flag is `true` —
 *   this is what lets `resetImageTransform` record exactly one history
 *   entry,
 * - performing post-animation UI refresh (rotation/scale input boxes,
 *   undo/redo buttons, mask label sync) — those concerns belong on the
 *   facade/action layer, not in the controller, so per-step UI updates remain
 *   centralized.
 *
 */
export interface TransformContext {
    /** The live Fabric canvas the original image lives on. */
    canvas: FabricNS.Canvas;
    /** Resolved editor options (animation duration, min/max scale). */
    options: ResolvedOptions;
    /**
     * Shared operation guard. The controller calls
     * {@link OperationGuard.runAnimation} to set `isAnimating` for the
     * lifetime of each Fabric animation and to honour the dispose flag.
     */
    guard: OperationGuard;
    /** Reads the previously-committed `originalImage`. */
    getOriginalImage(): FabricNS.FabricImage | null;
    /** Reads `currentScale`. */
    getCurrentScale(): number;
    /** Writes `currentScale`. */
    setCurrentScale(n: number): void;
    /** Reads `currentRotation` in degrees. */
    getCurrentRotation(): number;
    /** Writes `currentRotation` in degrees. */
    setCurrentRotation(n: number): void;
    /** Reads `baseImageScale` chosen at load time. */
    getBaseImageScale(): number;
    /**
     * Persist a snapshot to the history stack. Wired by the orchestrator
     * to `core/state-serializer.ts → saveState` plus the surrounding
     * mask-label hide/restore bracket. While the suppression flag set by
     * `setSuppressSaveState(true)` is active, the orchestrator
     * MUST treat this as a no-op so `resetImageTransform` records exactly
     * one history entry.
     */
    saveCanvasState(): void;
    /**
     * Toggle the suppression flag that turns {@link saveCanvasState} into
     * a no-op. Used by {@link TransformController.resetImageTransform} to
     * collapse the per-operation history entries from the chained
     * `scaleImage(1)` and `rotateImage(0)` calls into a single reset
     * entry. The runtime owns the flag itself; this method is the
     * controller's only handle on it.
     */
    setSuppressSaveState(suppress: boolean): void;
    /**
     * Optional post-snap hook the orchestrator wires for legacy parity. Runs
     * AFTER the controller commits the final value with `set` /
     * `setCoords` and BEFORE `saveCanvasState`. Used to:
     *
     * - resize the canvas according to the current layout mode,
     * - re-align the image bounding box to the canvas top-left,
     * - re-sync mask label positions for visible labels.
     *
     * The hook is invoked only on the success path (no dispose) and only
     * when defined — controllers running outside the facade (in tests)
     * may omit it. Errors thrown from the hook propagate to the caller's
     * `try/catch`, which mirrors legacy behaviour where the post-snap UI
     * helpers ran inline inside the transform method.
     */
    afterTransformSnap?(): void;
}
/**
 * Owns the animated `scaleImage`, `rotateImage`, base-image flip, and
 * `resetImageTransform` operations. Each method is invoked from a queue
 * entry on the orchestrator's animation queue and returns a Promise that
 * resolves once the Fabric animation has settled and `saveCanvasState`
 * has been called (or the operation no-opped because of dispose, an
 * already-running animation, or non-finite input).
 *
 * Lifetime is one-per-editor — a fresh controller is constructed inside
 * the `ImageEditor` constructor and lives until `dispose` runs. The
 * controller holds no mutable state of its own; the {@link TransformContext}
 * is the single source of truth.
 *
 */
export declare class TransformController {
    private readonly context;
    /**
     * @param context - Dependency bundle owned by the `ImageEditor` facade.
     */
    constructor(context: TransformContext);
    /**
     * Animate the image scale to `factor`, clamped to
     * `[options.minScale, options.maxScale]`.
     *
     * Steps:
     *
     * 1. Bail (resolved) when no image is loaded, an animation is already
     *    in progress, or the editor has been disposed.
     * 2. Clamp `factor` to `[minScale, maxScale]` and update
     *    `currentScale` so toolbar inputs reflect the requested value
     *    BEFORE the animation begins (matches legacy timing).
     * 3. Re-anchor the image origin to its current visual top-left so
     *    `scaleX` / `scaleY` tweens scale around the upper-left corner
     *    rather than the Fabric default centre.
     * 4. Run a `scaleX` + `scaleY` tween via
     *    {@link animateProps} inside an
     *    {@link OperationGuard.runAnimation} bracket.
     * 5. After the animation settles, snap to the exact target via
     *    `set({ scaleX, scaleY})` + `setCoords` so floating-point
     *    drift on the last tick does not leak into history.
     * 6. Run the optional {@link TransformContext.afterTransformSnap}
     *    hook for canvas resize / mask label sync.
     * 7. Call {@link TransformContext.saveCanvasState} so the new state
     *    is undoable. When dispose ran during the
     *    animation, the controller exits without snapping or saving so
     *    no torn-down canvas reference is touched.
     *
     * @param factor - Requested scale factor (1 = base, may exceed bounds —
     *               the value is clamped before use).
     * @returns A promise that resolves once the animation has settled and
     *          history has been recorded, or immediately when the call
     *          short-circuits due to one of the bail conditions.
     *
     */
    scaleImage(factor: number): Promise<void>;
    /**
     * Animate the image rotation to `degrees`. Returns a resolved promise
     * without modifying canvas state when `degrees` is not finite.
     *
     * Steps:
     *
     * 1. Bail (resolved) on non-finite input, missing image, in-flight animation,
     *    or disposed editor.
     * 2. Update `currentRotation` BEFORE the animation begins so toolbar
     *    inputs reflect the requested value during the tween.
     * 3. Switch the image origin to `'center'/'center'` around its
     *    visual centroid so Fabric tweens the angle around the centre
     *    of mass rather than the top-left corner.
     * 4. Run an `angle` tween via {@link animateProps} inside an
     *    {@link OperationGuard.runAnimation} bracket.
     * 5. After the animation settles, snap to the exact target via
     *    `set('angle', degrees)` + `setCoords`.
     * 6. Restore the `'left'/'top'` origin around the new visual
     *    top-left corner so subsequent placements (mask creation, crop
     *    rectangle, etc.) read off the documented origin.
     * 7. Run the optional {@link TransformContext.afterTransformSnap}
     *    hook for canvas resize and mask label sync.
     * 8. Call {@link TransformContext.saveCanvasState}.
     *
     * If dispose runs during the animation, step 6's origin restore
     * branch is skipped — leaving the image in the temporary
     * centre-origin state. The controller invokes
     * {@link restoreOrigin} from `finally` so a post-dispose inspector
     * still sees the documented `'left'/'top'` origin. `restoreOrigin`
     * is documented as silent
     * best-effort cleanup so it cannot mask the original animation
     * error.
     *
     * @param degrees - Target rotation angle in degrees. Non-finite values are no-ops.
     * @returns A promise that resolves once the animation has settled and
     *          history has been recorded, or immediately when the call
     *          short-circuits due to one of the bail conditions.
     *
     */
    rotateImage(degrees: number): Promise<void>;
    flipHorizontal(): Promise<void>;
    flipVertical(): Promise<void>;
    private flipImage;
    /**
     * Animate the image to `scale = 1` and `rotation = 0`, clear flip
     * state, and record
     * exactly one history entry covering the whole reset.
     *
     * Implementation strategy: chain `scaleImage(1)` and `rotateImage(0)`,
     * then clear `flipX` and `flipY`, but suppress their per-operation history entries via
     * {@link TransformContext.setSuppressSaveState}. After both
     * sub-animations settle (or one rejects), release the suppression
     * flag and emit a single `saveCanvasState` so the entire reset is
     * one undoable step.
     *
     * Failure handling:
     *
     * - If `scaleImage(1)` or `rotateImage(0)` throws, the suppression
     *   flag is still released in `finally` so subsequent transforms
     *   continue to record history.
     * - The single `saveCanvasState` call only runs on the success path.
     *   A failed reset therefore does not push a half-applied snapshot
     *   to history (the partially-applied scale or rotation is still
     *   recoverable via subsequent successful transforms).
     *
     * @returns A promise that resolves once both sub-animations have
     *          settled and the single history entry has been recorded.
     *          Resolves immediately as a no-op when no image is loaded.
     *
     */
    resetImageTransform(): Promise<void>;
}
