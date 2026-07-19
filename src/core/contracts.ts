/**
 * Publishes type-only Core extension contracts consumed by the public Plugin SDK.
 *
 * @module
 */

export type { CoreExportContributor } from '../core-runtime/export-contributor-registry.js';
export type { GeometryMutationPort } from '../core-runtime/geometry/geometry-types.js';
export type {
    CoreHistoryCommitPort,
    CoreHistoryRecord,
} from '../core-runtime/history-commit-router.js';
export type {
    DocumentMutationContext,
    DocumentMutationPort,
} from '../core-runtime/mutation/mutation-types.js';
export type { CoreImageInfo, FabricModule, LayoutMode } from '../core-runtime/public-types.js';
export type {
    CoreMemento,
    MementoRestoreOptions,
    ObjectPropertyRegistration,
    StateSliceDefinition,
    TransientObjectPredicate,
} from '../core-runtime/state/index.js';
