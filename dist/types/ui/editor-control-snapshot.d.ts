/**
 * Captures the editor state needed to enable or disable UI controls.
 *
 * Keeping this snapshot builder outside the facade isolates DOM control policy
 * from the editor's public methods.
 */
import type { EditorRuntime } from '../runtime/editor-runtime.js';
import type { EditorControlSnapshot } from './editor-control-state.js';
export declare function buildEditorControlSnapshot(runtime: EditorRuntime): EditorControlSnapshot | null;
