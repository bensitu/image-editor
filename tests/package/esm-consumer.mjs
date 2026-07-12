import assert from 'node:assert/strict';

import { ImageEditorCore } from '@bensitu/image-editor/core';
import { historyPlugin } from '@bensitu/image-editor/plugins/history';
import { maskPlugin } from '@bensitu/image-editor/plugins/mask';
import { overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';
import { transformPlugin } from '@bensitu/image-editor/plugins/transform';

assert.equal(typeof ImageEditorCore, 'function');
assert.equal(typeof overlayFoundationPlugin, 'function');
assert.equal(typeof transformPlugin, 'function');
assert.equal(typeof maskPlugin, 'function');
assert.equal(typeof historyPlugin, 'function');
