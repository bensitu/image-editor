/**
 * Defines shared semantic conflict-domain sets for Core and official Plugins.
 *
 * @internal
 * @module
 */

import type { OperationConflictDomain } from '../plugin-kernel/operation-registry.js';

export const DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS = Object.freeze([
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

export const PERSISTENT_OVERLAY_MUTATION_CONFLICT_DOMAINS = Object.freeze([
    'document',
    'overlay',
    'selection',
    'state',
] satisfies readonly OperationConflictDomain[]);

export const OVERLAY_AUTHORING_SESSION_CONFLICT_DOMAINS = Object.freeze([
    'overlay',
    'selection',
    'state',
] satisfies readonly OperationConflictDomain[]);
