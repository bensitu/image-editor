import { CoreRuntimeError } from '../../core/index.js';
export class OverlayRecoverableObjectError extends CoreRuntimeError {
    constructor(message, cause) {
        super(`[ImageEditor] Recoverable overlay object failure: ${message}`, {
            code: 'OVERLAY_RECOVERABLE_OBJECT_ERROR',
            cause,
            behavior: 'recoverable-object',
        });
    }
}
//# sourceMappingURL=overlay-errors.js.map