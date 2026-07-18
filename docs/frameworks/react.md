# React integration

Create one Preset or Core/Plugin composition inside an effect, store the editor
and Plugin APIs in refs, and dispose the same editor from the cleanup function.
React event handlers should call Plugin APIs directly; DOM Controls is not
needed.

```tsx
import { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import type { ImageEditorCore } from '@bensitu/image-editor';
import type { HistoryPort, HistoryStatus } from '@bensitu/image-editor/plugins/history';
import type { TransformPluginApi } from '@bensitu/image-editor/plugins/transform';
import { createMinimalPreset } from '@bensitu/image-editor/presets/minimal';

export function EditorPanel() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const editorRef = useRef<ImageEditorCore | null>(null);
    const transformRef = useRef<TransformPluginApi | null>(null);
    const historyRef = useRef<HistoryPort | null>(null);
    const [history, setHistory] = useState<HistoryStatus | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const preset = createMinimalPreset(fabric, {
            core: { defaultLayoutMode: 'fit' },
            transform: { animationDuration: 0 },
            history: { onChange: setHistory },
        });
        editorRef.current = preset.editor;
        transformRef.current = preset.transform;
        historyRef.current = preset.history;
        void preset.editor.init({ canvas, canvasContainer: containerRef.current });

        return () => {
            editorRef.current = null;
            transformRef.current = null;
            historyRef.current = null;
            void preset.editor.disposeAsync();
        };
    }, []);

    return (
        <section>
            <div ref={containerRef} style={{ width: '100%', height: 600 }}>
                <canvas ref={canvasRef} />
            </div>
            <button onClick={() => void transformRef.current?.zoomIn()}>Zoom in</button>
            <button disabled={!history?.canUndo} onClick={() => void historyRef.current?.undo()}>
                Undo
            </button>
        </section>
    );
}
```

This ownership works with StrictMode: each effect pass creates and disposes one
editor. Never reuse a disposed result during the next effect pass.

Keep immutable status objects such as `HistoryStatus` in React state. Keep the
editor, Plugin APIs, and Fabric objects in refs rather than React state. For
multiple editors, give each component its own canvas and container refs.

The complete runnable example is in [examples/react-basic](../../examples/react-basic).
