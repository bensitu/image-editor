/**
 * Overlay-state migration boundary.
 *
 * v1 has no older format yet, but validation and import both pass through
 * this module so future versions can add migrations without changing the
 * public ImageEditor API.
 *
 * @module
 */
import type { OverlayMigrationResult } from './overlay-state-types.js';
export declare function migrateOverlayState(input: unknown): OverlayMigrationResult;
