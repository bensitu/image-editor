/**
 * Exposes Core, SDK, official Feature Plugins, and Full Preset composition to
 * script-tag consumers. Fabric remains an explicit preset factory dependency.
 *
 * @module
 */

export { ImageEditorCore } from '../core/index.js';
export * from '../sdk/index.js';

export * from '../foundations/overlay/index.js';
export * from '../foundations/annotation/index.js';

export * from '../plugins/transform/index.js';
export * from '../plugins/history/index.js';
export * from '../plugins/mask/index.js';
export * from '../plugins/filters/index.js';
export * from '../plugins/crop/index.js';
export * from '../plugins/mosaic/index.js';
export * from '../plugins/annotation-text/index.js';
export * from '../plugins/annotation-shape/index.js';
export {
    drawAnnotationPlugin,
    drawAnnotationPluginRef,
    type AnnotationPoint as DrawAnnotationPoint,
    type DrawAnnotationPluginApi,
    type DrawAnnotationPluginOptions,
    type DrawBrushConfiguration,
    type DrawConfiguration,
    type DrawEnterOptions,
    type DrawSessionState,
    type DrawSubMode,
    type EraserConfiguration,
} from '../plugins/annotation-draw/index.js';
export * from '../plugins/overlay-state/index.js';
export * from '../plugins/dom-controls/index.js';

export * from '../presets/full/index.js';
