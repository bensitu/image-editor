import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import * as fabric from 'fabric';
import type { CoreImageInfo, ImageEditorCore } from '@bensitu/image-editor';
import type { HistoryPort, HistoryStatus } from '@bensitu/image-editor/plugins/history';
import type { TransformPluginApi } from '@bensitu/image-editor/plugins/transform';
import { createMinimalPreset } from '@bensitu/image-editor/presets/minimal';

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

export default function App() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const editorRef = useRef<ImageEditorCore | null>(null);
    const transformRef = useRef<TransformPluginApi | null>(null);
    const historyRef = useRef<HistoryPort | null>(null);
    const [ready, setReady] = useState(false);
    const [running, setRunning] = useState(false);
    const [imageInfo, setImageInfo] = useState<CoreImageInfo | null>(null);
    const [historyState, setHistoryState] = useState<HistoryStatus>(emptyHistory);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        let active = true;

        const preset = createMinimalPreset(fabric, {
            core: {
                defaultLayoutMode: 'fit',
                onError(error, detail) {
                    console.error(detail, error);
                    setMessage(`Error: ${detail}`);
                },
                onWarning(error, detail) {
                    console.warn(detail, error);
                    setMessage(`Warning: ${detail}`);
                },
            },
            transform: { animationDuration: 0 },
            history: { onChange: setHistoryState },
        });
        editorRef.current = preset.editor;
        transformRef.current = preset.transform;
        historyRef.current = preset.history;

        void preset.editor
            .init({ canvas, canvasContainer: containerRef.current })
            .then(() => {
                if (active) setReady(true);
            })
            .catch((error: unknown) => {
                if (active) setMessage(`Initialization failed: ${errorMessage(error)}`);
            });

        return () => {
            active = false;
            setReady(false);
            editorRef.current = null;
            transformRef.current = null;
            historyRef.current = null;
            void preset.editor.disposeAsync().catch((error: unknown) => {
                console.error('Editor disposal failed.', error);
            });
        };
    }, []);

    async function run(action: () => Promise<void>) {
        setRunning(true);
        try {
            await action();
            setImageInfo(editorRef.current?.getImageInfo() ?? null);
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

    async function exportPng() {
        const editor = editorRef.current;
        if (!editor) return;
        const dataUrl = await editor.exportImageBase64({ format: 'png', area: 'image' });
        const anchor = document.createElement('a');
        anchor.href = dataUrl;
        anchor.download = 'edited-image.png';
        anchor.click();
    }

    function runTransform(action: (api: TransformPluginApi) => Promise<void>) {
        const api = transformRef.current;
        if (api) run(() => action(api)).catch(console.error);
    }

    function runHistory(action: (api: HistoryPort) => Promise<void>) {
        const api = historyRef.current;
        if (api) run(() => action(api)).catch(console.error);
    }

    const canEdit = ready && !running && imageInfo !== null;

    return (
        <main className="app-shell">
            <header className="top-bar">
                <h1>React minimal preset</h1>
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
                        <button
                            disabled={!canEdit}
                            onClick={() => runTransform((api) => api.zoomIn())}
                        >
                            Zoom in
                        </button>
                        <button
                            disabled={!canEdit}
                            onClick={() => runTransform((api) => api.zoomOut())}
                        >
                            Zoom out
                        </button>
                        <button
                            disabled={!canEdit}
                            onClick={() => runTransform((api) => api.rotate(90))}
                        >
                            Rotate
                        </button>
                        <button
                            disabled={!canEdit}
                            onClick={() => runTransform((api) => api.resetImageTransform())}
                        >
                            Reset transform
                        </button>
                        <button
                            disabled={running || !historyState.canUndo}
                            onClick={() => runHistory((api) => api.undo())}
                        >
                            Undo
                        </button>
                        <button
                            disabled={running || !historyState.canRedo}
                            onClick={() => runHistory((api) => api.redo())}
                        >
                            Redo
                        </button>
                        <button disabled={!canEdit} onClick={() => void run(exportPng)}>
                            Export PNG
                        </button>
                    </div>

                    <dl className="state-list">
                        <div>
                            <dt>Lifecycle</dt>
                            <dd>{editorRef.current?.getLifecycleState() ?? 'configured'}</dd>
                        </div>
                        <div>
                            <dt>Image</dt>
                            <dd>
                                {imageInfo ? `${imageInfo.width} × ${imageInfo.height}` : 'none'}
                            </dd>
                        </div>
                        <div>
                            <dt>History</dt>
                            <dd>
                                {historyState.position} / {historyState.size}
                            </dd>
                        </div>
                    </dl>

                    {message ? <p className="message">{message}</p> : null}
                </aside>
            </section>
        </main>
    );
}
