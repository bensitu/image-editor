/**
 * Emit the CommonJS declaration entry required by the package exports map.
 *
 * TypeScript's declaration-only build emits `index.d.ts` for the ESM-facing
 * entry. The CJS runtime has the same public surface, but NodeNext consumers
 * resolving through the `require` condition need a `.d.cts` declaration file
 * so TypeScript treats that branch as CommonJS.
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const typesDir = path.resolve('dist', 'types');
const cjsEntries = [
    'index',
    'core/index',
    'sdk/index',
    'testing/index',
    'migrate-v2/index',
    'foundations/overlay/index',
    'foundations/annotation/index',
    'plugins/transform/index',
    'plugins/mask/index',
    'plugins/history/index',
    'plugins/filters/index',
    'plugins/crop/index',
    'plugins/mosaic/index',
    'plugins/annotation-text/index',
    'plugins/annotation-shape/index',
    'plugins/annotation-draw/index',
    'plugins/overlay-state/index',
    'plugins/dom-controls/index',
    'presets/minimal/index',
    'presets/redaction/index',
    'presets/annotation/index',
    'presets/full/index',
];

await mkdir(typesDir, { recursive: true });

for (const entry of cjsEntries) {
    const esmTypesPath = path.join(typesDir, `${entry}.d.ts`);
    const cjsTypesPath = path.join(typesDir, `${entry}.d.cts`);
    const esmMapPath = path.join(typesDir, `${entry}.d.ts.map`);
    const cjsMapPath = path.join(typesDir, `${entry}.d.cts.map`);
    await mkdir(path.dirname(cjsTypesPath), { recursive: true });
    const declaration = await readFile(esmTypesPath, 'utf8');
    const mapName = `${path.basename(entry)}.d.ts.map`;
    const cjsMapName = `${path.basename(entry)}.d.cts.map`;
    await writeFile(cjsTypesPath, declaration.replace(mapName, cjsMapName));

    try {
        const map = JSON.parse(await readFile(esmMapPath, 'utf8'));
        map.file = `${path.basename(entry)}.d.cts`;
        await writeFile(cjsMapPath, `${JSON.stringify(map)}\n`);
    } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
        await rm(cjsMapPath, { force: true });
    }
}
