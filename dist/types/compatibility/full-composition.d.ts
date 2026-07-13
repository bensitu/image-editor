import { ImageEditorCore } from '../core-runtime/image-editor-core.js';
import type { FabricModule, ResolvedOptions } from '../core/public-types.js';
import { type HistoryPort } from '../plugins/history/index.js';
import { type MaskPluginApi } from '../plugins/mask/index.js';
import { type TransformPluginApi } from '../plugins/transform/index.js';
import type { LegacyFeatureCompatibilityPort } from './legacy-feature-runtime.js';
export interface FullCompatibilityComposition {
    readonly core: ImageEditorCore;
    readonly history: HistoryPort;
    readonly transform: TransformPluginApi;
    readonly masks: MaskPluginApi;
    readonly legacyFeatures: LegacyFeatureCompatibilityPort;
    dispose(): void | Promise<void>;
    disposeAsync(): Promise<void>;
}
/** Creates the internal Full composition without initializing a Canvas. */
export declare function createFullCompatibilityComposition(fabric: FabricModule, options: ResolvedOptions, legacyFeatures: LegacyFeatureCompatibilityPort): FullCompatibilityComposition;
