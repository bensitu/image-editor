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
 * - `flipHorizontal` and `flipVertical` toggle the base image's Fabric
 *   `flipX` / `flipY` flags. Enabled masks and annotations receive the final
 *   image matrix delta after the image bounding box is aligned.
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
 *    {@link restoreOrigin} when an animation is interrupted so a
 *    post-failure inspector or a re-init that reuses the image reference
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

import { reportWarning } from '../core/callback-reporter.js';
import type { ResolvedOptions } from '../core/public-types.js';
import type { OperationGuard } from '../core/operation-guard.js';
import { animateProps, restoreOrigin } from '../fabric/fabric-animation.js';
import type { FabricUtilAccess } from './overlay-transform-delta.js';

// ─── Transform context ───────────────────────────────────────────────────────

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

    /** Narrow Fabric matrix utility adapter used by overlay binding. */
    getFabricUtil(): FabricUtilAccess;
    /** Return live overlay objects enabled for the requested binding kind. */
    getBoundOverlayTargets(kind: 'masks' | 'annotations'): FabricNS.FabricObject[];
    /** Return whether a bound annotation should remove reflection locally. */
    shouldPreserveReadableForAnnotation(object: FabricNS.FabricObject): boolean;
    /** Resize the canvas and align the final image bounding box to top-left. */
    finalizeImageTransformSnap(): void;
    /** Apply the final base-image matrix delta to enabled live overlays. */
    applyOverlayTransformDelta(beforeMatrix: number[]): void;
    /** Synchronize session state such as mask labels after overlay mutation. */
    syncOverlayAfterTransform(): void;
    /** Suppress intermediate overlay deltas during compound transforms. */
    setSuppressOverlaySync(suppress: boolean): void;
    /** Read the compound-transform overlay suppression state. */
    isOverlaySyncSuppressed(): boolean;
}

