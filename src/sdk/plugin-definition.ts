/**
 * Validates and freezes synchronous or asynchronous Plugin definitions for installation.
 *
 * @module
 */

import { InvalidPluginDefinitionError } from '../plugin-kernel/errors.js';
import { isPluginRef } from '../plugin-kernel/plugin-ref.js';
import type { EditorPlugin, SynchronousEditorPlugin } from '../plugin-kernel/plugin-types.js';
import { validatePluginManifest } from './plugin-manifest.js';

/** Defines an immutable synchronous Plugin contract with validated metadata. */
export function definePlugin<TApi, TEvents extends object>(
    definition: SynchronousEditorPlugin<TApi, TEvents>,
): SynchronousEditorPlugin<TApi, TEvents>;

/** Defines an immutable Plugin contract with validated metadata. */
export function definePlugin<TApi, TEvents extends object>(
    definition: EditorPlugin<TApi, TEvents>,
): EditorPlugin<TApi, TEvents>;

export function definePlugin<TApi, TEvents extends object>(
    definition: EditorPlugin<TApi, TEvents>,
): EditorPlugin<TApi, TEvents> {
    if (typeof definition !== 'object' || definition === null) {
        throw new InvalidPluginDefinitionError('Plugin definition must be an object.');
    }
    if (!isPluginRef(definition.ref)) {
        throw new InvalidPluginDefinitionError(
            'Plugin definition must use a PluginRef created by definePluginRef().',
        );
    }
    if (typeof definition.setup !== 'function') {
        throw new InvalidPluginDefinitionError(
            `Plugin "${definition.ref.id}" must define setup().`,
            definition.ref.id,
        );
    }
    const manifest = validatePluginManifest(definition.ref, definition.manifest);
    return Object.freeze({ ...definition, manifest });
}
