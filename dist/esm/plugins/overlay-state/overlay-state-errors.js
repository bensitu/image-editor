export class OverlayStateValidationError extends TypeError {
    constructor(issues) {
        const first = issues[0];
        super(`[ImageEditor] Overlay State is invalid${first ? ` at ${first.path}: ${first.message}` : '.'}`);
        Object.defineProperty(this, "code", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'OVERLAY_STATE_INVALID'
        });
        Object.defineProperty(this, "issues", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.name = 'OverlayStateValidationError';
        this.issues = Object.freeze([...issues]);
    }
}
export class OverlayStateImageMissingError extends Error {
    constructor() {
        super('[ImageEditor] Overlay State requires a loaded Base Image.');
        Object.defineProperty(this, "code", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'OVERLAY_STATE_IMAGE_MISSING'
        });
        this.name = 'OverlayStateImageMissingError';
    }
}
export class OverlayStateCodecError extends Error {
    constructor(kind, message = 'has no compatible State Codec') {
        super(`[ImageEditor] Overlay kind "${kind}" ${message}.`);
        Object.defineProperty(this, "code", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'OVERLAY_STATE_CODEC_UNAVAILABLE'
        });
        this.name = 'OverlayStateCodecError';
    }
}
export class OverlayStateIdConflictError extends Error {
    constructor(id) {
        super(`[ImageEditor] Overlay State ID "${id}" already exists.`);
        Object.defineProperty(this, "code", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'OVERLAY_STATE_ID_CONFLICT'
        });
        this.name = 'OverlayStateIdConflictError';
    }
}
export class OverlayStatePluginDisposedError extends Error {
    constructor(operation) {
        super(`[ImageEditor] Cannot ${operation} after Overlay State Plugin disposal.`);
        Object.defineProperty(this, "code", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'OVERLAY_STATE_PLUGIN_DISPOSED'
        });
        this.name = 'OverlayStatePluginDisposedError';
    }
}
//# sourceMappingURL=overlay-state-errors.js.map