// ─── TransformController ─────────────────────────────────────────────────────

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
     * 6. Finalize image geometry, apply the optional overlay delta, and
     *    synchronize mask labels.
     * 7. Call {@link TransformContext.saveCanvasState} in a `finally`
     *    after the hook so the new state is undoable even if post-snap
     *    UI sync fails. When dispose ran during the
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

        imageObject.setCoords();
        const beforeMatrix = imageObject.calcTransformMatrix() as number[];

        const previousScale = this.context.getCurrentScale();
        const previousScaleX = imageObject.scaleX;
        const previousScaleY = imageObject.scaleY;

        // clamp before mutating any visible state.
        const clamped = Math.max(
            this.context.options.minScale,
            Math.min(this.context.options.maxScale, factor),
        );
        this.context.setCurrentScale(clamped);

        const targetAbs = this.context.getBaseImageScale() * clamped;

        // legacy parity — re-anchor to the current top-left so the scale
        // animation tweens around the upper-left corner rather than the
        // Fabric default centre. The final image snap
        // re-aligns the bounding box once the animation finishes.
        try {
            const topLeft = computeTopLeftPoint(imageObject);
            imageObject.set({ originX: 'left', originY: 'top' });
            imageObject.setPositionByOrigin(topLeft, 'left', 'top');
            imageObject.setCoords();
        } catch (error) {
            reportWarning(this.context.options, error, 'scaleImage origin pre-anchor failed.');
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
            this.context.setCurrentScale(previousScale);
            if (!this.context.guard.isDisposed()) {
                imageObject.set({ scaleX: previousScaleX, scaleY: previousScaleY });
                imageObject.setCoords();
                this.completeImageTransform(beforeMatrix);
            }
            reportWarning(this.context.options, error, 'scaleImage animation failed.');
            return;
        }

        // the canvas may have been disposed mid-animation.
        if (this.context.guard.isDisposed()) return;

        imageObject.set({ scaleX: targetAbs, scaleY: targetAbs });
        imageObject.setCoords();

        try {
            this.completeImageTransform(beforeMatrix);
        } finally {
            // record a snapshot so the new scale is undoable.
            this.context.saveCanvasState();
        }
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
     * 7. Finalize image geometry, apply the optional overlay delta, and
     *    synchronize mask labels.
     * 8. Call {@link TransformContext.saveCanvasState}.
     *
     * If the animation fails before step 6, the catch path restores the
     * previous logical rotation, canvas angle, and `'left'/'top'` origin.
     * If dispose runs during the animation, the controller invokes
     * {@link restoreOrigin} from `finally` as silent best-effort cleanup
     * so a post-dispose inspector still sees the documented origin.
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

        imageObject.setCoords();
        const beforeMatrix = imageObject.calcTransformMatrix() as number[];

        const previousRotation = this.context.getCurrentRotation();
        const previousAngle = imageObject.angle;
        this.context.setCurrentRotation(degrees);

        // Pre-animation: tween around the visual centroid so a quarter
        // turn does not slide the image off the canvas.
        try {
            const centre = imageObject.getCenterPoint();
            imageObject.set({ originX: 'center', originY: 'center' });
            imageObject.setPositionByOrigin(centre, 'center', 'center');
            imageObject.setCoords();
        } catch (error) {
            reportWarning(this.context.options, error, 'rotateImage origin pre-anchor failed.');
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
            this.context.setCurrentRotation(previousRotation);
            if (!this.context.guard.isDisposed()) {
                imageObject.set('angle', previousAngle ?? previousRotation);
                imageObject.setCoords();
                restoreOrigin(imageObject, 'left', 'top');
                this.completeImageTransform(beforeMatrix);
            }
            reportWarning(this.context.options, error, 'rotateImage animation failed.');
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

        // Restore origin to top-left around the post-animation
        // bounding-box top-left so subsequent placement math uses the
        // documented origin.
        try {
            const newTopLeft = computeTopLeftPoint(imageObject);
            imageObject.set({ originX: 'left', originY: 'top' });
            imageObject.setPositionByOrigin(newTopLeft, 'left', 'top');
            imageObject.setCoords();
        } catch (error) {
            reportWarning(this.context.options, error, 'rotateImage origin post-restore failed.');
        }

        try {
            this.completeImageTransform(beforeMatrix);
        } finally {
            // record a snapshot so the new rotation is undoable.
            this.context.saveCanvasState();
        }
    }

    async flipHorizontal(): Promise<void> {
        await this.flipImage('flipX');
    }

    async flipVertical(): Promise<void> {
        await this.flipImage('flipY');
    }

    private async flipImage(property: 'flipX' | 'flipY'): Promise<void> {
        const imageObject = this.context.getOriginalImage();
        if (!imageObject) return;
        if (this.context.guard.isAnimating()) return;
        if (this.context.guard.isDisposed()) return;

        imageObject.setCoords();
        const beforeMatrix = imageObject.calcTransformMatrix() as number[];
        const previousFlipX = imageObject.flipX;
        const previousFlipY = imageObject.flipY;
        const previousOriginX = imageObject.originX ?? 'left';
        const previousOriginY = imageObject.originY ?? 'top';
        const operationName = property === 'flipX' ? 'flipHorizontal' : 'flipVertical';
        let centre: FabricNS.Point | null = null;

        try {
            centre = imageObject.getCenterPoint();
            imageObject.set({ originX: 'center', originY: 'center' });
            imageObject.setPositionByOrigin(centre, 'center', 'center');
            imageObject.set({ [property]: !imageObject[property] });
            imageObject.setCoords();

            const newTopLeft = computeTopLeftPoint(imageObject);
            imageObject.set({ originX: 'left', originY: 'top' });
            imageObject.setPositionByOrigin(newTopLeft, 'left', 'top');
            imageObject.setCoords();
        } catch (error) {
            if (!this.context.guard.isDisposed()) {
                try {
                    imageObject.set({
                        flipX: previousFlipX,
                        flipY: previousFlipY,
                        originX: previousOriginX,
                        originY: previousOriginY,
                    });
                    if (centre) {
                        imageObject.setPositionByOrigin(centre, 'center', 'center');
                    }
                    imageObject.setCoords();
                    this.completeImageTransform(beforeMatrix);
                } catch (rollbackError) {
                    reportWarning(
                        this.context.options,
                        rollbackError,
                        `${operationName} rollback failed.`,
                    );
                }
            }
            reportWarning(this.context.options, error, `${operationName} failed.`);
            return;
        }

        if (this.context.guard.isDisposed()) return;
        this.completeImageTransform(beforeMatrix);
        this.context.saveCanvasState();
    }

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
    async resetImageTransform(): Promise<void> {
        const initialImage = this.context.getOriginalImage();
        if (!initialImage) return;

        initialImage.setCoords();
        const beforeMatrix = initialImage.calcTransformMatrix() as number[];
        const previousOverlaySyncSuppressed = this.context.isOverlaySyncSuppressed();

        this.context.setSuppressSaveState(true);
        this.context.setSuppressOverlaySync(true);
        try {
            await this.scaleImage(1);
            await this.rotateImage(0);
            const imageObject = this.context.getOriginalImage();
            if (imageObject && !this.context.guard.isDisposed()) {
                imageObject.set({ flipX: false, flipY: false });
                imageObject.setCoords();
                this.context.finalizeImageTransformSnap();
            }
        } finally {
            this.context.setSuppressOverlaySync(previousOverlaySyncSuppressed);
            this.context.setSuppressSaveState(false);
        }

        if (this.context.guard.isDisposed()) return;

        if (!this.context.isOverlaySyncSuppressed()) {
            this.context.applyOverlayTransformDelta(beforeMatrix);
        }
        this.context.syncOverlayAfterTransform();

        // single history entry for the whole reset.
        this.context.saveCanvasState();
    }

    /** Run the three post-snap transform phases in their required order. */
    private completeImageTransform(beforeMatrix: number[]): void {
        this.context.finalizeImageTransformSnap();
        if (this.context.isOverlaySyncSuppressed()) return;
        this.context.applyOverlayTransformDelta(beforeMatrix);
        this.context.syncOverlayAfterTransform();
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
