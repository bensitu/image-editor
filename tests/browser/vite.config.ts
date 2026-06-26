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
        alias: {
            '@bensitu/image-editor': resolve(repoRoot, 'src/index.ts'),
        },
    },
});
