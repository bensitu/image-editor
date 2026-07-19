/**
 * Declares Mosaic configuration, session, commit, status, and Plugin API contracts.
 *
 * @module
 */
import type { Disposable } from '../../sdk/index.js';
import type { DirtyRectangle, MosaicImagePoint } from './mosaic-brush.js';
export type MosaicOutputFormat = 'source' | 'png' | 'jpeg' | 'webp';
export interface MosaicConfiguration {
    readonly brushSizePx: number;
    readonly pixelBlockSizePx: number;
    readonly format: MosaicOutputFormat;
    readonly quality: number;
    readonly maxPointCount: number;
}
export interface MosaicPluginOptions {
    readonly brushSizePx?: number;
    readonly pixelBlockSizePx?: number;
    readonly format?: MosaicOutputFormat;
    readonly quality?: number;
    readonly maxPointCount?: number;
}
export interface MosaicEnterOptions {
    readonly configuration?: Partial<MosaicConfiguration>;
}
export interface MosaicCommitOptions {
    readonly format?: MosaicOutputFormat;
    readonly quality?: number;
    readonly bakeVisibleFilters?: boolean;
}
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
export interface MosaicStatus {
    readonly isActive: boolean;
    readonly session: Readonly<MosaicSessionState> | null;
}
export type MosaicStatusListener = (status: MosaicStatus) => void;
export interface MosaicPluginApi {
    readonly isActive: boolean;
    enter(options?: MosaicEnterOptions): Promise<void>;
    beginStroke(point: MosaicImagePoint): Promise<void>;
    appendStroke(point: MosaicImagePoint): Promise<void>;
    endStroke(): Promise<void>;
    commit(options?: MosaicCommitOptions): Promise<void>;
    cancel(): Promise<void>;
    configure(patch: Partial<MosaicConfiguration>): Promise<void>;
    getConfiguration(): Readonly<MosaicConfiguration>;
    getSession(): Readonly<MosaicSessionState> | null;
    subscribe(listener: MosaicStatusListener): Disposable;
}
export type { DirtyRectangle, MosaicImagePoint } from './mosaic-brush.js';
