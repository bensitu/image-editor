import { ImageEditorCore, } from '../../core/index.js';
import { historyPlugin, historyPluginRef, } from '../../plugins/history/index.js';
import { transformPlugin, transformPluginRef, } from '../../plugins/transform/index.js';
import { composePlugins } from '../../sdk/index.js';
import { createDomBinding, createDomPlugin, } from '../preset-support.js';
export function createMinimalPreset(fabric, options = {}) {
    const editor = new ImageEditorCore(fabric, options.core);
    const transformDefinition = transformPlugin(options.transform);
    const historyDefinition = options.history === false || options.history === undefined
        ? null
        : historyPlugin(options.history);
    const bindings = Object.freeze({
        transform: createDomBinding(editor, transformPluginRef),
        history: historyDefinition ? createDomBinding(editor, historyPluginRef) : null,
    });
    const domDefinition = createDomPlugin(options.domControls, bindings);
    if (historyDefinition && domDefinition) {
        const apis = editor.install(composePlugins({
            transform: transformDefinition,
            history: historyDefinition,
            domControls: domDefinition,
        }));
        return Object.freeze({ editor, ...apis });
    }
    if (historyDefinition) {
        const apis = editor.install(composePlugins({ transform: transformDefinition, history: historyDefinition }));
        return Object.freeze({ editor, ...apis, domControls: null });
    }
    if (domDefinition) {
        const apis = editor.install(composePlugins({ transform: transformDefinition, domControls: domDefinition }));
        return Object.freeze({ editor, ...apis, history: null });
    }
    const apis = editor.install(composePlugins({ transform: transformDefinition }));
    return Object.freeze({
        editor,
        ...apis,
        history: null,
        domControls: null,
    });
}
export default createMinimalPreset;
//# sourceMappingURL=index.js.map