import type { OverlayStateValidationIssue } from './overlay-state-types.js';

export class OverlayStateValidationError extends TypeError {
    readonly code = 'OVERLAY_STATE_INVALID';
    readonly issues: readonly OverlayStateValidationIssue[];

    constructor(issues: readonly OverlayStateValidationIssue[]) {
        const first = issues[0];
        super(
            `[ImageEditor] Overlay State is invalid${first ? ` at ${first.path}: ${first.message}` : '.'}`,
        );
        this.name = 'OverlayStateValidationError';
        this.issues = Object.freeze([...issues]);
    }
}

export class OverlayStateImageMissingError extends Error {
    readonly code = 'OVERLAY_STATE_IMAGE_MISSING';

    constructor() {
        super('[ImageEditor] Overlay State requires a loaded Base Image.');
        this.name = 'OverlayStateImageMissingError';
    }
}

export class OverlayStateCodecError extends Error {
    readonly code = 'OVERLAY_STATE_CODEC_UNAVAILABLE';

    constructor(kind: string, message = 'has no compatible State Codec') {
        super(`[ImageEditor] Overlay kind "${kind}" ${message}.`);
        this.name = 'OverlayStateCodecError';
    }
}

export class OverlayStateIdConflictError extends Error {
    readonly code = 'OVERLAY_STATE_ID_CONFLICT';

    constructor(id: string) {
        super(`[ImageEditor] Overlay State ID "${id}" already exists.`);
        this.name = 'OverlayStateIdConflictError';
    }
}

export class OverlayStatePluginDisposedError extends Error {
    readonly code = 'OVERLAY_STATE_PLUGIN_DISPOSED';

    constructor(operation: string) {
        super(`[ImageEditor] Cannot ${operation} after Overlay State Plugin disposal.`);
        this.name = 'OverlayStatePluginDisposedError';
    }
}
