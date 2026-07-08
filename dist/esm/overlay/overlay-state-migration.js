function error(path, code, message) {
    return { path, code, message };
}
export function migrateOverlayState(input) {
    const errors = [];
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        errors.push(error('', 'state.invalidRoot', 'Overlay state must be an object.'));
        return { errors, warnings: [] };
    }
    const candidate = input;
    if (candidate.schema !== 'image-editor.overlay-state') {
        errors.push(error('schema', 'state.unsupportedSchema', 'Overlay state schema must be "image-editor.overlay-state".'));
        return { errors, warnings: [] };
    }
    if (typeof candidate.version !== 'number' || !Number.isInteger(candidate.version)) {
        errors.push(error('version', 'state.invalidVersion', 'Overlay state version is invalid.'));
        return { errors, warnings: [] };
    }
    if (candidate.version > 1) {
        errors.push(error('version', 'state.futureVersion', `Overlay state version ${candidate.version} is newer than supported version 1.`));
        return { errors, warnings: [] };
    }
    if (candidate.version !== 1) {
        errors.push(error('version', 'state.unsupportedVersion', `Overlay state version ${candidate.version} is not supported.`));
        return { errors, warnings: [] };
    }
    return { state: candidate, errors, warnings: [] };
}
//# sourceMappingURL=overlay-state-migration.js.map