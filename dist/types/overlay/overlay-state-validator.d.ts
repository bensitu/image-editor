/**
 * Defensive validator for the public overlay-state wire format.
 *
 * Import accepts unknown input, so every field is checked before runtime
 * objects are constructed. The validator returns a normalized overlay-state
 * schema version 1 payload with accepted color strings canonicalized to
 * #RRGGBB or #RRGGBBAA.
 *
 * @module
 */
import type { OverlayValidationOptions, OverlayValidationResult } from './overlay-state-types.js';
export interface ResolvedOverlayValidationLimits {
    maxOverlays: number;
    maxPolygonPoints: number;
    maxDrawStrokes: number;
    maxDrawPointsPerStroke: number;
    maxDrawTotalPoints: number;
    maxTextLength: number;
    maxMetadataDepth: number;
    maxMetadataBytes: number;
}
export declare const DEFAULT_OVERLAY_VALIDATION_LIMITS: ResolvedOverlayValidationLimits;
export declare function validateOverlayState(input: unknown, options?: OverlayValidationOptions): OverlayValidationResult;
