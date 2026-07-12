import type { CoreEventMap, ImageMimeType } from '../core-runtime/public-types.js';
import type { ResolvedImageFilterConfig } from '../core/public-types.js';
import { type SynchronousEditorPlugin } from '../plugin-kernel/index.js';
export interface FullFacadeMementoState {
    readonly currentScale: number;
    readonly currentRotation: number;
    readonly baseImageScale: number;
    readonly imageMimeType: ImageMimeType | null;
    readonly annotationCounter: number;
    readonly imageFilterConfig: ResolvedImageFilterConfig;
    readonly lastCommittedImageFilterConfig: ResolvedImageFilterConfig;
    readonly selectedAnnotationIds: readonly number[];
}
export interface FullFacadeStatePluginAccess {
    capture(): FullFacadeMementoState;
    restore(state: FullFacadeMementoState): void | Promise<void>;
    clearState(): void | Promise<void>;
}
export declare const fullFacadeStatePluginRef: import("../plugin-kernel/plugin-ref.js").PluginRef<Record<string, never>>;
export declare function fullFacadeStatePlugin(access: FullFacadeStatePluginAccess): SynchronousEditorPlugin<Record<string, never>, CoreEventMap>;
