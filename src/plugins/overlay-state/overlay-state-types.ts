export const OVERLAY_STATE_SCHEMA = 'image-editor.overlay-state' as const;
export const OVERLAY_STATE_WIRE_VERSION = 1 as const;
export const OVERLAY_STATE_COORDINATE_SPACE = 'image-normalized' as const;

export interface OverlayStateImageReference {
    readonly naturalWidth: number;
    readonly naturalHeight: number;
    readonly mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
    readonly sourceId?: string;
    readonly checksum?: string;
}

export interface OverlayStateCodecReference {
    readonly type: string;
    readonly version: string;
}

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

export interface OverlayStateDocument {
    readonly schema: typeof OVERLAY_STATE_SCHEMA;
    readonly version: typeof OVERLAY_STATE_WIRE_VERSION;
    readonly coordinateSpace: typeof OVERLAY_STATE_COORDINATE_SPACE;
    readonly image: OverlayStateImageReference;
    readonly overlays: readonly OverlayStateItem[];
    readonly metadata?: Readonly<Record<string, unknown>>;
}

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

export interface OverlayStateValidationIssue {
    readonly code: string;
    readonly path: string;
    readonly message: string;
}

export type OverlayStateMissingKindPolicy = 'error' | 'skip';

export interface OverlayStateValidationOptions {
    readonly missingKindPolicy?: OverlayStateMissingKindPolicy;
    readonly limits?: Partial<OverlayStateLimits>;
}

export interface OverlayStateMigrationOptions {
    readonly limits?: Partial<OverlayStateLimits>;
}

export interface OverlayStateValidationResult {
    readonly valid: boolean;
    readonly document?: OverlayStateDocument;
    readonly errors: readonly OverlayStateValidationIssue[];
}

export interface OverlayStateExportOptions {
    readonly kinds?: readonly string[];
    readonly includeHidden?: boolean;
    readonly missingKindPolicy?: OverlayStateMissingKindPolicy;
    readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface OverlayStateImportOptions {
    readonly mode?: 'replace' | 'append';
    readonly idConflict?: 'error' | 'regenerate';
    readonly missingKindPolicy?: OverlayStateMissingKindPolicy;
    readonly limits?: Partial<OverlayStateLimits>;
}

export interface OverlayStateImportResult {
    readonly mode: 'replace' | 'append';
    readonly imported: number;
    readonly skipped: number;
    readonly idMap: Readonly<Record<string, string>>;
}

export interface OverlayStatePluginOptions {
    readonly limits?: Partial<OverlayStateLimits>;
}

export interface OverlayStatePluginApi {
    validate(
        payload: unknown,
        options?: OverlayStateValidationOptions,
    ): OverlayStateValidationResult;
    migrate(payload: unknown, options?: OverlayStateMigrationOptions): OverlayStateDocument;
    exportState(options?: OverlayStateExportOptions): OverlayStateDocument;
    importState(
        payload: unknown,
        options?: OverlayStateImportOptions,
    ): Promise<OverlayStateImportResult>;
}
