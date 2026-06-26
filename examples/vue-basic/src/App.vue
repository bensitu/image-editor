<script setup lang="ts">
import { markRaw, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import * as fabric from 'fabric';
import { ImageEditor } from '@bensitu/image-editor';
import type {
    EditorToolMode,
    ImageEditorSelection,
    ImageEditorState,
    ImageInfo,
} from '@bensitu/image-editor';

const emptySelection: ImageEditorSelection = {
    selectedMask: null,
    selectedMasks: [],
    selectedAnnotation: null,
    selectedAnnotations: [],
    selectedObjectKind: null,
};

const canvasRef = ref<HTMLCanvasElement | null>(null);
const containerRef = ref<HTMLElement | null>(null);
const editorRef = shallowRef<ImageEditor | null>(null);
const editorState = ref<ImageEditorState | null>(null);
const imageInfo = ref<ImageInfo | null>(null);
const selection = ref<ImageEditorSelection>(emptySelection);
const activeToolMode = ref<EditorToolMode | null>(null);
const historyState = ref({ canUndo: false, canRedo: false });
const maskCount = ref(0);
const lastOperation = ref('none');
const message = ref<string | null>(null);

function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
                return;
            }
            reject(new Error('FileReader did not return a data URL.'));
        };
        reader.onerror = () => {
            reject(reader.error ?? new Error('Failed to read the selected file.'));
        };
        reader.readAsDataURL(file);
    });
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function refreshPublicState(editor: ImageEditor) {
    const nextState = editor.getEditorState();
    editorState.value = nextState;
    imageInfo.value = editor.getImageInfo();
    selection.value = editor.getSelection();
    activeToolMode.value = editor.getActiveToolMode();
    historyState.value = { canUndo: nextState.canUndo, canRedo: nextState.canRedo };
    maskCount.value = editor.getMasks().length;
}

onMounted(() => {
    if (!canvasRef.value) return;

    const editor = markRaw(
        new ImageEditor(fabric, {
            defaultLayoutMode: 'fit',
            onImageChanged(state, context) {
                editorState.value = state;
                lastOperation.value = context.operation;
                const currentEditor = editorRef.value;
                if (currentEditor) {
                    imageInfo.value = currentEditor.getImageInfo();
                    selection.value = currentEditor.getSelection();
                    maskCount.value = currentEditor.getMasks().length;
                }
            },
            onToolModeChange(activeToolModeValue, previousToolMode, context) {
                activeToolMode.value = activeToolModeValue;
                lastOperation.value = `${context.operation}: ${previousToolMode ?? 'none'} -> ${
                    activeToolModeValue ?? 'none'
                }`;
            },
            onHistoryChange(history, context) {
                historyState.value = history;
                lastOperation.value = context.operation;
            },
            onSelectionChange(selectionValue, context) {
                selection.value = selectionValue;
                lastOperation.value = context.operation;
            },
            onError(error, warningMessage) {
                console.error(warningMessage, error);
                message.value = `Error: ${warningMessage}`;
            },
            onWarning(error, warningMessage) {
                console.warn(warningMessage, error);
                message.value = `Warning: ${warningMessage}`;
            },
        }),
    );

    editorRef.value = editor;
    editor.init({
        canvas: canvasRef.value,
        canvasContainer: containerRef.value,
    });
    refreshPublicState(editor);
});

onBeforeUnmount(() => {
    editorRef.value?.dispose();
    editorRef.value = null;
});

async function runEditorAction(action: (editor: ImageEditor) => unknown | Promise<unknown>) {
    const editor = editorRef.value;
    if (!editor) return;

    try {
        await action(editor);
        refreshPublicState(editor);
        message.value = null;
    } catch (error) {
        console.error(error);
        message.value = `Action failed: ${getErrorMessage(error)}`;
    }
}

async function handleFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement | null;
    const file = input?.files?.[0];
    const editor = editorRef.value;
    if (!file || !editor) return;

    try {
        const dataUrl = await readFileAsDataUrl(file);
        await editor.loadImage(dataUrl);
        refreshPublicState(editor);
        message.value = null;
    } catch (error) {
        console.error(error);
        message.value = `Image load failed: ${getErrorMessage(error)}`;
    } finally {
        if (input) input.value = '';
    }
}
</script>

<template>
    <main class="app-shell">
        <header class="top-bar">
            <h1>Vue ImageEditor</h1>
            <input
                aria-label="Load image"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                @change="handleFileChange"
            />
        </header>

        <section class="editor-layout">
            <div ref="containerRef" class="canvas-panel">
                <canvas ref="canvasRef"></canvas>
            </div>

            <aside class="side-panel" aria-label="Editor controls and state">
                <div class="button-grid">
                    <button
                        :disabled="!editorRef || !editorState?.hasImage || editorState.isBusy"
                        @click="runEditorAction((editor) => editor.createMask())"
                    >
                        Add mask
                    </button>
                    <button
                        :disabled="!editorRef || !editorState?.hasImage || editorState.isBusy"
                        @click="runEditorAction((editor) => editor.enterCropMode())"
                    >
                        Enter crop
                    </button>
                    <button
                        :disabled="activeToolMode !== 'crop'"
                        @click="runEditorAction((editor) => editor.cancelCrop())"
                    >
                        Cancel crop
                    </button>
                    <button
                        :disabled="!editorRef || !!editorState?.isBusy || !historyState.canUndo"
                        @click="runEditorAction((editor) => editor.undo())"
                    >
                        Undo
                    </button>
                    <button
                        :disabled="!editorRef || !!editorState?.isBusy || !historyState.canRedo"
                        @click="runEditorAction((editor) => editor.redo())"
                    >
                        Redo
                    </button>
                    <button
                        :disabled="!editorRef || !editorState?.hasImage || editorState.isBusy"
                        @click="
                            runEditorAction((editor) =>
                                editor.downloadImage({ fileType: 'png', fileName: 'vue-edited' }),
                            )
                        "
                    >
                        Export PNG
                    </button>
                    <button
                        :disabled="!editorRef || !editorState?.hasImage || editorState.isBusy"
                        @click="
                            runEditorAction((editor) =>
                                editor.downloadImage({ fileType: 'jpeg', fileName: 'vue-edited' }),
                            )
                        "
                    >
                        Export JPEG
                    </button>
                </div>

                <dl class="state-list">
                    <div>
                        <dt>Image</dt>
                        <dd>
                            {{ imageInfo ? `${imageInfo.width} x ${imageInfo.height}` : 'none' }}
                        </dd>
                    </div>
                    <div>
                        <dt>Tool mode</dt>
                        <dd>{{ activeToolMode ?? 'none' }}</dd>
                    </div>
                    <div>
                        <dt>Undo / redo</dt>
                        <dd>
                            {{ historyState.canUndo ? 'undo' : 'no undo' }} /
                            {{ historyState.canRedo ? 'redo' : 'no redo' }}
                        </dd>
                    </div>
                    <div>
                        <dt>Masks</dt>
                        <dd>{{ maskCount }}</dd>
                    </div>
                    <div>
                        <dt>Annotations</dt>
                        <dd>{{ editorState?.annotationCount ?? 0 }}</dd>
                    </div>
                    <div>
                        <dt>Selection</dt>
                        <dd>{{ selection.selectedObjectKind ?? 'none' }}</dd>
                    </div>
                    <div>
                        <dt>Last operation</dt>
                        <dd>{{ lastOperation }}</dd>
                    </div>
                </dl>

                <p v-if="message" class="message">{{ message }}</p>
            </aside>
        </section>
    </main>
</template>
