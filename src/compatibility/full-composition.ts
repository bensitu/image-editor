import { ImageEditorCore } from '../core-runtime/image-editor-core.js';
import type { FabricModule, ResolvedOptions } from '../core/public-types.js';
import { overlayFoundationPlugin } from '../foundations/overlay/index.js';
import { historyPlugin, type HistoryPort } from '../plugins/history/index.js';
import { maskPlugin, type MaskPluginApi } from '../plugins/mask/index.js';
import { transformPlugin, type TransformPluginApi } from '../plugins/transform/index.js';
import type { LegacyFeatureCompatibilityPort } from './legacy-feature-runtime.js';
import { adaptLegacyOptions } from './legacy-options-adapter.js';

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
export function createFullCompatibilityComposition(
    fabric: FabricModule,
    options: ResolvedOptions,
    legacyFeatures: LegacyFeatureCompatibilityPort,
): FullCompatibilityComposition {
    const mapped = adaptLegacyOptions(options);
    const core = new ImageEditorCore(fabric, mapped.core);
    try {
        const history = core.use(historyPlugin(mapped.history));
        core.use(overlayFoundationPlugin());
        const transform = core.use(transformPlugin(mapped.transform));
        const masks = core.use(maskPlugin(mapped.mask));
        let disposePromise: Promise<void> | null = null;
        let disposeStarted = false;
        const disposeCore = (): Promise<void> => {
            core.dispose();
            return core.disposeAsync();
        };

        const beginAsyncDispose = (): Promise<void> => {
            if (disposePromise) return disposePromise;
            if (disposeStarted) return core.disposeAsync();
            disposeStarted = true;
            try {
                const legacyDispose = legacyFeatures.dispose();
                disposePromise =
                    legacyDispose && typeof legacyDispose.then === 'function'
                        ? Promise.resolve(legacyDispose).then(disposeCore)
                        : disposeCore();
            } catch (error) {
                disposePromise = core.disposeAsync().then(() => Promise.reject(error));
            }
            return disposePromise;
        };

        return Object.freeze({
            core,
            history,
            transform,
            masks,
            legacyFeatures,
            dispose(): void | Promise<void> {
                if (disposeStarted) return disposePromise ?? undefined;
                disposeStarted = true;
                try {
                    const legacyDispose = legacyFeatures.dispose();
                    if (legacyDispose && typeof legacyDispose.then === 'function') {
                        disposePromise = Promise.resolve(legacyDispose).then(() =>
                            core.disposeAsync(),
                        );
                        return disposePromise;
                    }
                    disposePromise = disposeCore();
                    return disposePromise;
                } catch (error) {
                    disposePromise = core.disposeAsync().then(() => Promise.reject(error));
                    return disposePromise;
                }
            },
            disposeAsync(): Promise<void> {
                return beginAsyncDispose();
            },
        });
    } catch (error) {
        core.dispose();
        throw error;
    }
}
