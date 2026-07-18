# Grid and guide reference plugin

This package renders transient Fabric lines through the public Overlay Foundation. Grid changes use
one transient operation, guides are owned by a public Tool, and neither kind is written to Snapshot
or History.

```ts
import { createGridGuidePlugin } from '@bensitu/reference-grid-guide';

const grid = editor.use(createGridGuidePlugin());
await grid.enable();
await grid.addGuide('vertical', 120);
```

The package declares Fabric and Core as peers and uses public package entries only.
