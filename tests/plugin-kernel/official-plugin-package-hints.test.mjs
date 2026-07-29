import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { annotationFoundationRef } from '../../src/foundations/annotation/index.js';
import { overlayFoundationRef } from '../../src/foundations/overlay/index.js';
import {
    OFFICIAL_PLUGIN_PACKAGE_HINTS,
    getOfficialPluginPackageHint,
} from '../../src/plugin-kernel/official-plugin-package-hints.js';
import { PluginManager } from '../../src/plugin-kernel/plugin-manager.js';
import { drawAnnotationPluginRef } from '../../src/plugins/annotation-draw/index.js';
import { shapeAnnotationPluginRef } from '../../src/plugins/annotation-shape/index.js';
import { textAnnotationPluginRef } from '../../src/plugins/annotation-text/index.js';
import { cropPluginRef } from '../../src/plugins/crop/index.js';
import { domControlsPluginRef } from '../../src/plugins/dom-controls/index.js';
import { filtersPluginRef } from '../../src/plugins/filters/index.js';
import { historyPluginRef } from '../../src/plugins/history/index.js';
import { maskPluginRef } from '../../src/plugins/mask/index.js';
import { mosaicPluginRef } from '../../src/plugins/mosaic/index.js';
import { overlayStatePluginRef } from '../../src/plugins/overlay-state/index.js';
import { transformPluginRef } from '../../src/plugins/transform/index.js';
import { definePlugin, definePluginRef } from '../../src/sdk/index.js';

const officialEntries = [
    [overlayFoundationRef, './plugins/overlay'],
    [annotationFoundationRef, './plugins/annotation'],
    [transformPluginRef, './plugins/transform'],
    [maskPluginRef, './plugins/mask'],
    [historyPluginRef, './plugins/history'],
    [filtersPluginRef, './plugins/filters'],
    [cropPluginRef, './plugins/crop'],
    [mosaicPluginRef, './plugins/mosaic'],
    [textAnnotationPluginRef, './plugins/annotation-text'],
    [shapeAnnotationPluginRef, './plugins/annotation-shape'],
    [drawAnnotationPluginRef, './plugins/annotation-draw'],
    [overlayStatePluginRef, './plugins/overlay-state'],
    [domControlsPluginRef, './plugins/dom-controls'],
];

function createConsumer(dependencyRef) {
    const consumerRef = definePluginRef('example-test:package-hint-consumer', '1.0.0');
    return definePlugin({
        ref: consumerRef,
        manifest: {
            id: consumerRef.id,
            version: '1.0.0',
            apiVersion: consumerRef.apiVersion,
            engine: '^3.0.0',
            requiresPlugins: [dependencyRef],
        },
        setupMode: 'sync',
        setup: () => Object.freeze({}),
    });
}

test('official Plugin package hints cover every formal package entry', async () => {
    const packageJson = JSON.parse(
        await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
    );
    const expectedIds = officialEntries.map(([ref]) => ref.id).sort();
    const registeredIds = OFFICIAL_PLUGIN_PACKAGE_HINTS.map(({ pluginId }) => pluginId).sort();
    const registeredPackages = OFFICIAL_PLUGIN_PACKAGE_HINTS.map(
        ({ packageName }) => packageName,
    ).sort();
    const exportedPackages = Object.keys(packageJson.exports)
        .filter((exportPath) => exportPath.startsWith('./plugins/'))
        .map((exportPath) => `${packageJson.name}${exportPath.slice(1)}`)
        .sort();

    assert.deepEqual(registeredIds, expectedIds);
    assert.equal(new Set(registeredIds).size, registeredIds.length);
    assert.deepEqual(registeredPackages, exportedPackages);

    for (const [ref, exportPath] of officialEntries) {
        assert.ok(packageJson.exports[exportPath], `${exportPath} must remain exported`);
        assert.equal(
            getOfficialPluginPackageHint(ref.id),
            `${packageJson.name}${exportPath.slice(1)}`,
        );
    }
});

test('dependency errors include official hints and keep third-party errors generic', () => {
    for (const [ref, exportPath] of officialEntries) {
        const manager = new PluginManager();
        assert.throws(
            () => manager.installSync(createConsumer(ref)),
            (error) => {
                assert.equal(error.packageHint, `@bensitu/image-editor${exportPath.slice(1)}`);
                assert.match(error.message, new RegExp(`Package hint: ${error.packageHint}`, 'u'));
                return true;
            },
        );
        manager.disposeSync();
    }

    const thirdPartyRef = definePluginRef('third-party-example:dependency', '1.0.0');
    const manager = new PluginManager();
    assert.throws(
        () => manager.installSync(createConsumer(thirdPartyRef)),
        (error) => {
            assert.equal(error.packageHint, undefined);
            assert.doesNotMatch(error.message, /Package hint:/u);
            return true;
        },
    );
    manager.disposeSync();
});
