'use strict';

/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require('node:assert/strict');
const { ImageEditorCore } = require('@bensitu/image-editor/core');
const { historyPlugin } = require('@bensitu/image-editor/plugins/history');
const { maskPlugin } = require('@bensitu/image-editor/plugins/mask');
const { overlayFoundationPlugin } = require('@bensitu/image-editor/plugins/overlay');
const { transformPlugin } = require('@bensitu/image-editor/plugins/transform');

assert.equal(typeof ImageEditorCore, 'function');
assert.equal(typeof overlayFoundationPlugin, 'function');
assert.equal(typeof transformPlugin, 'function');
assert.equal(typeof maskPlugin, 'function');
assert.equal(typeof historyPlugin, 'function');
