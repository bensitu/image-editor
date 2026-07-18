'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { CoreImageInfo, ImageEditorCore } from '@bensitu/image-editor';
import type { CropPluginApi } from '@bensitu/image-editor/plugins/crop';
import type { HistoryPort, HistoryStatus } from '@bensitu/image-editor/plugins/history';
import type { MaskPluginApi } from '@bensitu/image-editor/plugins/mask';

const emptyHistory: HistoryStatus = {
    isEnabled: true,
    canUndo: false,
    canRedo: false,
    length: 0,
    size: 0,
    position: 0,
};

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

export default function ImageEditorClient() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const editorRef = useRef<ImageEditorCore | null>(null);
    const masksRef = useRef<MaskPluginApi | null>(null);
    const cropRef = useRef<CropPluginApi | null>(null);
    const historyRef = useRef<HistoryPort | null>(null);
    const [ready, setReady] = useState(false);
    const [running, setRunning] = useState(false);
    const [imageInfo, setImageInfo] = useState<CoreImageInfo | null>(null);
    const [maskCount, setMaskCount] = useState(0);
    const [cropActive, setCropActive] = useState(false);
    const [historyState, setHistoryState] = useState<HistoryStatus>(emptyHistory);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        let disposed = false;
        let ownedEditor: ImageEditorCore | null = null;

        async function setup() {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const [fabric, presets] = await Promise.all([
                import('fabric'),
                import('@bensitu/image-editor/presets/redaction'),
            ]);
            if (disposed) return;
            const preset = presets.createRedactionPreset(fabric, {
                core: {
                    defaultLayoutMode: 'fit',
                    onError(error, detail) {
                        console.error(detail, error);
                        setMessage(`Error: ${detail}`);
                    },
                },
                transform: { animationDuration: 0 },
                history: { onChange: setHistoryState },
                masks: { label: false },
                crop: { paddingPx: 0 },
            });
            ownedEditor = preset.editor;
            editorRef.current = preset.editor;
            masksRef.current = preset.masks;
            cropRef.current = preset.crop;
            historyRef.current = preset.history;
            await preset.editor.init({ canvas, canvasContainer: containerRef.current });
            if (disposed) {
                const current = ownedEditor;
                ownedEditor = null;
                await current?.disposeAsync();
                return;
            }
            setReady(true);
        }

        void setup().catch((error: unknown) => {
            const current = ownedEditor;
            ownedEditor = null;
            void current?.disposeAsync().catch((disposeError: unknown) => {
                console.error('Editor disposal failed.', disposeError);
            });
            if (!disposed) setMessage(`Initialization failed: ${errorMessage(error)}`);
        });

        return () => {
            disposed = true;
            setReady(false);
            editorRef.current = null;
            masksRef.current = null;
            cropRef.current = null;
            historyRef.current = null;
            const current = ownedEditor;
            ownedEditor = null;
            void current?.disposeAsync().catch((error: unknown) => {
                console.error('Editor disposal failed.', error);
            });
        };
    }, []);

    function refreshState() {
        setImageInfo(editorRef.current?.getImageInfo() ?? null);
        setMaskCount(masksRef.current?.getAll().length ?? 0);
        setCropActive(cropRef.current?.isActive ?? false);
    }

    async function run(action: () => Promise<unknown>) {
        setRunning(true);
        try {
            await action();
            refreshState();
            setMessage(null);
        } catch (error) {
            setMessage(`Action failed: ${errorMessage(error)}`);
        } finally {
            setRunning(false);
        }
    }

    async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.currentTarget.files?.[0];
        const editor = editorRef.current;
        if (!file || !editor) return;
        await run(async () => editor.loadImage(await readFileAsDataUrl(file)));
        event.currentTarget.value = '';
    }

    function addMask() {
        const api = masksRef.current;
        if (api) void run(() => api.create());
    }

    function enterCrop() {
        const api = cropRef.current;
        if (api) void run(() => api.enter());
    }

    function cancelCrop() {
        const api = cropRef.current;
        if (api) void run(() => api.cancel());
    }

    function undo() {
        const api = historyRef.current;
        if (api) void run(() => api.undo());
    }

    function redo() {
        const api = historyRef.current;
        if (api) void run(() => api.redo());
    }

    function exportImage(format: 'png' | 'jpeg') {
        const editor = editorRef.current;
        if (!editor) return;
        void run(async () => {
            const dataUrl = await editor.exportImageBase64({ area: 'image', format });
            const anchor = document.createElement('a');
            anchor.href = dataUrl;
            anchor.download = `next-edited.${format === 'jpeg' ? 'jpg' : 'png'}`;
            anchor.click();
        });
    }

    const canUseImage = ready && imageInfo !== null && !running;

    return (
        <main className="app-shell">
            <header className="top-bar">
                <h1>Next.js redaction preset</h1>
                <input
                    aria-label="Load image"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={!ready || running}
                    onChange={(event) => void handleFileChange(event)}
                />
            </header>

            <section className="editor-layout">
                <div ref={containerRef} className="canvas-panel">
                    <canvas ref={canvasRef} />
                </div>

                <aside className="side-panel" aria-label="Editor controls and state">
                    <div className="button-grid">
                        <button disabled={!canUseImage} onClick={addMask}>
                            Add mask
                        </button>
                        <button disabled={!canUseImage || cropActive} onClick={enterCrop}>
                            Enter crop
                        </button>
                        <button disabled={!cropActive || running} onClick={cancelCrop}>
                            Cancel crop
                        </button>
                        <button disabled={running || !historyState.canUndo} onClick={undo}>
                            Undo
                        </button>
                        <button disabled={running || !historyState.canRedo} onClick={redo}>
                            Redo
                        </button>
                        <button disabled={!canUseImage} onClick={() => exportImage('png')}>
                            Export PNG
                        </button>
                        <button disabled={!canUseImage} onClick={() => exportImage('jpeg')}>
                            Export JPEG
                        </button>
                    </div>

                    <dl className="state-list">
                        <div>
                            <dt>Image</dt>
                            <dd>
                                {imageInfo ? `${imageInfo.width} × ${imageInfo.height}` : 'none'}
                            </dd>
                        </div>
                        <div>
                            <dt>Crop</dt>
                            <dd>{cropActive ? 'active' : 'inactive'}</dd>
                        </div>
                        <div>
                            <dt>Undo / redo</dt>
                            <dd>
                                {historyState.position} / {historyState.size}
                            </dd>
                        </div>
                        <div>
                            <dt>Masks</dt>
                            <dd>{maskCount}</dd>
                        </div>
                    </dl>

                    {message ? <p className="message">{message}</p> : null}
                </aside>
            </section>
        </main>
    );
}
