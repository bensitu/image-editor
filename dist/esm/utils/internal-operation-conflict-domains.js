export const DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS = Object.freeze([
    'document',
    'base-image',
    'geometry',
    'raster',
    'overlay',
    'state',
]);
export const GEOMETRY_MUTATION_CONFLICT_DOMAINS = Object.freeze([
    'document',
    'base-image',
    'geometry',
    'overlay',
    'state',
]);
export const PERSISTENT_OVERLAY_MUTATION_CONFLICT_DOMAINS = Object.freeze([
    'document',
    'overlay',
    'selection',
    'state',
]);
export const OVERLAY_AUTHORING_SESSION_CONFLICT_DOMAINS = Object.freeze([
    'overlay',
    'selection',
    'state',
]);
//# sourceMappingURL=internal-operation-conflict-domains.js.map