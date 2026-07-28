import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const rootManifest = JSON.parse(await readFile('package.json', 'utf8'));
const codemodManifest = JSON.parse(
    await readFile('packages/image-editor-codemod/package.json', 'utf8'),
);

test('package lifecycle scripts build fresh artifacts and enforce release validation', () => {
    assert.equal(rootManifest.scripts?.prepack, 'npm run build');
    assert.equal(rootManifest.scripts?.prepublishOnly, 'npm run check:release');
    assert.equal(codemodManifest.scripts?.prepack, 'npm run build');
});
