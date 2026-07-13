import { ImageEditorCore } from '../core-runtime/image-editor-core.js';
import { overlayFoundationPlugin } from '../foundations/overlay/index.js';
import { historyPlugin } from '../plugins/history/index.js';
import { maskPlugin } from '../plugins/mask/index.js';
import { transformPlugin } from '../plugins/transform/index.js';
import { adaptLegacyOptions } from './legacy-options-adapter.js';
export function createFullCompatibilityComposition(fabric, options, legacyFeatures) {
    const mapped = adaptLegacyOptions(options);
    const core = new ImageEditorCore(fabric, mapped.core);
    try {
        const history = core.use(historyPlugin(mapped.history));
        core.use(overlayFoundationPlugin());
        const transform = core.use(transformPlugin(mapped.transform));
        const masks = core.use(maskPlugin(mapped.mask));
        let disposePromise = null;
        let disposeStarted = false;
        const disposeCore = () => {
            core.dispose();
            return core.disposeAsync();
        };
        const beginAsyncDispose = () => {
            if (disposePromise)
                return disposePromise;
            if (disposeStarted)
                return core.disposeAsync();
            disposeStarted = true;
            try {
                const legacyDispose = legacyFeatures.dispose();
                disposePromise =
                    legacyDispose && typeof legacyDispose.then === 'function'
                        ? Promise.resolve(legacyDispose).then(disposeCore)
                        : disposeCore();
            }
            catch (error) {
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
            dispose() {
                if (disposeStarted)
                    return disposePromise !== null && disposePromise !== void 0 ? disposePromise : undefined;
                disposeStarted = true;
                try {
                    const legacyDispose = legacyFeatures.dispose();
                    if (legacyDispose && typeof legacyDispose.then === 'function') {
                        disposePromise = Promise.resolve(legacyDispose).then(() => core.disposeAsync());
                        return disposePromise;
                    }
                    disposePromise = disposeCore();
                    return disposePromise;
                }
                catch (error) {
                    disposePromise = core.disposeAsync().then(() => Promise.reject(error));
                    return disposePromise;
                }
            },
            disposeAsync() {
                return beginAsyncDispose();
            },
        });
    }
    catch (error) {
        core.dispose();
        throw error;
    }
}
//# sourceMappingURL=full-composition.js.map