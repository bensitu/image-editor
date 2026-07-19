/**
 * Publishes the Text Annotation Plugin factory and editing contracts.
 *
 * @module
 */
import type { CoreEventMap } from '../../core/index.js';
import { type SynchronousEditorPlugin } from '../../sdk/index.js';
import type { TextAnnotationPluginApi, TextAnnotationPluginOptions } from './text-annotation.js';
export declare const textAnnotationPluginRef: import("../../index.js").PluginRef<TextAnnotationPluginApi>;
export declare function textAnnotationPlugin(options?: TextAnnotationPluginOptions): SynchronousEditorPlugin<TextAnnotationPluginApi, CoreEventMap>;
export type { TextAlignment, TextAnnotationConfiguration, TextAnnotationCreateOptions, TextAnnotationPluginApi, TextAnnotationPluginOptions, TextAnnotationStatus, TextAnnotationStatusListener, TextAnnotationUpdate, TextEditingSession, TextReflectionBehavior, } from './text-annotation.js';
