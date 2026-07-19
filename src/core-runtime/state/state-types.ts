/**
 * Declares state slices, mementos, snapshots, migrations, restore modes, and warnings.
 *
 * @module
 */

import type { MaybePromise } from '../../plugin-kernel/disposable.js';

export type StateCaptureMode = 'memento' | 'snapshot';
export type StateRestoreMode = 'trusted-memento' | 'public-snapshot' | 'rollback';

export interface StateCaptureContext {
    readonly mode: StateCaptureMode;
    readonly capturedAt: number;
}

export interface StateValidationContext {
    readonly sliceId: string;
    readonly version: number;
}

export type StateValidationResult<TState> =
    | { readonly valid: true; readonly value: TState }
    | { readonly valid: false; readonly message: string; readonly path?: string };

export interface StateRestoreContext {
    readonly mode: StateRestoreMode;
    readonly signal: AbortSignal;
}

export type MementoCapturePolicy = 'always' | 'reference';

export interface StateSliceDefinition<TState = unknown> {
    readonly id: string;
    readonly version: number;
    readonly capturePolicy?: MementoCapturePolicy;
    capture(context: StateCaptureContext): TState;
    validate(value: unknown, context: StateValidationContext): StateValidationResult<TState>;
    restore(state: TState, context: StateRestoreContext): MaybePromise<void>;
    clearState?(context: StateRestoreContext): MaybePromise<void>;
}

export interface PluginMementoEntry {
    readonly version: number;
    readonly data: unknown;
}

export interface MementoPluginEntry extends PluginMementoEntry {
    readonly capturePolicy: MementoCapturePolicy;
}

declare const coreMementoBrand: unique symbol;

/** Trusted internal state. Only MementoService can create a runtime-valid instance. */
export interface CoreMemento {
    readonly revision: number;
    readonly capturedAt: number;
    readonly core: Readonly<Record<string, unknown>>;
    readonly plugins: Readonly<Record<string, MementoPluginEntry>>;
    readonly [coreMementoBrand]: true;
}

export interface CoreStateAdapter {
    capture(context: StateCaptureContext): Record<string, unknown>;
    restore(
        state: Readonly<Record<string, unknown>>,
        context: StateRestoreContext,
    ): MaybePromise<void>;
    validateSnapshot(value: unknown): StateValidationResult<Readonly<Record<string, unknown>>>;
}

export interface EditorSnapshot {
    readonly schema: 'image-editor.state';
    readonly version: 3;
    readonly core: Readonly<Record<string, unknown>>;
    readonly plugins: Readonly<Record<string, PluginMementoEntry>>;
}

export type EditorSnapshotSchema = 'image-editor.state@3';

export interface SnapshotMigrationContext {
    readonly signal?: AbortSignal;
}

export interface SnapshotMigration {
    readonly sourceSchema: string;
    readonly targetSchema: EditorSnapshotSchema;
    canMigrate(input: unknown): boolean;
    migrate(input: unknown, context: SnapshotMigrationContext): MaybePromise<unknown>;
}

export type MissingPluginPolicy = 'warn-and-skip' | 'preserve-opaque' | 'error';

export interface StateWarning {
    readonly code: string;
    readonly message: string;
    readonly sliceId?: string;
    readonly details?: Readonly<Record<string, unknown>>;
}

export type StateWarningSink = (warning: StateWarning) => void;
