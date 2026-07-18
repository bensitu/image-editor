<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import * as fabric from 'fabric';
import type { CoreImageInfo, ImageEditorCore } from '@bensitu/image-editor';
import type { CropPluginApi } from '@bensitu/image-editor/plugins/crop';
import type { HistoryPort, HistoryStatus } from '@bensitu/image-editor/plugins/history';
import type { MaskPluginApi } from '@bensitu/image-editor/plugins/mask';
import { createRedactionPreset } from '@bensitu/image-editor/presets/redaction';

const canvasRef = ref<HTMLCanvasElement | null>(null);
const containerRef = ref<HTMLElement | null>(null);
const ready = ref(false);
const running = ref(false);
const imageInfo = ref<CoreImageInfo | null>(null);
const maskCount = ref(0);
const cropActive = ref(false);
const historyState = ref<HistoryStatus>({
    isEnabled: true,
    canUndo: false,
    canRedo: false,
    length: 0,
    size: 0,
    position: 0,
});
const message = ref<string | null>(null);

let editor: ImageEditorCore | null = null;
let masks: MaskPluginApi | null = null;
let crop: CropPluginApi | null = null;
let history: HistoryPort | null = null;
let mounted = false;

function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') resolve(reader.result);
            else reject(new Error('FileReader did not return a data URL.'));
        };
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read the file.'));
        reader.readAsDataURL(file);
    });
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function refreshState() {
    imageInfo.value = editor?.getImageInfo() ?? null;
    maskCount.value = masks?.getAll().length ?? 0;
    cropActive.value = crop?.isActive ?? false;
}

onMounted(() => {
    mounted = true;
    const canvas = canvasRef.value;
    if (!canvas) return;
    const preset = createRedactionPreset(fabric, {
        core: {
            defaultLayoutMode: 'fit',
            onError(error, detail) {
                console.error(detail, error);
                message.value = `Error: ${detail}`;
            },
        },
        transform: { animationDuration: 0 },
        history: { onChange: (status) => (historyState.value = status) },
        masks: { label: false },
        crop: { paddingPx: 0 },
    });
    editor = preset.editor;
    masks = preset.masks;
    crop = preset.crop;
    history = preset.history;
    void preset.editor
        .init({ canvas, canvasContainer: containerRef.value })
        .then(() => {
            if (!mounted) return;
            ready.value = true;
            refreshState();
        })
        .catch((error: unknown) => {
            if (mounted) message.value = `Initialization failed: ${errorMessage(error)}`;
        });
});

onBeforeUnmount(() => {
    mounted = false;
    ready.value = false;
    const current = editor;
    editor = null;
    masks = null;
    crop = null;
    history = null;
    void current?.disposeAsync().catch((error: unknown) => {
        console.error('Editor disposal failed.', error);
    });
});

async function run(action: () => Promise<unknown>) {
    running.value = true;
    try {
        await action();
        refreshState();
        message.value = null;
    } catch (error) {
        message.value = `Action failed: ${errorMessage(error)}`;
    } finally {
        running.value = false;
    }
}

async function handleFileChange(event: Event) {
    if (!(event.currentTarget instanceof HTMLInputElement)) return;
    const file = event.currentTarget.files?.[0];
    const current = editor;
    if (!file || !current) return;
    await run(async () => current.loadImage(await readFileAsDataUrl(file)));
    event.currentTarget.value = '';
}

function addMask() {
    const api = masks;
    if (api) void run(() => api.create());
}

function enterCrop() {
    const api = crop;
    if (api) void run(() => api.enter());
}

function cancelCrop() {
    const api = crop;
    if (api) void run(() => api.cancel());
}

function undo() {
    const api = history;
    if (api) void run(() => api.undo());
}

function redo() {
    const api = history;
    if (api) void run(() => api.redo());
}

function exportImage(format: 'png' | 'jpeg') {
    const current = editor;
    if (!current) return;
    void run(async () => {
        const dataUrl = await current.exportImageBase64({ area: 'image', format });
        const anchor = document.createElement('a');
        anchor.href = dataUrl;
        anchor.download = `vue-edited.${format === 'jpeg' ? 'jpg' : 'png'}`;
        anchor.click();
    });
}
</script>

<template>
    <main class="app-shell">
        <header class="top-bar">
            <h1>Vue redaction preset</h1>
            <input
                aria-label="Load image"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                :disabled="!ready || running"
                @change="handleFileChange"
            />
        </header>

        <section class="editor-layout">
            <div ref="containerRef" class="canvas-panel">
                <canvas ref="canvasRef"></canvas>
            </div>

            <aside class="side-panel" aria-label="Editor controls and state">
                <div class="button-grid">
                    <button :disabled="!imageInfo || running" @click="addMask">Add mask</button>
                    <button :disabled="!imageInfo || cropActive || running" @click="enterCrop">
                        Enter crop
                    </button>
                    <button :disabled="!cropActive || running" @click="cancelCrop">
                        Cancel crop
                    </button>
                    <button :disabled="running || !historyState.canUndo" @click="undo">Undo</button>
                    <button :disabled="running || !historyState.canRedo" @click="redo">Redo</button>
                    <button :disabled="!imageInfo || running" @click="exportImage('png')">
                        Export PNG
                    </button>
                    <button :disabled="!imageInfo || running" @click="exportImage('jpeg')">
                        Export JPEG
                    </button>
                </div>

                <dl class="state-list">
                    <div>
                        <dt>Image</dt>
                        <dd>
                            {{ imageInfo ? `${imageInfo.width} × ${imageInfo.height}` : 'none' }}
                        </dd>
                    </div>
                    <div>
                        <dt>Crop</dt>
                        <dd>{{ cropActive ? 'active' : 'inactive' }}</dd>
                    </div>
                    <div>
                        <dt>Undo / redo</dt>
                        <dd>{{ historyState.position }} / {{ historyState.size }}</dd>
                    </div>
                    <div>
                        <dt>Masks</dt>
                        <dd>{{ maskCount }}</dd>
                    </div>
                </dl>

                <p v-if="message" class="message">{{ message }}</p>
            </aside>
        </section>
    </main>
</template>
