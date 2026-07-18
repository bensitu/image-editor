import { ImageEditorCore } from '@bensitu/image-editor/core';
import { historyPlugin } from '@bensitu/image-editor/plugins/history';

export function createHistoryEditor(fabric, coreOptions, pluginOptions) {
    const editor = new ImageEditorCore(fabric, coreOptions);
    const history = editor.use(historyPlugin(pluginOptions));
    return { editor, history };
}
