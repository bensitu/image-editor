import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import * as fabric from 'fabric';
import { ImageEditor } from '@bensitu/image-editor';
import type {
    EditorToolMode,
    ImageEditorSelection,
    ImageEditorState,
    ImageInfo,
} from '@bensitu/image-editor';

const emptyHistory = { canUndo: false, canRedo: false };

const emptySelection: ImageEditorSelection = {
    selectedMask: null,
    selectedMasks: [],
    selectedAnnotation: null,
    selectedAnnotations: [],
    selectedObjectKind: null,
};

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

export default function App() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const editorRef = useRef<ImageEditor | null>(null);

    const [editorState, setEditorState] = useState<ImageEditorState | null>(null);
    const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
    const [selection, setSelection] = useState<ImageEditorSelection>(emptySelection);
    const [activeToolMode, setActiveToolMode] = useState<EditorToolMode | null>(null);
    const [historyState, setHistoryState] = useState(emptyHistory);
    const [maskCount, setMaskCount] = useState(0);
    const [lastOperation, setLastOperation] = useState('none');
    const [message, setMessage] = useState<string | null>(null);

    function refreshPublicState(editor: ImageEditor) {
        const nextState = editor.getEditorState();
        setEditorState(nextState);
        setImageInfo(editor.getImageInfo());
        setSelection(editor.getSelection());
        setActiveToolMode(editor.getActiveToolMode());
        setHistoryState({ canUndo: nextState.canUndo, canRedo: nextState.canRedo });
        setMaskCount(editor.getMasks().length);
    }

    useEffect(() => {
        if (!canvasRef.current) return;

        const editor = new ImageEditor(fabric, {
            defaultLayoutMode: 'fit',
            onImageChanged(state, context) {
                setEditorState(state);
                setLastOperation(context.operation);
                const currentEditor = editorRef.current;
                if (currentEditor) {
                    setImageInfo(currentEditor.getImageInfo());
                    setSelection(currentEditor.getSelection());
                    setMaskCount(currentEditor.getMasks().length);
                }
            },
            onToolModeChange(activeToolMode, previousToolMode, context) {
                setActiveToolMode(activeToolMode);
                setLastOperation(
                    `${context.operation}: ${previousToolMode ?? 'none'} -> ${activeToolMode ?? 'none'}`,
                );
            },
            onHistoryChange(history, context) {
                setHistoryState(history);
                setLastOperation(context.operation);
            },
            onSelectionChange(selection, context) {
                setSelection(selection);
                setLastOperation(context.operation);
            },
            onError(error, message) {
                console.error(message, error);
                setMessage(`Error: ${message}`);
            },
            onWarning(error, message) {
                console.warn(message, error);
                setMessage(`Warning: ${message}`);
            },
        });

        editorRef.current = editor;
        editor.init({
            canvas: canvasRef.current,
            canvasContainer: containerRef.current,
        });
        refreshPublicState(editor);

        return () => {
            editor.dispose();
            editorRef.current = null;
        };
    }, []);

    async function runEditorAction(action: (editor: ImageEditor) => unknown | Promise<unknown>) {
        const editor = editorRef.current;
        if (!editor) return;

        try {
            await action(editor);
            refreshPublicState(editor);
            setMessage(null);
        } catch (error) {
            console.error(error);
            setMessage(`Action failed: ${getErrorMessage(error)}`);
        }
    }

    async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.currentTarget.files?.[0];
        const editor = editorRef.current;
        if (!file || !editor) return;

        try {
            const dataUrl = await readFileAsDataUrl(file);
            await editor.loadImage(dataUrl);
            refreshPublicState(editor);
            setMessage(null);
        } catch (error) {
            console.error(error);
            setMessage(`Image load failed: ${getErrorMessage(error)}`);
        } finally {
            event.currentTarget.value = '';
        }
    }

    const editorReady = editorRef.current !== null;
    const isBusy = editorState?.isBusy ?? true;
    const hasImage = editorState?.hasImage ?? false;
    const canUseImage = editorReady && hasImage && !isBusy;
    const canUseHistory = editorReady && !isBusy;

    return (
        <main className="app-shell">
            <header className="top-bar">
                <h1>React ImageEditor</h1>
                <input
                    aria-label="Load image"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
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
                            disabled={!canUseImage}
                            onClick={() => void runEditorAction((editor) => editor.createMask())}
                        >
                            Add mask
                        </button>
                        <button
                            disabled={!canUseImage}
                            onClick={() => void runEditorAction((editor) => editor.enterCropMode())}
                        >
                            Enter crop
                        </button>
                        <button
                            disabled={activeToolMode !== 'crop'}
                            onClick={() => void runEditorAction((editor) => editor.cancelCrop())}
                        >
                            Cancel crop
                        </button>
                        <button
                            disabled={!canUseHistory || !historyState.canUndo}
                            onClick={() => void runEditorAction((editor) => editor.undo())}
                        >
                            Undo
                        </button>
                        <button
                            disabled={!canUseHistory || !historyState.canRedo}
                            onClick={() => void runEditorAction((editor) => editor.redo())}
                        >
                            Redo
                        </button>
                        <button
                            disabled={!canUseImage}
                            onClick={() =>
                                void runEditorAction((editor) =>
                                    editor.downloadImage({
                                        fileType: 'png',
                                        fileName: 'react-edited',
                                    }),
                                )
                            }
                        >
                            Export PNG
                        </button>
                        <button
                            disabled={!canUseImage}
                            onClick={() =>
                                void runEditorAction((editor) =>
                                    editor.downloadImage({
                                        fileType: 'jpeg',
                                        fileName: 'react-edited',
                                    }),
                                )
                            }
                        >
                            Export JPEG
                        </button>
                    </div>

                    <dl className="state-list">
                        <div>
                            <dt>Image</dt>
                            <dd>
                                {imageInfo ? `${imageInfo.width} x ${imageInfo.height}` : 'none'}
                            </dd>
                        </div>
                        <div>
                            <dt>Tool mode</dt>
                            <dd>{activeToolMode ?? 'none'}</dd>
                        </div>
                        <div>
                            <dt>Undo / redo</dt>
                            <dd>
                                {historyState.canUndo ? 'undo' : 'no undo'} /{' '}
                                {historyState.canRedo ? 'redo' : 'no redo'}
                            </dd>
                        </div>
                        <div>
                            <dt>Masks</dt>
                            <dd>{maskCount}</dd>
                        </div>
                        <div>
                            <dt>Annotations</dt>
                            <dd>{editorState?.annotationCount ?? 0}</dd>
                        </div>
                        <div>
                            <dt>Selection</dt>
                            <dd>{selection.selectedObjectKind ?? 'none'}</dd>
                        </div>
                        <div>
                            <dt>Last operation</dt>
                            <dd>{lastOperation}</dd>
                        </div>
                    </dl>

                    {message ? <p className="message">{message}</p> : null}
                </aside>
            </section>
        </main>
    );
}
