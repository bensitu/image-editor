import { createDisposable, type Disposable } from '../../plugin-kernel/disposable.js';
import { StateRegistrationError } from '../errors.js';
import type { StateSliceDefinition } from './state-types.js';

const sliceIdPattern = /^@?[a-z0-9][a-z0-9._:/@-]*$/i;

function assertDefinition(definition: StateSliceDefinition): void {
    if (!sliceIdPattern.test(definition.id) || definition.id.trim() !== definition.id) {
        throw new StateRegistrationError(
            'State slice ids must be non-empty, trimmed, and namespace-safe.',
            definition.id,
        );
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
        const stored = Object.freeze({ ...definition }) as StateSliceDefinition<TState>;
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
