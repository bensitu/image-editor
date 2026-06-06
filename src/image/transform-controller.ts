/**
 * Animated scale, rotate, and reset operations on the
 * `originalImage` with history integration. Owns the current
 * transform pipeline that the `ImageEditor` facade routes
 * through the `AnimationQueue`.
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
 * - `scaleImage`, `rotateImage`, and
 *   `resetImageTransform` each call `saveCanvasState` on success so
 *   the new state is undoable. The orchestrator wires
 *   `saveCanvasState` to the full `core/state-serializer.ts → saveState`
 *   path; this module does not serialize the canvas itself.
 *
 * ## Dispose, animation guard, and origin safety
 *
 * The transform pipeline cooperates with three guards:
 *
 * 1. The orchestrator's {@link TransformContext.guard} sets
 *    `isAnimating` true/false around the Fabric animation. The
 *    `OperationGuard.runAnimation()` bracket clears the flag inside a
 *    `finally` so the public promise sees `isAnimating === false` before
 *    settling.
 * 2. The animation queue (owned by the orchestrator) serializes
 *    `scaleImage`, `rotateImage`, and `resetImageTransform` so concurrent
 *    callers do not interleave mid-animation Fabric mutations. The
 *    transform controller does NOT enqueue on the queue itself; the
 *    orchestrator wraps each call through `animQueue.add(...)` before
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
 * The legacy monolithic `ImageEditor` owned all transform state. This module keeps that
 * state on the facade so `currentScale`, `currentRotation`,
 * `baseImageScale`, and `shouldSuppressSaveState` remain on a single owner
 * (these are part of the snapshot wire format). The
 * controller therefore reads and writes through the
 * {@link TransformContext} accessor pairs rather than duplicating the
 * fields. Mirrors the same pattern used by
 * `LoadImageContext`.
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
import { animateProps, restoreOrigin } from '../fabric/fabric-animation.js';

// ─── Transform context ───────────────────────────────────────────────────────

/**
 * Dependency bundle passed by the `ImageEditor` facade into
 * {@link TransformController}. Mirrors the
 * `LoadImageContext` shape so each pipeline
 * keeps the orchestrator as the single owner of editor state.
 *
 * The facade is responsible for:
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
 *   facade, not in the controller, so per-step UI updates remain
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
     * entry. The orchestrator owns the flag itself; this method is the
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

// ─── TransformController ─────────────────────────────────────────────────────

/**
 * Owns the animated `scaleImage`, `rotateImage`, and
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
export class TransformController {
    private readonly context: TransformContext;

    /**
     * @param context - Dependency bundle owned by the `ImageEditor` facade.
     */
    constructor(context: TransformContext) {
        this.context = context;
    }

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
    async scaleImage(factor: number): Promise<void> {
        if (!Number.isFinite(factor)) return;

        const imageObject = this.context.getOriginalImage();
        if (!imageObject) return;
        if (this.context.guard.isAnimating()) return;
        if (this.context.guard.isDisposed()) return;

        // clamp before mutating any visible state.
        const clamped = Math.max(
            this.context.options.minScale,
            Math.min(this.context.options.maxScale, factor),
        );
        this.context.setCurrentScale(clamped);

        const targetAbs = this.context.getBaseImageScale() * clamped;

        // legacy parity — re-anchor to the current top-left so the scale
        // animation tweens around the upper-left corner rather than the
        // Fabric default centre. The orchestrator's afterTransformSnap
        // re-aligns the bounding box once the animation finishes.
        try {
            const topLeft = computeTopLeftPoint(imageObject);
            imageObject.set({ originX: 'left', originY: 'top' });
            imageObject.setPositionByOrigin(topLeft, 'left', 'top');
            imageObject.setCoords();
        } catch (error) {
            console.warn('[ImageEditor] scaleImage: origin pre-anchor failed', error);
        }

        try {
            // runAnimation brackets the begin/end so
            // `isAnimating` is `false` before this method's promise settles.
            await this.context.guard.runAnimation(() =>
                animateProps(
                    imageObject,
                    { scaleX: targetAbs, scaleY: targetAbs },
                    {
                        duration: this.context.options.animationDuration,
                        onChange: () => this.context.canvas.requestRenderAll(),
                    },
                    this.context.guard,
                ),
            );
        } catch (error) {
            console.warn('[ImageEditor] scaleImage animation error', error);
            return;
        }

        // the canvas may have been disposed mid-animation.
        if (this.context.guard.isDisposed()) return;

        imageObject.set({ scaleX: targetAbs, scaleY: targetAbs });
        imageObject.setCoords();

        if (this.context.afterTransformSnap) this.context.afterTransformSnap();

        // record a snapshot so the new scale is undoable.
        this.context.saveCanvasState();
    }

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
    async rotateImage(degrees: number): Promise<void> {
        // Non-finite input is a no-op with no observable mutation.
        if (!Number.isFinite(degrees)) return;

        const imageObject = this.context.getOriginalImage();
        if (!imageObject) return;
        if (this.context.guard.isAnimating()) return;
        if (this.context.guard.isDisposed()) return;

        this.context.setCurrentRotation(degrees);

        // Pre-animation: tween around the visual centroid so a quarter
        // turn does not slide the image off the canvas.
        try {
            const centre = imageObject.getCenterPoint();
            imageObject.set({ originX: 'center', originY: 'center' });
            imageObject.setPositionByOrigin(centre, 'center', 'center');
            imageObject.setCoords();
        } catch (error) {
            console.warn('[ImageEditor] rotateImage: origin pre-anchor failed', error);
        }

        let animationFailed = false;
        try {
            await this.context.guard.runAnimation(() =>
                animateProps(
                    imageObject,
                    { angle: degrees },
                    {
                        duration: this.context.options.animationDuration,
                        onChange: () => this.context.canvas.requestRenderAll(),
                    },
                    this.context.guard,
                ),
            );
        } catch (error) {
            animationFailed = true;
            console.warn('[ImageEditor] rotateImage animation error', error);
        } finally {
            // when dispose interrupts the rotation
            // animation, the post-animation origin restore below is
            // skipped. `restoreOrigin` replays the restore as a silent
            // best-effort cleanup so a post-dispose inspector or a
            // re-init that reuses the image reference still sees the
            // documented `'left'/'top'` origin.
            if (this.context.guard.isDisposed()) {
                restoreOrigin(imageObject, 'left', 'top');
            }
        }

        if (animationFailed) return;
        if (this.context.guard.isDisposed()) return;

        imageObject.set('angle', degrees);
        imageObject.setCoords();

        if (this.context.afterTransformSnap) this.context.afterTransformSnap();

        // Restore origin to top-left around the post-animation
        // bounding-box top-left so subsequent placement math uses the
        // documented origin.
        try {
            const newTopLeft = computeTopLeftPoint(imageObject);
            imageObject.set({ originX: 'left', originY: 'top' });
            imageObject.setPositionByOrigin(newTopLeft, 'left', 'top');
            imageObject.setCoords();
        } catch (error) {
            console.warn('[ImageEditor] rotateImage: origin post-restore failed', error);
        }

        // record a snapshot so the new rotation is undoable.
        this.context.saveCanvasState();
    }

    /**
     * Animate the image to `scale = 1` and `rotation = 0` and record
     * exactly one history entry covering the whole reset.
     *
     * Implementation strategy: chain `scaleImage(1)` and `rotateImage(0)`
     * but suppress their per-operation history entries via
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
    async resetImageTransform(): Promise<void> {
        if (!this.context.getOriginalImage()) return;

        this.context.setSuppressSaveState(true);
        try {
            await this.scaleImage(1);
            await this.rotateImage(0);
        } finally {
            this.context.setSuppressSaveState(false);
        }

        if (this.context.guard.isDisposed()) return;

        // single history entry for the whole reset.
        this.context.saveCanvasState();
    }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Compute the visual top-left corner of a Fabric object as a `Point`.
 * Mirrors the legacy `_getObjectTopLeftPoint` helper: `getCoords` returns
 * the four corner points of the object's bounding box in canvas
 * coordinates with `[0]` being the top-left. The fallback to
 * `getBoundingRect` covers the rare Fabric build where `getCoords`
 * returns an empty array (notably the v7 detached-canvas edge case).
 */
function computeTopLeftPoint(object: FabricNS.FabricObject): FabricNS.Point {
    object.setCoords();
    const coords = object.getCoords();
    const first = coords[0];
    if (first) return first as unknown as FabricNS.Point;
    // Fallback path — construct the point ad hoc. This keeps the
    // controller free of a `FabricModule` reference (the
    // {@link TransformContext} intentionally does not carry one) at the
    // cost of returning a plain `{ x, y }` shape that Fabric's
    // `setPositionByOrigin` accepts as a `Point` (its signature widens
    // to `XY` in v7).
    const boundingRect = object.getBoundingRect();
    return { x: boundingRect.left, y: boundingRect.top } as unknown as FabricNS.Point;
}
