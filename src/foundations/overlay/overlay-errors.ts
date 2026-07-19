/**
 * Defines recoverable Overlay object failures isolated during geometry mutations.
 *
 * @module
 */

import { CoreRuntimeError } from '../../core/index.js';

export class OverlayRecoverableObjectError extends CoreRuntimeError {
    constructor(message: string, cause?: unknown) {
        super(`[ImageEditor] Recoverable overlay object failure: ${message}`, {
            code: 'OVERLAY_RECOVERABLE_OBJECT_ERROR',
            cause,
            behavior: 'recoverable-object',
        });
    }
}
