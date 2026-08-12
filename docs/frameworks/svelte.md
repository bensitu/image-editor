# Svelte integration

Create one Preset or Core/Plugin composition in `onMount`, retain the imperative
editor and Plugin APIs as plain module variables, and release the same editor
from the lifecycle cleanup callback.

```svelte
<script lang="ts">
    import { onMount } from 'svelte';
    import * as fabric from 'fabric';
    import type { HistoryPort, HistoryStatus } from '@bensitu/image-editor/plugins/history';
    import type { TransformPluginApi } from '@bensitu/image-editor/plugins/transform';
    import { createMinimalPreset } from '@bensitu/image-editor/presets/minimal';

    let canvas: HTMLCanvasElement;
    let container: HTMLDivElement;
    let transform: TransformPluginApi | null = null;
    let history: HistoryPort | null = null;
    let historyStatus = $state<HistoryStatus | null>(null);

    onMount(() => {
        const preset = createMinimalPreset(fabric, {
            core: { defaultLayoutMode: 'fit' },
            history: { onChange: (status) => (historyStatus = status) },
        });
        transform = preset.transform;
        history = preset.history;
        void preset.editor.init({ canvas, canvasContainer: container });

        return () => {
            transform = null;
            history = null;
            void preset.editor.disposeAsync();
        };
    });
</script>

<div bind:this={container} style="width: 100%; height: 600px">
    <canvas bind:this={canvas}></canvas>
</div>
<button onclick={() => void transform?.zoomIn()}>Zoom in</button>
<button disabled={!historyStatus?.canUndo} onclick={() => void history?.undo()}>Undo</button>
```

Store immutable status snapshots and other render data in `$state`. Keep the
editor, Plugin APIs, Fabric objects, and other ownership-bearing resources out
of reactive state. Application event handlers should call the typed Plugin API
that owns each feature; DOM Controls is not required.

The complete runnable example is in
[examples/svelte-basic](../../examples/svelte-basic).
