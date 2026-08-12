/**
 * Declares the Overlay State wire schema, validation limits, import/export options, and Plugin API.
 *
 * @module
 */
/** Stable schema identifier for portable Overlay documents. */
export declare const OVERLAY_STATE_SCHEMA: "image-editor.overlay-state";
/** Current portable Overlay document format version. */
export declare const OVERLAY_STATE_WIRE_VERSION: 2;
/** Coordinate space used by portable Overlay documents. */
export declare const OVERLAY_STATE_COORDINATE_SPACE: "image-normalized";
/** Base Image identity and dimensions associated with an Overlay document. */
export interface OverlayStateImageReference {
    readonly naturalWidth: number;
    readonly naturalHeight: number;
    readonly mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
    readonly sourceId?: string;
    readonly checksum?: string;
}
/** Codec identity required to restore one Overlay item. */
export interface OverlayStateCodecReference {
    readonly type: string;
    readonly version: string;
}
/** Portable geometry, feature data, metadata, and presentation for one Overlay. */
export interface OverlayStateItem {
    readonly id: string;
    readonly kind: string;
    readonly codec: OverlayStateCodecReference;
    readonly geometry: unknown;
    readonly layer: number;
    readonly hidden: boolean;
    readonly locked: boolean;
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly data: unknown;
}
/** Portable document containing image context and ordered Overlay items. */
export interface OverlayStateDocument {
    readonly schema: typeof OVERLAY_STATE_SCHEMA;
    readonly version: typeof OVERLAY_STATE_WIRE_VERSION;
    readonly coordinateSpace: typeof OVERLAY_STATE_COORDINATE_SPACE;
    readonly image: OverlayStateImageReference;
    readonly overlays: readonly OverlayStateItem[];
    readonly metadata?: Readonly<Record<string, unknown>>;
}
/** Resource and structural limits applied before Overlay state enters the runtime. */
export interface OverlayStateLimits {
    readonly maxPayloadBytes: number;
    readonly maxDepth: number;
    readonly maxArrayLength: number;
    readonly maxOverlays: number;
    readonly maxMetadataKeys: number;
    readonly maxMetadataDepth: number;
    readonly maxStringLength: number;
    readonly maxIdentifierLength: number;
    readonly maxCodecPayloadBytes: number;
    readonly maxCoordinates: number;
    readonly maxCoordinateMagnitude: number;
    readonly maxDrawPoints: number;
    readonly maxPathCommands: number;
}
/** Machine-readable validation failure with its payload path. */
export interface OverlayStateValidationIssue {
    readonly code: string;
    readonly path: string;
    readonly message: string;
}
/** Handling policy for Overlay kinds unavailable in the active runtime. */
export type OverlayStateMissingKindPolicy = 'error' | 'skip';
/** Controls validation policy and resource limits. */
export interface OverlayStateValidationOptions {
    readonly missingKindPolicy?: OverlayStateMissingKindPolicy;
    readonly limits?: Partial<OverlayStateLimits>;
}
/** Controls migration resource limits. */
export interface OverlayStateMigrationOptions {
    readonly limits?: Partial<OverlayStateLimits>;
}
/** Validated document or the complete set of discovered issues. */
export interface OverlayStateValidationResult {
    readonly valid: boolean;
    readonly document?: OverlayStateDocument;
    readonly errors: readonly OverlayStateValidationIssue[];
}
/** Selects Overlay kinds, visibility, and metadata for portable export. */
export interface OverlayStateExportOptions {
    readonly kinds?: readonly string[];
    readonly includeHidden?: boolean;
    readonly missingKindPolicy?: OverlayStateMissingKindPolicy;
    readonly metadata?: Readonly<Record<string, unknown>>;
}
/** Controls replacement, identity conflicts, missing kinds, and import limits. */
export interface OverlayStateImportOptions {
    readonly mode?: 'replace' | 'append';
    readonly idConflict?: 'error' | 'regenerate';
    readonly missingKindPolicy?: OverlayStateMissingKindPolicy;
    readonly limits?: Partial<OverlayStateLimits>;
}
/** Summary and regenerated identity map from one committed import. */
export interface OverlayStateImportResult {
    readonly mode: 'replace' | 'append';
    readonly imported: number;
    readonly skipped: number;
    readonly idMap: Readonly<Record<string, string>>;
}
/** Construction limits for the Overlay State Plugin. */
export interface OverlayStatePluginOptions {
    readonly limits?: Partial<OverlayStateLimits>;
}
/** Public validation, migration, export, and transactional import operations. */
export interface OverlayStatePluginApi {
    /** Validates an unknown payload without mutating the document. */
    validate(payload: unknown, options?: OverlayStateValidationOptions): OverlayStateValidationResult;
    /** Converts a supported payload to the current portable document format. */
    migrate(payload: unknown, options?: OverlayStateMigrationOptions): OverlayStateDocument;
    /** Serializes matching persistent Overlays without mutating the document. */
    exportState(options?: OverlayStateExportOptions): OverlayStateDocument;
    /** Validates and imports portable Overlay state as one document mutation. */
    importState(payload: unknown, options?: OverlayStateImportOptions): Promise<OverlayStateImportResult>;
}
