/**
 * Converts frozen maintenance snapshots into the current public Snapshot contract.
 *
 * This optional entry is intentionally isolated from normal runtime entries.
 *
 * @module
 */
import type { EditorSnapshot, ImageEditorCore, MissingPluginPolicy, SnapshotMigration } from '../core/index.js';
declare const SOURCE_SCHEMA = "image-editor.canvas@2";
export type UnsupportedFieldPolicy = 'error' | 'warn-and-skip';
export interface SnapshotMigrationWarning {
    readonly code: string;
    readonly path: string;
    readonly message: string;
}
export interface SnapshotConversionOptions {
    readonly unsupportedFieldPolicy?: UnsupportedFieldPolicy;
    readonly onWarning?: (warning: SnapshotMigrationWarning) => void;
    readonly canvasSize?: Readonly<{
        width: number;
        height: number;
    }>;
    readonly maxInputBytes?: number;
    readonly maxObjectCount?: number;
    readonly maxDepth?: number;
}
export interface SnapshotMigrationLoadOptions extends SnapshotConversionOptions {
    readonly missingPluginPolicy?: MissingPluginPolicy;
    readonly signal?: AbortSignal;
}
export type SnapshotVersionDetection = Readonly<{
    kind: 'source';
    schema: typeof SOURCE_SCHEMA;
    version: 2;
}> | Readonly<{
    kind: 'current';
    schema: 'image-editor.state';
    version: 3;
}> | Readonly<{
    kind: 'unsupported';
    schema: string;
    version: unknown;
}> | Readonly<{
    kind: 'unknown';
}>;
export declare class SnapshotMigrationError extends Error {
    readonly code: string;
    readonly path: string;
    readonly name = "SnapshotMigrationError";
    constructor(code: string, message: string, path?: string, options?: Readonly<{
        cause?: unknown;
    }>);
}
export declare function detectSnapshotVersion(input: string | unknown): SnapshotVersionDetection;
export declare function migrateV2Snapshot(input: string | unknown, options?: SnapshotConversionOptions): EditorSnapshot;
export declare function v2SnapshotMigration(options?: SnapshotConversionOptions): SnapshotMigration;
export declare function loadV2Snapshot(editor: ImageEditorCore, input: string | unknown, options?: SnapshotMigrationLoadOptions): Promise<void>;
export {};
