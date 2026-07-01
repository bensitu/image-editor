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
const esmTypesPath = path.join(typesDir, 'index.d.ts');
const cjsTypesPath = path.join(typesDir, 'index.d.cts');
const esmMapPath = path.join(typesDir, 'index.d.ts.map');
const cjsMapPath = path.join(typesDir, 'index.d.cts.map');

await mkdir(typesDir, { recursive: true });

const declaration = await readFile(esmTypesPath, 'utf8');
const hasDeclarationMap = declaration.includes('//# sourceMappingURL=index.d.ts.map');
await writeFile(
    cjsTypesPath,
    hasDeclarationMap
        ? declaration.replace(
              '//# sourceMappingURL=index.d.ts.map',
              '//# sourceMappingURL=index.d.cts.map',
          )
        : declaration,
);

try {
    const map = JSON.parse(await readFile(esmMapPath, 'utf8'));
    map.file = 'index.d.cts';
    await writeFile(cjsMapPath, `${JSON.stringify(map)}\n`);
} catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    await rm(cjsMapPath, { force: true });
}
