/**
 * Converts Overlay State wire format 1 into wire format 2.
 *
 * The converter is deliberately kept in the optional migrate-v2 entry so the
 * runtime Overlay State Plugin does not depend on source-format feature knowledge.
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
    /** How wire format 1 overlays without a wire format 2 State Codec are handled. @defaultValue `'error'` */
    readonly unsupportedOverlayPolicy?: OverlayStateV1UnsupportedPolicy;
    /** How a wire format 1 Base Image transform that cannot be represented in wire format 2 is handled. @defaultValue `'error'` */
    readonly baseImageTransformPolicy?: OverlayStateV1TransformPolicy;
    readonly onWarning?: (warning: OverlayStateV1MigrationWarning) => void;
}
export declare class OverlayStateV1MigrationError extends TypeError {
    readonly code: string;
    readonly path: string;
    readonly name = "OverlayStateV1MigrationError";
    constructor(code: string, message: string, path?: string);
}
/** Converts an Overlay State wire format 1 document into wire format 2. */
export declare function migrateV1OverlayState(input: unknown, options?: OverlayStateV1MigrationOptions): OverlayStateDocument;
