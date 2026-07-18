import type { EditorPlugin, SynchronousEditorPlugin } from '../plugin-kernel/plugin-types.js';
/** Defines an immutable synchronous Plugin contract with validated metadata. */
export declare function definePlugin<TApi, TEvents extends object>(definition: SynchronousEditorPlugin<TApi, TEvents>): SynchronousEditorPlugin<TApi, TEvents>;
/** Defines an immutable Plugin contract with validated metadata. */
export declare function definePlugin<TApi, TEvents extends object>(definition: EditorPlugin<TApi, TEvents>): EditorPlugin<TApi, TEvents>;
