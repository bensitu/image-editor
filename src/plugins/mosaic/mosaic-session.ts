/**
 * Declares Mosaic configuration, session, commit, status, and Plugin API contracts.
 *
 * @module
 */

import type { Disposable } from '../../sdk/index.js';
import type { DirtyRectangle, MosaicImagePoint } from './mosaic-brush.js';

/** Encoder selection for a committed Mosaic raster. */
export type MosaicOutputFormat = 'source' | 'png' | 'jpeg' | 'webp';

/** Canvas presentation for the transient Mosaic brush indicator. */
export interface MosaicBrushPreviewStyle {
    readonly stroke: string | null;
    readonly strokeWidth: number;
    readonly strokeDashArray: readonly number[] | null;
    readonly fill: string;
}

/** Fully normalized Mosaic brush, encoding, and resource configuration. */
export interface MosaicConfiguration {
    readonly brushSizePx: number;
    readonly pixelBlockSizePx: number;
    readonly format: MosaicOutputFormat;
    readonly quality: number;
    readonly maxPointCount: number;
    readonly preview: Readonly<MosaicBrushPreviewStyle>;
}

/** Partial Mosaic configuration accepted at construction or runtime. */
export interface MosaicConfigurationPatch {
    readonly brushSizePx?: number;
    readonly pixelBlockSizePx?: number;
    readonly format?: MosaicOutputFormat;
    readonly quality?: number;
    readonly maxPointCount?: number;
    readonly preview?: Partial<MosaicBrushPreviewStyle>;
}

/** Construction options for the Mosaic Plugin. */
export type MosaicPluginOptions = MosaicConfigurationPatch;

/** Optional configuration overrides for one Mosaic session. */
export interface MosaicEnterOptions {
    readonly configuration?: MosaicConfigurationPatch;
}

/** Controls encoding and visible-raster baking during Mosaic commit. */
export interface MosaicCommitOptions {
    readonly format?: MosaicOutputFormat;
    readonly quality?: number;
    readonly bakeVisibleFilters?: boolean;
}

/** Immutable snapshot of the active Mosaic session. */
export interface MosaicSessionState {
    readonly sourceRevision: number;
    readonly sourceWidthPx: number;
    readonly sourceHeightPx: number;
    readonly strokeCount: number;
    readonly pointCount: number;
    readonly isStrokeActive: boolean;
    readonly dirtyRectangle: DirtyRectangle | null;
    readonly configuration: Readonly<MosaicConfiguration>;
}

/** Observable Mosaic Plugin status. */
export interface MosaicStatus {
    readonly isActive: boolean;
    readonly session: Readonly<MosaicSessionState> | null;
}

/** Listener invoked when Mosaic session status changes. */
export type MosaicStatusListener = (status: MosaicStatus) => void;

/** Public Mosaic authoring, configuration, and commit operations. */
export interface MosaicPluginApi {
    /** Reports whether a Mosaic session is active. */
    readonly isActive: boolean;
    /** Starts a transient Mosaic session. */
    enter(options?: MosaicEnterOptions): Promise<void>;
    /** Starts a brush stroke at a natural-image coordinate. */
    beginStroke(point: MosaicImagePoint): Promise<void>;
    /** Appends a natural-image coordinate to the active stroke. */
    appendStroke(point: MosaicImagePoint): Promise<void>;
    /** Finalizes the active transient stroke. */
    endStroke(): Promise<void>;
    /** Bakes completed strokes into the Base Image as one mutation. */
    commit(options?: MosaicCommitOptions): Promise<void>;
    /** Discards all transient Mosaic strokes. */
    cancel(): Promise<void>;
    /** Updates Mosaic configuration and refreshes an active session. */
    configure(patch: MosaicConfigurationPatch): Promise<void>;
    /** Returns immutable normalized Mosaic configuration. */
    getConfiguration(): Readonly<MosaicConfiguration>;
    /** Returns the current session snapshot, or `null` when inactive. */
    getSession(): Readonly<MosaicSessionState> | null;
    /** Subscribes to Mosaic session status changes. */
    subscribe(listener: MosaicStatusListener): Disposable;
}

export type { DirtyRectangle, MosaicImagePoint } from './mosaic-brush.js';
