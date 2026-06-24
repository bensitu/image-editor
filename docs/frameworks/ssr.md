# SSR, Next.js, and Nuxt

`@bensitu/image-editor` depends on browser DOM, canvas, and Fabric.js runtime APIs when an `ImageEditor` instance is created or initialized. Server environments do not provide those APIs, so editor creation and `init()` must run only in the browser.

Type-only imports are safe in SSR code:

```ts
import type { ImageEditorOptions, ImageEditorState } from '@bensitu/image-editor';
```

Runtime imports and instance creation should happen from client-only code.

## Next.js

Use a client component:

```tsx
'use client';

import * as fabric from 'fabric';
import { ImageEditor } from '@bensitu/image-editor';

// Create and initialize ImageEditor inside useEffect.
```

Alternatively, dynamically import the component that owns the editor with SSR disabled:

```tsx
import dynamic from 'next/dynamic';

const ImageEditorPanel = dynamic(() => import('./ImageEditorPanel'), {
    ssr: false,
});
```

## Nuxt

Wrap the editor UI in `<ClientOnly>` and initialize from `onMounted`:

```vue
<template>
    <ClientOnly>
        <ImageEditorPanel />
    </ClientOnly>
</template>
```

Inside the panel, create the editor in `onMounted` and dispose it in `onBeforeUnmount`.

## General rules

- Importing public types is safe on the server.
- Creating `new ImageEditor(...)` should happen only in client code.
- Calling `editor.init(...)`, loading images, resizing canvas, and exporting require browser DOM/canvas availability.
- Do not reuse an editor instance after `dispose()`.
- For hidden tabs or dialogs, call `resizeToContainer()` or `relayout()` after the editor becomes visible.
