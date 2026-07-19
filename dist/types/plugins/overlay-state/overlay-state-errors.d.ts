/**
 * Defines Overlay State validation, image, codec, identity, and lifecycle failures.
 *
 * @module
 */
import type { OverlayStateValidationIssue } from './overlay-state-types.js';
export declare class OverlayStateValidationError extends TypeError {
    readonly code = "OVERLAY_STATE_INVALID";
    readonly issues: readonly OverlayStateValidationIssue[];
    constructor(issues: readonly OverlayStateValidationIssue[]);
}
export declare class OverlayStateImageMissingError extends Error {
    readonly code = "OVERLAY_STATE_IMAGE_MISSING";
    constructor();
}
export declare class OverlayStateCodecError extends Error {
    readonly code = "OVERLAY_STATE_CODEC_UNAVAILABLE";
    constructor(kind: string, message?: string);
}
export declare class OverlayStateIdConflictError extends Error {
    readonly code = "OVERLAY_STATE_ID_CONFLICT";
    constructor(id: string);
}
export declare class OverlayStatePluginDisposedError extends Error {
    readonly code = "OVERLAY_STATE_PLUGIN_DISPOSED";
    constructor(operation: string);
}
