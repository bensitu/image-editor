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

import type {
    OverlayMigrationResult,
    OverlayState,
    OverlayValidationError,
} from './overlay-state-types.js';

function error(path: string, code: string, message: string): OverlayValidationError {
    return { path, code, message };
}

export function migrateOverlayState(input: unknown): OverlayMigrationResult {
    const errors: OverlayValidationError[] = [];
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        errors.push(error('', 'state.invalidRoot', 'Overlay state must be an object.'));
        return { errors, warnings: [] };
    }

    const candidate = input as Record<string, unknown>;
    if (candidate.schema !== 'image-editor.overlay-state') {
        errors.push(
            error(
                'schema',
                'state.unsupportedSchema',
                'Overlay state schema must be "image-editor.overlay-state".',
            ),
        );
        return { errors, warnings: [] };
    }

    if (typeof candidate.version !== 'number' || !Number.isInteger(candidate.version)) {
        errors.push(error('version', 'state.invalidVersion', 'Overlay state version is invalid.'));
        return { errors, warnings: [] };
    }
    if (candidate.version > 1) {
        errors.push(
            error(
                'version',
                'state.futureVersion',
                `Overlay state version ${candidate.version} is newer than supported overlay-state schema version 1.`,
            ),
        );
        return { errors, warnings: [] };
    }
    if (candidate.version !== 1) {
        errors.push(
            error(
                'version',
                'state.unsupportedVersion',
                `Overlay state version ${candidate.version} is not supported.`,
            ),
        );
        return { errors, warnings: [] };
    }

    return { state: candidate as unknown as OverlayState, errors, warnings: [] };
}
