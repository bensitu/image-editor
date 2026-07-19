/**
 * Publishes Core state, snapshot, memento, slice, and transient-object contracts.
 *
 * @module
 */

export {
    assertSafeImmutableReference,
    cloneStateValue,
    isDangerousStateKey,
} from './clone-state-value.js';
export { MementoService, type MementoRestoreOptions } from './memento-service.js';
export {
    ObjectPropertyRegistry,
    type ObjectPropertyRegistration,
} from './object-property-registry.js';
export {
    DEFAULT_SNAPSHOT_LIMITS,
    SnapshotService,
    type PreparedSnapshotLoad,
    type SnapshotLimits,
    type SnapshotLoadOptions,
} from './snapshot-service.js';
export { StateSliceRegistry } from './state-slice-registry.js';
export type {
    CoreMemento,
    CoreStateAdapter,
    EditorSnapshotSchema,
    EditorSnapshot,
    MissingPluginPolicy,
    MementoCapturePolicy,
    MementoPluginEntry,
    PluginMementoEntry,
    SnapshotMigration,
    SnapshotMigrationContext,
    StateCaptureContext,
    StateCaptureMode,
    StateRestoreContext,
    StateRestoreMode,
    StateSliceDefinition,
    StateValidationContext,
    StateValidationResult,
    StateWarning,
    StateWarningSink,
} from './state-types.js';
export {
    TransientObjectRegistry,
    type TransientObjectPredicate,
} from './transient-object-registry.js';
