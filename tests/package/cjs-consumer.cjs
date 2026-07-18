'use strict';

/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require('node:assert/strict');
const root = require('@bensitu/image-editor');
const { ImageEditor, ImageEditorCore } = root;
const { ImageEditorCore: CoreEntry } = require('@bensitu/image-editor/core');
const { definePlugin, definePluginRef } = require('@bensitu/image-editor/sdk');
const { filtersPlugin } = require('@bensitu/image-editor/plugins/filters');
const { cropPlugin } = require('@bensitu/image-editor/plugins/crop');
const { historyPlugin } = require('@bensitu/image-editor/plugins/history');
const { maskPlugin } = require('@bensitu/image-editor/plugins/mask');
const { overlayFoundationPlugin } = require('@bensitu/image-editor/plugins/overlay');
const { annotationFoundationPlugin } = require('@bensitu/image-editor/plugins/annotation');
const { textAnnotationPlugin } = require('@bensitu/image-editor/plugins/annotation-text');
const { shapeAnnotationPlugin } = require('@bensitu/image-editor/plugins/annotation-shape');
const { drawAnnotationPlugin } = require('@bensitu/image-editor/plugins/annotation-draw');
const { transformPlugin } = require('@bensitu/image-editor/plugins/transform');
const { mosaicPlugin } = require('@bensitu/image-editor/plugins/mosaic');
const { overlayStatePlugin } = require('@bensitu/image-editor/plugins/overlay-state');
const { domControlsPlugin } = require('@bensitu/image-editor/plugins/dom-controls');
const { createMinimalPreset } = require('@bensitu/image-editor/presets/minimal');
const { createRedactionPreset } = require('@bensitu/image-editor/presets/redaction');
const { createAnnotationPreset } = require('@bensitu/image-editor/presets/annotation');
const { createFullPreset } = require('@bensitu/image-editor/presets/full');
const { createPluginTestHost, runPluginConformance } = require('@bensitu/image-editor/testing');
const {
    detectSnapshotVersion,
    loadV2Snapshot,
    migrateV2Snapshot,
    v2SnapshotMigration,
} = require('@bensitu/image-editor/migrate-v2');

assert.equal(typeof ImageEditorCore, 'function');
assert.equal(ImageEditor, ImageEditorCore);
assert.equal(root.default, ImageEditorCore);
assert.equal(CoreEntry, ImageEditorCore);
assert.equal('cropPlugin' in root, false);
assert.equal('mosaicPlugin' in root, false);
assert.equal('annotationFoundationPlugin' in root, false);
assert.equal('textAnnotationPlugin' in root, false);
assert.equal('shapeAnnotationPlugin' in root, false);
assert.equal('drawAnnotationPlugin' in root, false);
assert.equal('overlayStatePlugin' in root, false);
assert.equal('domControlsPlugin' in root, false);
assert.equal('createFullPreset' in root, false);
assert.equal('migrateV2Snapshot' in root, false);
assert.equal('loadV2Snapshot' in root, false);
assert.equal(typeof definePlugin, 'function');
assert.equal(typeof definePluginRef, 'function');
assert.equal(typeof filtersPlugin, 'function');
assert.equal(typeof cropPlugin, 'function');
assert.equal(typeof mosaicPlugin, 'function');
assert.equal(typeof annotationFoundationPlugin, 'function');
assert.equal(typeof textAnnotationPlugin, 'function');
assert.equal(typeof shapeAnnotationPlugin, 'function');
assert.equal(typeof drawAnnotationPlugin, 'function');
assert.equal(typeof overlayFoundationPlugin, 'function');
assert.equal(typeof transformPlugin, 'function');
assert.equal(typeof maskPlugin, 'function');
assert.equal(typeof historyPlugin, 'function');
assert.equal(typeof overlayStatePlugin, 'function');
assert.equal(typeof domControlsPlugin, 'function');
assert.equal(typeof createMinimalPreset, 'function');
assert.equal(typeof createRedactionPreset, 'function');
assert.equal(typeof createAnnotationPreset, 'function');
assert.equal(typeof createFullPreset, 'function');
assert.equal(typeof createPluginTestHost, 'function');
assert.equal(typeof runPluginConformance, 'function');
assert.equal(typeof detectSnapshotVersion, 'function');
assert.equal(typeof migrateV2Snapshot, 'function');
assert.equal(typeof loadV2Snapshot, 'function');
assert.equal(typeof v2SnapshotMigration, 'function');
