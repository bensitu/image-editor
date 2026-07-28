/**
 * Defines shared semantic conflict-domain sets for Core and official Plugins.
 *
 * @internal
 * @module
 */

import type { OperationConflictDomain } from '../plugin-kernel/operation-registry.js';

export const FULL_DOCUMENT_REPLACEMENT_CONFLICT_DOMAINS = Object.freeze([
    'document',
    'base-image',
    'geometry',
    'raster',
    'overlay',
    'state',
] satisfies readonly OperationConflictDomain[]);

export const GEOMETRY_MUTATION_CONFLICT_DOMAINS = Object.freeze([
    'document',
    'base-image',
    'geometry',
    'overlay',
    'state',
] satisfies readonly OperationConflictDomain[]);

export const RASTER_REPLACEMENT_CONFLICT_DOMAINS = Object.freeze([
    'document',
    'base-image',
    'geometry',
    'raster',
    'overlay',
    'state',
] satisfies readonly OperationConflictDomain[]);

export const STATE_LOAD_CONFLICT_DOMAINS = Object.freeze([
    'document',
    'base-image',
    'geometry',
    'raster',
    'overlay',
    'state',
] satisfies readonly OperationConflictDomain[]);
