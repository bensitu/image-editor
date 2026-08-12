<script lang="ts">
    import { onMount } from 'svelte';
    import * as fabric from 'fabric';
    import type { CoreImageInfo, ImageEditorCore } from '@bensitu/image-editor';
    import type { HistoryPort, HistoryStatus } from '@bensitu/image-editor/plugins/history';
    import type { TransformPluginApi } from '@bensitu/image-editor/plugins/transform';
    import { createMinimalPreset } from '@bensitu/image-editor/presets/minimal';
    import { createSerializedEditorMountCoordinator } from '../../shared/serialized-editor-mount.mjs';

    const emptyHistory: HistoryStatus = {
        isEnabled: true,
        canUndo: false,
        canRedo: false,
        length: 0,
        size: 0,
        position: 0,
        bytes: 0,
        maxBytes: 128 * 1024 * 1024,
    };
    const mountCoordinator = createSerializedEditorMountCoordinator();

    let canvas: HTMLCanvasElement;
    let container: HTMLDivElement;
    let editor: ImageEditorCore | null = null;
    let transform: TransformPluginApi | null = null;
    let history: HistoryPort | null = null;
    let ready = $state(false);
    let running = $state(false);
    let lifecycle = $state('configured');
    let imageInfo = $state<CoreImageInfo | null>(null);
    let historyState = $state<HistoryStatus>(emptyHistory);
    let message = $state<string | null>(null);
    let canEdit = $derived(ready && !running && imageInfo !== null);

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

    function refreshState(): void {
        imageInfo = editor?.getImageInfo() ?? null;
        lifecycle = editor?.getLifecycleState() ?? 'configured';
    }

    onMount(() => {
        let componentMounted = true;
        const lease = mountCoordinator.mount({
            create: () =>
                createMinimalPreset(fabric, {
                    core: {
                        defaultLayoutMode: 'fit',
                        onError(error, detail) {
                            console.error(detail, error);
                            if (componentMounted) message = `Error: ${detail}`;
                        },
                        onWarning(error, detail) {
                            console.warn(detail, error);
                            if (componentMounted) message = `Warning: ${detail}`;
                        },
                    },
                    transform: { animationDuration: 0 },
                    history: {
                        onChange(status) {
                            if (componentMounted) historyState = status;
                        },
                    },
                }),
            initialize: (preset) => preset.editor.init({ canvas, canvasContainer: container }),
            publish(preset) {
                editor = preset.editor;
                transform = preset.transform;
                history = preset.history;
                ready = true;
                refreshState();
            },
            clear() {
                editor = null;
                transform = null;
                history = null;
            },
            dispose: (preset) => preset.editor.disposeAsync(),
            onInitializationError(error) {
                console.error('Editor initialization failed.', error);
                if (componentMounted) message = `Initialization failed: ${errorMessage(error)}`;
            },
            onDisposalError(error) {
                console.error('Editor disposal failed.', error);
            },
        });

        return () => {
            componentMounted = false;
            ready = false;
            lease.release();
        };
    });

    async function run(action: () => Promise<unknown>): Promise<void> {
        running = true;
        try {
            await action();
            refreshState();
            message = null;
        } catch (error) {
            message = `Action failed: ${errorMessage(error)}`;
        } finally {
            running = false;
        }
    }

    async function handleFileChange(event: Event): Promise<void> {
        if (!(event.currentTarget instanceof HTMLInputElement)) return;
        const file = event.currentTarget.files?.[0];
        const current = editor;
        if (!file || !current) return;
        await run(async () => current.loadImage(await readFileAsDataUrl(file)));
        event.currentTarget.value = '';
    }

    function runTransform(action: (api: TransformPluginApi) => Promise<void>): void {
        const api = transform;
        if (api) void run(() => action(api));
    }

    function runHistory(action: (api: HistoryPort) => Promise<void>): void {
        const api = history;
        if (api) void run(() => action(api));
    }

    function exportPng(): void {
        const current = editor;
        if (!current) return;
        void run(async () => {
            const dataUrl = await current.exportImageBase64({ format: 'png', area: 'image' });
            const anchor = document.createElement('a');
            anchor.href = dataUrl;
            anchor.download = 'svelte-edited.png';
            anchor.click();
        });
    }
</script>

<main class="app-shell">
    <header class="top-bar">
        <h1>Svelte minimal preset</h1>
        <input
            aria-label="Load image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={!ready || running}
            onchange={(event) => void handleFileChange(event)}
        />
    </header>

    <section class="editor-layout">
        <div bind:this={container} class="canvas-panel">
            <canvas bind:this={canvas}></canvas>
        </div>

        <aside class="side-panel" aria-label="Editor controls and state">
            <div class="button-grid">
                <button disabled={!canEdit} onclick={() => runTransform((api) => api.zoomIn())}>
                    Zoom in
                </button>
                <button disabled={!canEdit} onclick={() => runTransform((api) => api.zoomOut())}>
                    Zoom out
                </button>
                <button disabled={!canEdit} onclick={() => runTransform((api) => api.rotate(90))}>
                    Rotate
                </button>
                <button
                    disabled={!canEdit}
                    onclick={() => runTransform((api) => api.resetImageTransform())}
                >
                    Reset transform
                </button>
                <button
                    disabled={running || !historyState.canUndo}
                    onclick={() => runHistory((api) => api.undo())}
                >
                    Undo
                </button>
                <button
                    disabled={running || !historyState.canRedo}
                    onclick={() => runHistory((api) => api.redo())}
                >
                    Redo
                </button>
                <button disabled={!canEdit} onclick={exportPng}>Export PNG</button>
            </div>

            <dl class="state-list">
                <div>
                    <dt>Lifecycle</dt>
                    <dd>{lifecycle}</dd>
                </div>
                <div>
                    <dt>Image</dt>
                    <dd>{imageInfo ? `${imageInfo.width} × ${imageInfo.height}` : 'none'}</dd>
                </div>
                <div>
                    <dt>History</dt>
                    <dd>{historyState.position} / {historyState.size}</dd>
                </div>
            </dl>

            {#if message}
                <p class="message">{message}</p>
            {/if}
        </aside>
    </section>
</main>
