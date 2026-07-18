import { ImageEditorCore } from '@bensitu/image-editor/core';
import { filtersPlugin } from '@bensitu/image-editor/plugins/filters';

export function createFiltersEditor(fabric, coreOptions, pluginOptions) {
    const editor = new ImageEditorCore(fabric, coreOptions);
    const filters = editor.use(filtersPlugin(pluginOptions));
    return { editor, filters };
}
