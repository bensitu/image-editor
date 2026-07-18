import assert from 'node:assert/strict';

import * as root from '@bensitu/image-editor';
import ImageEditorDefault, { ImageEditor, ImageEditorCore } from '@bensitu/image-editor';
import { ImageEditorCore as CoreEntry } from '@bensitu/image-editor/core';
import { definePlugin, definePluginRef } from '@bensitu/image-editor/sdk';
import { filtersPlugin } from '@bensitu/image-editor/plugins/filters';
import { cropPlugin } from '@bensitu/image-editor/plugins/crop';
import { historyPlugin } from '@bensitu/image-editor/plugins/history';
import { maskPlugin } from '@bensitu/image-editor/plugins/mask';
import { overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';
import { annotationFoundationPlugin } from '@bensitu/image-editor/plugins/annotation';
import { textAnnotationPlugin } from '@bensitu/image-editor/plugins/annotation-text';
import { shapeAnnotationPlugin } from '@bensitu/image-editor/plugins/annotation-shape';
import { drawAnnotationPlugin } from '@bensitu/image-editor/plugins/annotation-draw';
import { transformPlugin } from '@bensitu/image-editor/plugins/transform';
import { mosaicPlugin } from '@bensitu/image-editor/plugins/mosaic';
import { overlayStatePlugin } from '@bensitu/image-editor/plugins/overlay-state';
import { domControlsPlugin } from '@bensitu/image-editor/plugins/dom-controls';
import { createMinimalPreset } from '@bensitu/image-editor/presets/minimal';
import { createRedactionPreset } from '@bensitu/image-editor/presets/redaction';
import { createAnnotationPreset } from '@bensitu/image-editor/presets/annotation';
import { createFullPreset } from '@bensitu/image-editor/presets/full';
import { createPluginTestHost, runPluginConformance } from '@bensitu/image-editor/testing';
import {
    detectSnapshotVersion,
    loadV2Snapshot,
    migrateV2Snapshot,
    v2SnapshotMigration,
} from '@bensitu/image-editor/migrate-v2';

assert.equal(typeof ImageEditorCore, 'function');
assert.equal(ImageEditor, ImageEditorCore);
assert.equal(ImageEditorDefault, ImageEditorCore);
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
