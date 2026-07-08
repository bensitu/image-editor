/**
 * Overlay-state migration boundary.
 *
 * The currently supported wire format is overlay-state schema version 1.
 * There is no older overlay-state schema to migrate from yet, but validation
 * and import pass through this module so future overlay-state schema versions
 * can add migrations without changing the public ImageEditor API.
 *
 * @module
 */
import type { OverlayMigrationResult } from './overlay-state-types.js';
export declare function migrateOverlayState(input: unknown): OverlayMigrationResult;
