/**
 * Defines Filters-specific conflict-domain sets that do not replace the base raster.
 *
 * @internal
 * @module
 */

import type { OperationConflictDomain } from '../../plugin-kernel/operation-registry.js';

export const FILTER_STATE_MUTATION_CONFLICT_DOMAINS = Object.freeze([
    'document',
    'base-image',
    'geometry',
    'raster',
    'overlay',
    'state',
] satisfies readonly OperationConflictDomain[]);
