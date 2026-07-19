/**
 * Registers versioned Plugin state slices used by snapshot and memento workflows.
 *
 * @module
 */
import { type Disposable } from '../../plugin-kernel/disposable.js';
import type { StateSliceDefinition } from './state-types.js';
export declare class StateSliceRegistry implements Disposable {
    private readonly definitions;
    private disposed;
    register<TState>(definition: StateSliceDefinition<TState>): Disposable;
    get(id: string): StateSliceDefinition | null;
    list(): readonly StateSliceDefinition[];
    dispose(): void;
    private assertActive;
}
