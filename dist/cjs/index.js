"use strict";
/**
 * @file index.ts
 * @description Public API barrel for the image-editor library.
 *
 * @example
 * ```ts
 * import * as fabric from 'fabric';
 * import { ImageEditor } from 'image-editor';
 * import type { ImageEditorOptions, MaskConfig, MaskObject } from 'image-editor';
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMaskObject = exports.HistoryManager = exports.Command = exports.AnimationQueue = exports.ImageEditor = void 0;
var image_editor_js_1 = require("./image-editor.js");
Object.defineProperty(exports, "ImageEditor", { enumerable: true, get: function () { return image_editor_js_1.ImageEditor; } });
var animation_queue_js_1 = require("./animation-queue.js");
Object.defineProperty(exports, "AnimationQueue", { enumerable: true, get: function () { return animation_queue_js_1.AnimationQueue; } });
var history_js_1 = require("./history.js");
Object.defineProperty(exports, "Command", { enumerable: true, get: function () { return history_js_1.Command; } });
Object.defineProperty(exports, "HistoryManager", { enumerable: true, get: function () { return history_js_1.HistoryManager; } });
var types_js_1 = require("./types.js");
Object.defineProperty(exports, "isMaskObject", { enumerable: true, get: function () { return types_js_1.isMaskObject; } });
//# sourceMappingURL=index.js.map