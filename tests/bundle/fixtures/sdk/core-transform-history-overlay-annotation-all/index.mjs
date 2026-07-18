import { ImageEditorCore } from '@bensitu/image-editor/core';
import { annotationFoundationPlugin } from '@bensitu/image-editor/plugins/annotation';
import { drawAnnotationPlugin } from '@bensitu/image-editor/plugins/annotation-draw';
import { shapeAnnotationPlugin } from '@bensitu/image-editor/plugins/annotation-shape';
import { textAnnotationPlugin } from '@bensitu/image-editor/plugins/annotation-text';
import { historyPlugin } from '@bensitu/image-editor/plugins/history';
import { overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';
import { transformPlugin } from '@bensitu/image-editor/plugins/transform';

export function createAnnotationEditor(fabric, coreOptions) {
    const editor = new ImageEditorCore(fabric, coreOptions);
    const plan = editor.install([
        transformPlugin(),
        historyPlugin(),
        overlayFoundationPlugin(),
        annotationFoundationPlugin(),
        textAnnotationPlugin(),
        shapeAnnotationPlugin(),
        drawAnnotationPlugin(),
    ]);
    return { editor, plan };
}
