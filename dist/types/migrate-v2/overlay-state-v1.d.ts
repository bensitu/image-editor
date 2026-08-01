/**
 * Converts the legacy Overlay State wire v1 format to the current wire v2 format.
 *
 * The converter is deliberately kept in the optional migrate-v2 entry so the
 * runtime Overlay State Plugin does not depend on legacy feature knowledge.
 *
 * @module
 */
import type { OverlayStateDocument } from '../plugins/overlay-state/index.js';
export type OverlayStateV1UnsupportedPolicy = 'error' | 'skip';
export type OverlayStateV1TransformPolicy = 'error' | 'drop';
export interface OverlayStateV1MigrationWarning {
    readonly code: string;
    readonly path: string;
    readonly message: string;
}
export interface OverlayStateV1MigrationOptions {
    /** How custom v1 overlays without a v2 State Codec are handled. @defaultValue `'error'` */
    readonly unsupportedOverlayPolicy?: OverlayStateV1UnsupportedPolicy;
    /** How a v1 base-image transform that cannot be represented in v2 is handled. @defaultValue `'error'` */
    readonly baseImageTransformPolicy?: OverlayStateV1TransformPolicy;
    readonly onWarning?: (warning: OverlayStateV1MigrationWarning) => void;
}
export declare class OverlayStateV1MigrationError extends TypeError {
    readonly code: string;
    readonly path: string;
    readonly name = "OverlayStateV1MigrationError";
    constructor(code: string, message: string, path?: string);
}
/** Converts a legacy Overlay State wire v1 document into the current wire v2 shape. */
export declare function migrateV1OverlayState(input: unknown, options?: OverlayStateV1MigrationOptions): OverlayStateDocument;
