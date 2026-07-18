# SSR, Next.js, and Nuxt

Public type imports are server-safe. Creating an editor, importing a browser
Fabric runtime, initializing Canvas, loading images, and exporting must run in
client code.

```ts
import type { ImageEditorCore } from '@bensitu/image-editor';
import type { RedactionPresetResult } from '@bensitu/image-editor/presets/redaction';

let editor: ImageEditorCore | null = null;
let preset: RedactionPresetResult<null> | null = null;
```

The DOM Controls entry is also safe to import on a server because module
evaluation does not read DOM globals. Its `ownerDocument` and initialization
still belong in client code.

## Next.js

Use a client component and dynamically load both Fabric and the chosen Preset
inside `useEffect`:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import type { ImageEditorCore } from '@bensitu/image-editor';

export function EditorPanel() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
                masks: { label: false },
            });
            ownedEditor = preset.editor;
            await preset.editor.init({ canvas });
            if (disposed) {
                ownedEditor = null;
                await preset.editor.disposeAsync();
            }
        }

        void setup();
        return () => {
            disposed = true;
            const current = ownedEditor;
            ownedEditor = null;
            void current?.disposeAsync().catch(console.error);
        };
    }, []);

    return <canvas ref={canvasRef} />;
}
```

The runnable [Next.js example](../../examples/next-client-only) also retains
Mask, Crop, and History APIs and calls them from React handlers. Its page can be
statically rendered because runtime imports stay inside the client effect.

## Nuxt

Render the editor component inside `<ClientOnly>` and create the Preset from
`onMounted`. Dispose the editor in `onBeforeUnmount`.

```vue
<template>
    <ClientOnly>
        <EditorPanel />
    </ClientOnly>
</template>
```

Never reuse an editor after disposal. If setup finishes after a component has
unmounted, immediately dispose the newly created editor.
