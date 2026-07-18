# Vue integration

Create the editor in `onMounted`, retain its typed Plugin APIs, and dispose it
in `onBeforeUnmount`. Use Vue handlers to call those APIs directly.

```vue
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import * as fabric from 'fabric';
import type { ImageEditorCore } from '@bensitu/image-editor';
import type { CropPluginApi } from '@bensitu/image-editor/plugins/crop';
import type { MaskPluginApi } from '@bensitu/image-editor/plugins/mask';
import { createRedactionPreset } from '@bensitu/image-editor/presets/redaction';

const canvas = ref<HTMLCanvasElement | null>(null);
const container = ref<HTMLElement | null>(null);
const maskCount = ref(0);
const cropActive = ref(false);

let editor: ImageEditorCore | null = null;
let masks: MaskPluginApi | null = null;
let crop: CropPluginApi | null = null;

onMounted(() => {
    if (!canvas.value) return;
    const preset = createRedactionPreset(fabric, {
        masks: { label: false },
        crop: { paddingPx: 0 },
    });
    editor = preset.editor;
    masks = preset.masks;
    crop = preset.crop;
    void preset.editor.init({ canvas: canvas.value, canvasContainer: container.value });
});

onBeforeUnmount(() => {
    const current = editor;
    editor = null;
    masks = null;
    crop = null;
    void current?.disposeAsync();
});

async function addMask() {
    if (!masks) return;
    await masks.create();
    maskCount.value = masks.getAll().length;
}

async function enterCrop() {
    if (!crop) return;
    await crop.enter();
    cropActive.value = crop.isActive;
}
</script>

<template>
    <section>
        <div ref="container" style="width: 100%; height: 600px">
            <canvas ref="canvas"></canvas>
        </div>
        <button @click="addMask">Add mask ({{ maskCount }})</button>
        <button :disabled="cropActive" @click="enterCrop">Enter crop</button>
    </section>
</template>
```

Plain module variables are suitable for imperative APIs. If an application
stores them in Vue refs, use `shallowRef` and `markRaw` so Vue does not deeply
proxy the editor or Fabric objects. Store immutable Plugin status snapshots in
normal reactive state.

For Nuxt, mount the component under `<ClientOnly>`. The complete runnable
example is in [examples/vue-basic](../../examples/vue-basic).
