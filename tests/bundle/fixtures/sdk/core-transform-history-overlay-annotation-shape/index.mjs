import { ImageEditorCore } from '@bensitu/image-editor/core';
import { annotationFoundationPlugin } from '@bensitu/image-editor/plugins/annotation';
import { shapeAnnotationPlugin } from '@bensitu/image-editor/plugins/annotation-shape';
import { historyPlugin } from '@bensitu/image-editor/plugins/history';
import { overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';
import { transformPlugin } from '@bensitu/image-editor/plugins/transform';

export function createShapeAnnotationEditor(fabric, coreOptions) {
    const editor = new ImageEditorCore(fabric, coreOptions);
    const plan = editor.install([
        transformPlugin(),
        historyPlugin(),
        overlayFoundationPlugin(),
        annotationFoundationPlugin(),
        shapeAnnotationPlugin(),
    ]);
    return { editor, plan };
}
