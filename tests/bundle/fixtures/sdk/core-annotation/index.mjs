import { ImageEditorCore } from '@bensitu/image-editor/core';
import { annotationFoundationPlugin } from '@bensitu/image-editor/plugins/annotation';
import { overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';
import { definePluginRef } from '@bensitu/image-editor/sdk';

export function createAnnotationEditor(fabric, coreOptions, annotationOptions) {
    const editor = new ImageEditorCore(fabric, coreOptions);
    const plan = editor.install([
        overlayFoundationPlugin(),
        annotationFoundationPlugin(annotationOptions),
    ]);
    return { editor, plan, definePluginRef };
}
