import type { ImageEditorCoreOptions } from '../core-runtime/public-types.js';
import type { ResolvedOptions } from '../core/public-types.js';
import type { HistoryPluginOptions } from '../plugins/history/index.js';
import type { MaskPluginOptions } from '../plugins/mask/index.js';
import type { TransformPluginOptions } from '../plugins/transform/index.js';
export interface FullCompatibilityOptions {
    readonly core: ImageEditorCoreOptions;
    readonly history: HistoryPluginOptions;
    readonly transform: TransformPluginOptions;
    readonly mask: MaskPluginOptions;
}
export declare function adaptLegacyOptions(options: ResolvedOptions): FullCompatibilityOptions;
