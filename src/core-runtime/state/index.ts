export { cloneStateValue, isDangerousStateKey } from './clone-state-value.js';
export { MementoService, type MementoRestoreOptions } from './memento-service.js';
export {
    ObjectPropertyRegistry,
    type ObjectPropertyRegistration,
} from './object-property-registry.js';
export {
    DEFAULT_SNAPSHOT_LIMITS,
    SnapshotService,
    migrateV2SnapshotToV3,
    type SnapshotLimits,
    type SnapshotLoadOptions,
    type SnapshotMigrationResult,
} from './snapshot-service.js';
export { StateSliceRegistry } from './state-slice-registry.js';
export type {
    CoreMemento,
    CoreStateAdapter,
    EditorSnapshotV3,
    MissingPluginPolicy,
    PluginMementoEntry,
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
