# Metadata reference plugin

This package demonstrates instance-local document metadata, committed events, configuration, State
Slice persistence, and deterministic Slice migration without importing Fabric or requesting Canvas
access.

```ts
import { createMetadataPlugin } from '@bensitu/reference-metadata';

const metadata = editor.use(createMetadataPlugin());
await metadata.set('reviewer', 'A. Example');
```

The package keeps `@bensitu/image-editor` and `fabric` as peers so consumers own both runtime copies.
