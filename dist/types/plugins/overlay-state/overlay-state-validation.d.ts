import { type OverlayStateLimits, type OverlayStateValidationResult } from './overlay-state-types.js';
export declare const DEFAULT_OVERLAY_STATE_LIMITS: OverlayStateLimits;
export declare function resolveOverlayStateLimits(base?: Partial<OverlayStateLimits>, override?: Partial<OverlayStateLimits>): OverlayStateLimits;
export declare function validateOverlayStateDocument(payload: unknown, limits: OverlayStateLimits): OverlayStateValidationResult;
