/**
 * Validates and freezes synchronous Plugin definitions for public Core installation.
 *
 * @module
 */
import type { SynchronousEditorPlugin } from '../plugin-kernel/plugin-types.js';
/** Defines an immutable synchronous Plugin contract with validated metadata. */
export declare function definePlugin<TApi, TEvents extends object>(definition: SynchronousEditorPlugin<TApi, TEvents>): SynchronousEditorPlugin<TApi, TEvents>;
