/**
 * Defines recoverable Overlay object failures isolated during geometry mutations.
 *
 * @module
 */
import { CoreRuntimeError } from '../../core/index.js';
export declare class OverlayRecoverableObjectError extends CoreRuntimeError {
    constructor(message: string, cause?: unknown);
}
