# Watermark reference plugin

This independently packaged example registers a persistent Overlay kind, Codec, geometry policy,
export renderer, configuration state, and a focused API without exposing Fabric objects.

```ts
import { createWatermarkPlugin } from '@bensitu/reference-watermark';

const watermark = editor.use(createWatermarkPlugin());
await watermark.add({ text: 'Draft', left: 24, top: 24 });
```

Install `@bensitu/image-editor` and `fabric` as peer dependencies. Build and test the packed package
before publishing it.
