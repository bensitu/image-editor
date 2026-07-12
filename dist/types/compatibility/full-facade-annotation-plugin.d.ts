import type { CoreEventMap } from '../core-runtime/public-types.js';
import { type SynchronousEditorPlugin } from '../plugin-kernel/index.js';
export interface FullFacadeAnnotationPluginOptions {
    readonly bindToImageTransform: boolean;
    readonly textFlipBehavior: 'preserve-readable' | 'mirror';
}
export declare const fullFacadeAnnotationPluginRef: import("../plugin-kernel/plugin-ref.js").PluginRef<Record<string, never>>;
export declare function fullFacadeAnnotationPlugin(options: FullFacadeAnnotationPluginOptions): SynchronousEditorPlugin<Record<string, never>, CoreEventMap>;
