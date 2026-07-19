/**
 * Declares Crop configuration, Overlay policy, session, status, and Plugin API contracts.
 *
 * @module
 */

import type { Disposable, VisibleRasterBakeOptions } from '../../sdk/index.js';
import type { CropAspectRatio, CropRect } from './crop-geometry.js';

export type CropOverlayPreviewPolicy = 'keep' | 'hide-participating';
export type CropOverlayApplyPolicy = 'keep' | 'discard' | 'transform-intersecting';

export interface CropOverlayPolicy {
    readonly preview: CropOverlayPreviewPolicy;
    readonly apply: CropOverlayApplyPolicy;
    readonly kinds?: readonly string[];
}

export interface CropEnterOptions {
    readonly rect?: CropRect;
    readonly aspectRatio?: CropAspectRatio;
    readonly overlayPolicy?: CropOverlayPolicy;
}

export interface CropApplyOptions extends VisibleRasterBakeOptions {
    readonly bakeVisibleFilters?: boolean;
}

export interface CropPluginOptions {
    readonly paddingPx?: number;
    readonly minimumWidthPx?: number;
    readonly minimumHeightPx?: number;
}

export interface CropConfiguration {
    readonly paddingPx: number;
    readonly minimumWidthPx: number;
    readonly minimumHeightPx: number;
}

export interface CropSessionState {
    readonly rect: CropRect;
    readonly aspectRatio: number | null;
    readonly sourceRevision: number;
    readonly sourceWidthPx: number;
    readonly sourceHeightPx: number;
    readonly overlayPolicy: CropOverlayPolicy;
}

export interface CropStatus {
    readonly isActive: boolean;
    readonly session: Readonly<CropSessionState> | null;
}

export type CropStatusListener = (status: CropStatus) => void;

export interface CropPluginApi {
    readonly isActive: boolean;
    enter(options?: CropEnterOptions): Promise<void>;
    updateRect(rect: CropRect): Promise<void>;
    setAspectRatio(ratio: CropAspectRatio): Promise<void>;
    apply(options?: CropApplyOptions): Promise<void>;
    cancel(): Promise<void>;
    getSession(): Readonly<CropSessionState> | null;
    subscribe(listener: CropStatusListener): Disposable;
}
