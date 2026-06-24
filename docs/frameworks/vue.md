# Vue integration

Install the editor and its Fabric peer dependency:

```bash
npm install @bensitu/image-editor fabric
```

The core package is framework-agnostic. In Vue, create the editor in `onMounted`, pass HTMLElement refs to `init()`, and dispose it in `onBeforeUnmount`. Use `shallowRef` and `markRaw` so Vue does not deep-reactivize the editor instance or Fabric objects.

For Nuxt or SSR, render the editor inside `<ClientOnly>` and initialize it only from `onMounted`.

## Composable example

```ts
import { markRaw, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import * as fabric from 'fabric';
import { ImageEditor } from '@bensitu/image-editor';
import type { ImageEditorOptions, ImageEditorState } from '@bensitu/image-editor';

export function useImageEditor(options: ImageEditorOptions = {}) {
    const canvasRef = ref<HTMLCanvasElement | null>(null);
    const containerRef = ref<HTMLElement | null>(null);
    const editor = shallowRef<ImageEditor | null>(null);
    const state = shallowRef<ImageEditorState | null>(null);
    const busy = ref(false);

    onMounted(() => {
        const canvas = canvasRef.value;
        if (!canvas) return;

        const instance = markRaw(
            new ImageEditor(fabric, {
                ...options,
                onImageChanged: (nextState, context) => {
                    state.value = nextState;
                    options.onImageChanged?.(nextState, context);
                },
                onBusyChange: (isBusy, context) => {
                    busy.value = isBusy;
                    options.onBusyChange?.(isBusy, context);
                },
            }),
        );

        instance.init({
            canvas,
            canvasContainer: containerRef.value,
            zoomInButton: null,
            zoomOutButton: null,
            imageInput: null,
            maskList: null,
            annotationList: null,
        });

        editor.value = instance;
    });

    onBeforeUnmount(() => {
        editor.value?.dispose();
        editor.value = null;
    });

    return {
        canvasRef,
        containerRef,
        editor,
        state,
        busy,
    };
}
```

## SFC example

```vue
<script setup lang="ts">
import { useImageEditor } from './useImageEditor';

const { canvasRef, containerRef, editor, busy } = useImageEditor({
    canvasWidth: 800,
    canvasHeight: 600,
    defaultLayoutMode: 'fit',
});
</script>

<template>
    <section>
        <div ref="containerRef" style="width: 100%; height: 600px">
            <canvas ref="canvasRef"></canvas>
        </div>

        <button :disabled="busy" @click="editor?.scaleImage(1.1)">Zoom In</button>
        <button :disabled="busy" @click="editor?.rotateImage(90)">Rotate</button>
        <button :disabled="busy" @click="editor?.resizeToContainer()">Fit Container</button>
    </section>
</template>
```

## State guidance

Keep `ImageEditor` in a `shallowRef` and wrap the instance with `markRaw`. Store `ImageEditorState` snapshots or serializable view-model data, not Fabric objects.

## Responsive layout

Call `editor.value?.resizeToContainer()` after tabs, dialogs, or accordions reveal the editor. Use `editor.value?.relayout()` when the host layout changed and the editor should refresh canvas geometry for the existing image without reloading it.
