# React integration

Install the editor and its Fabric peer dependency:

```bash
npm install @bensitu/image-editor fabric
```

The core package is framework-agnostic. In React, create the editor inside an effect, pass HTMLElement refs to `init()`, and dispose the instance in the cleanup function. This works with React StrictMode because each effect pass owns exactly one `ImageEditor` instance and never reuses a disposed instance.

For Next.js, mount the editor from a client component (`"use client"`) or dynamically import the component with SSR disabled. Canvas and Fabric operations require browser DOM APIs.

## Hook example

```tsx
import { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { ImageEditor } from '@bensitu/image-editor';
import type { ImageEditorOptions, ImageEditorState } from '@bensitu/image-editor';

export function useImageEditor(options: ImageEditorOptions = {}) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const editorRef = useRef<ImageEditor | null>(null);
    const optionsRef = useRef(options);
    const [state, setState] = useState<ImageEditorState | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        optionsRef.current = options;
    }, [options]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const initialOptions = optionsRef.current;
        const editor = new ImageEditor(fabric, {
            ...initialOptions,
            onImageChanged: (nextState, context) => {
                setState(nextState);
                optionsRef.current.onImageChanged?.(nextState, context);
            },
            onBusyChange: (isBusy, context) => {
                setBusy(isBusy);
                optionsRef.current.onBusyChange?.(isBusy, context);
            },
        });

        editor.init({
            canvas,
            canvasContainer: containerRef.current,
            zoomInButton: null,
            zoomOutButton: null,
            imageInput: null,
            maskList: null,
            annotationList: null,
        });

        editorRef.current = editor;

        return () => {
            editor.dispose();
            editorRef.current = null;
        };
    }, []);

    return {
        canvasRef,
        containerRef,
        editorRef,
        state,
        busy,
    };
}
```

Memoize the `options` object in callers when option identity matters. The hook keeps callback forwarding current through `optionsRef`, but it intentionally does not recreate the editor when options change.

## Component example

```tsx
export function ImageEditorPanel() {
    const { canvasRef, containerRef, editorRef, busy } = useImageEditor({
        canvasWidth: 800,
        canvasHeight: 600,
        defaultLayoutMode: 'fit',
    });

    return (
        <section>
            <div ref={containerRef} style={{ width: '100%', height: 600 }}>
                <canvas ref={canvasRef} />
            </div>

            <button disabled={busy} onClick={() => editorRef.current?.scaleImage(1.1)}>
                Zoom In
            </button>
            <button disabled={busy} onClick={() => editorRef.current?.rotateImage(90)}>
                Rotate
            </button>
            <button disabled={busy} onClick={() => editorRef.current?.resizeToContainer()}>
                Fit Container
            </button>
        </section>
    );
}
```

## State guidance

Store `ImageEditorState` snapshots or your own serializable state in React. Do not store Fabric objects in React state; treat `ImageEditor` and Fabric objects as imperative objects owned by the component.

## Multiple instances

Prefer HTMLElement refs over generated IDs for React components, especially when rendering multiple editors on the same page. Each instance should receive its own canvas and control refs.

## Responsive layout

Call `editorRef.current?.resizeToContainer()` after the container becomes visible or changes size. Use `editorRef.current?.relayout()` when you also want the editor to refresh layout bookkeeping for the current image without reloading it.
