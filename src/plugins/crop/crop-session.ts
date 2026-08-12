/**
 * Declares Crop configuration, Overlay policy, session, status, and Plugin API contracts.
 *
 * @module
 */

import type { Disposable, VisibleRasterBakeOptions } from '../../sdk/index.js';
import type { CropAspectRatio, CropRect } from './crop-geometry.js';

/** Presentation policy for persistent Overlays while a Crop session is active. */
export type CropOverlayPreviewPolicy = 'keep' | 'hide-participating';
/** Commit policy for persistent Overlays when Crop is applied. */
export type CropOverlayApplyPolicy = 'keep' | 'discard' | 'transform-intersecting';

/** Selects how Crop preview and commit affect matching Overlay kinds. */
export interface CropOverlayPolicy {
    readonly preview: CropOverlayPreviewPolicy;
    readonly apply: CropOverlayApplyPolicy;
    readonly kinds?: readonly string[];
}

/** Initial geometry, ratio, rotation, and Overlay policy for a Crop session. */
export interface CropEnterOptions {
    readonly rect?: CropRect;
    readonly aspectRatio?: CropAspectRatio;
    readonly rotationDegrees?: number;
    readonly overlayPolicy?: CropOverlayPolicy;
}

/** Controls visible-raster baking during Crop commit. */
export interface CropApplyOptions extends VisibleRasterBakeOptions {
    /** Bakes compatible visible raster effects before Crop is applied. */
    readonly bakeVisibleFilters?: boolean;
}

/** Configures Crop preview bounds and rotation behavior. */
export interface CropPluginOptions {
    /** Gap between the initial Crop rectangle and image bounds. */
    readonly paddingPx?: number;
    /** Minimum natural-pixel Crop width. */
    readonly minimumWidthPx?: number;
    /** Minimum natural-pixel Crop height. */
    readonly minimumHeightPx?: number;
    /** Enables programmatic and interactive Crop rectangle rotation. @defaultValue `false` */
    readonly rotatable?: boolean;
}

/** Fully normalized Crop Plugin configuration. */
export interface CropConfiguration {
    readonly paddingPx: number;
    readonly minimumWidthPx: number;
    readonly minimumHeightPx: number;
    readonly rotatable: boolean;
}

/** Immutable snapshot of the active Crop session. */
export interface CropSessionState {
    readonly rect: CropRect;
    readonly aspectRatio: number | null;
    readonly rotationDegrees: number;
    readonly sourceRevision: number;
    readonly sourceWidthPx: number;
    readonly sourceHeightPx: number;
    readonly overlayPolicy: CropOverlayPolicy;
}

/** Observable Crop Plugin status. */
export interface CropStatus {
    readonly isActive: boolean;
    readonly session: Readonly<CropSessionState> | null;
}

/** Listener invoked when Crop session status changes. */
export type CropStatusListener = (status: CropStatus) => void;

/** Public Crop session and commit operations. */
export interface CropPluginApi {
    /** Reports whether a Crop session is active. */
    readonly isActive: boolean;
    /** Starts a transient Crop session. */
    enter(options?: CropEnterOptions): Promise<void>;
    /** Replaces the active Crop rectangle. */
    updateRect(rect: CropRect): Promise<void>;
    /** Applies an aspect ratio to the active Crop rectangle. */
    setAspectRatio(ratio: CropAspectRatio): Promise<void>;
    /** Rotates the active Crop rectangle when rotation is enabled. */
    setRotation(degrees: number): Promise<void>;
    /** Commits the active Crop as one document mutation. */
    apply(options?: CropApplyOptions): Promise<void>;
    /** Discards the transient Crop session. */
    cancel(): Promise<void>;
    /** Returns the current session snapshot, or `null` when inactive. */
    getSession(): Readonly<CropSessionState> | null;
    /** Subscribes to Crop session status changes. */
    subscribe(listener: CropStatusListener): Disposable;
}
