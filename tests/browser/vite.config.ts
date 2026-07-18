import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));

export default defineConfig({
    root: repoRoot,
    server: {
        host: '127.0.0.1',
        port: 4175,
        strictPort: true,
    },
    resolve: {
        alias: [
            {
                find: '@bensitu/image-editor/plugins/overlay-state',
                replacement: resolve(repoRoot, 'src/plugins/overlay-state/index.ts'),
            },
            {
                find: '@bensitu/image-editor/plugins/dom-controls',
                replacement: resolve(repoRoot, 'src/plugins/dom-controls/index.ts'),
            },
            {
                find: '@bensitu/image-editor/plugins/annotation-text',
                replacement: resolve(repoRoot, 'src/plugins/annotation-text/index.ts'),
            },
            {
                find: '@bensitu/image-editor/plugins/annotation-shape',
                replacement: resolve(repoRoot, 'src/plugins/annotation-shape/index.ts'),
            },
            {
                find: '@bensitu/image-editor/plugins/annotation-draw',
                replacement: resolve(repoRoot, 'src/plugins/annotation-draw/index.ts'),
            },
            {
                find: '@bensitu/image-editor/plugins/annotation',
                replacement: resolve(repoRoot, 'src/foundations/annotation/index.ts'),
            },
            {
                find: '@bensitu/image-editor/plugins/crop',
                replacement: resolve(repoRoot, 'src/plugins/crop/index.ts'),
            },
            {
                find: '@bensitu/image-editor/plugins/mask',
                replacement: resolve(repoRoot, 'src/plugins/mask/index.ts'),
            },
            {
                find: '@bensitu/image-editor/plugins/mosaic',
                replacement: resolve(repoRoot, 'src/plugins/mosaic/index.ts'),
            },
            {
                find: '@bensitu/image-editor/plugins/overlay',
                replacement: resolve(repoRoot, 'src/foundations/overlay/index.ts'),
            },
            {
                find: '@bensitu/image-editor/plugins/history',
                replacement: resolve(repoRoot, 'src/plugins/history/index.ts'),
            },
            {
                find: '@bensitu/image-editor/plugins/transform',
                replacement: resolve(repoRoot, 'src/plugins/transform/index.ts'),
            },
            {
                find: '@bensitu/image-editor',
                replacement: resolve(repoRoot, 'src/index.ts'),
            },
        ],
    },
});
