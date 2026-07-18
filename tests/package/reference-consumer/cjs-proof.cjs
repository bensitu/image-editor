'use strict';

/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require('node:assert/strict');
const { ImageEditorCore: RootImageEditorCore } = require('@bensitu/image-editor');
const { ImageEditorCore } = require('@bensitu/image-editor/core');
const { definePlugin } = require('@bensitu/image-editor/sdk');
const { runPluginConformance } = require('@bensitu/image-editor/testing');
const { createBlurRegionPlugin } = require('@bensitu/reference-blur-region');
const { createGridGuidePlugin } = require('@bensitu/reference-grid-guide');
const { createMetadataPlugin } = require('@bensitu/reference-metadata');
const { createWatermarkPlugin } = require('@bensitu/reference-watermark');

assert.equal(RootImageEditorCore, ImageEditorCore);
for (const value of [
    definePlugin,
    runPluginConformance,
    createBlurRegionPlugin,
    createGridGuidePlugin,
    createMetadataPlugin,
    createWatermarkPlugin,
]) {
    assert.equal(typeof value, 'function');
}
