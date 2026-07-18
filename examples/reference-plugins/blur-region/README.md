# Blur region reference plugin

This package demonstrates a transient region Tool and a privileged Raster Commit. It receives only
immutable Base Image information, requires an application-supplied rasterizer, and binds replacement
authority to the active document transaction.

```ts
import { createBlurRegionPlugin } from '@bensitu/reference-blur-region';

const blur = editor.use(createBlurRegionPlugin({ rasterize }));
const id = await blur.preview({ x: 20, y: 20, width: 80, height: 60 });
await blur.commit(id);
```

The rasterizer must return a new Fabric image with the same natural dimensions as the source.
