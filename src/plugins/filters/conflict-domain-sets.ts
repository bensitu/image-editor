/**
 * Defines Filters-specific conflict-domain sets that do not replace the base raster.
 *
 * @internal
 * @module
 */

import type { PluginSetupContext } from '../../sdk/index.js';

type OperationConflictDomains = NonNullable<
    Parameters<PluginSetupContext['operations']['register']>[0]['conflictDomains']
>;

export const FILTER_STATE_MUTATION_CONFLICT_DOMAINS = Object.freeze([
    'document',
    'base-image',
    'geometry',
    'raster',
    'overlay',
    'state',
] satisfies OperationConflictDomains);
