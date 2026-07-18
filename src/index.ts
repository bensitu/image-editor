/**
 * Core Framework package entry.
 *
 * Features are installed explicitly from their package subpath before
 * initialization. The root and `/core` entries resolve to the same Core class.
 *
 * @module
 */

export { ImageEditorCore as ImageEditor, ImageEditorCore as default } from './core/index.js';
export * from './core/index.js';
