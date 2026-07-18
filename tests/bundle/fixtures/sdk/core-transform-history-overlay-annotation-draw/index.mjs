import { ImageEditorCore } from '@bensitu/image-editor/core';
import { annotationFoundationPlugin } from '@bensitu/image-editor/plugins/annotation';
import { drawAnnotationPlugin } from '@bensitu/image-editor/plugins/annotation-draw';
import { historyPlugin } from '@bensitu/image-editor/plugins/history';
import { overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';
import { transformPlugin } from '@bensitu/image-editor/plugins/transform';

export function createDrawAnnotationEditor(fabric, coreOptions) {
    const editor = new ImageEditorCore(fabric, coreOptions);
    const plan = editor.install([
        transformPlugin(),
        historyPlugin(),
        overlayFoundationPlugin(),
        annotationFoundationPlugin(),
        drawAnnotationPlugin(),
    ]);
    return { editor, plan };
}
