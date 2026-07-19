/**
 * Registers versioned Plugin state slices used by snapshot and memento workflows.
 *
 * @module
 */

import { createDisposable, type Disposable } from '../../plugin-kernel/disposable.js';
import { isRuntimeIdentifier } from '../../plugin-kernel/plugin-identifier.js';
import { StateRegistrationError } from '../errors.js';
import type { StateSliceDefinition } from './state-types.js';

function assertDefinition(definition: StateSliceDefinition): void {
    if (!isRuntimeIdentifier(definition.id)) {
        throw new StateRegistrationError('Invalid State Slice Runtime ID.', definition.id);
    }
    if (!Number.isSafeInteger(definition.version) || definition.version <= 0) {
        throw new StateRegistrationError(
            `State slice "${definition.id}" must use a positive integer version.`,
            definition.id,
        );
    }
    if (
        typeof definition.capture !== 'function' ||
        typeof definition.validate !== 'function' ||
        typeof definition.restore !== 'function'
    ) {
        throw new StateRegistrationError(
            `State slice "${definition.id}" has an incomplete contract.`,
            definition.id,
        );
    }
    if (
        definition.capturePolicy !== undefined &&
        definition.capturePolicy !== 'always' &&
        definition.capturePolicy !== 'reference'
    ) {
        throw new StateRegistrationError(
            `State slice "${definition.id}" capturePolicy must be "always" or "reference".`,
            definition.id,
        );
    }
}

export class StateSliceRegistry implements Disposable {
    private readonly definitions = new Map<string, StateSliceDefinition>();
    private disposed = false;

    register<TState>(definition: StateSliceDefinition<TState>): Disposable {
        this.assertActive();
        assertDefinition(definition);
        if (this.definitions.has(definition.id)) {
            throw new StateRegistrationError(
                `State slice "${definition.id}" is already registered.`,
                definition.id,
            );
        }
        const stored = Object.freeze({
            ...definition,
            capturePolicy: definition.capturePolicy ?? 'always',
        }) as StateSliceDefinition<TState>;
        this.definitions.set(definition.id, stored as StateSliceDefinition);
        return createDisposable(() => {
            if (this.definitions.get(definition.id) === stored) {
                this.definitions.delete(definition.id);
            }
        });
    }

    get(id: string): StateSliceDefinition | null {
        this.assertActive();
        return this.definitions.get(id) ?? null;
    }

    list(): readonly StateSliceDefinition[] {
        this.assertActive();
        return Object.freeze([...this.definitions.values()]);
    }

    dispose(): void {
        if (this.disposed) return;
        this.definitions.clear();
        this.disposed = true;
    }

    private assertActive(): void {
        if (this.disposed) throw new StateRegistrationError('State slice registry is disposed.');
    }
}
