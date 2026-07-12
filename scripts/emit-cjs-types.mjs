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
    'foundations/overlay/index',
    'plugins/transform/index',
    'plugins/mask/index',
    'plugins/history/index',
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
