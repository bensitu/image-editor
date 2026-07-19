/**
 * Coordinates ownership of additional Fabric object properties included in snapshots.
 *
 * @module
 */

import { createDisposable, type Disposable } from '../../plugin-kernel/disposable.js';
import { isRuntimeIdentifier } from '../../plugin-kernel/runtime-identifier.js';
import { StateRegistrationError } from '../errors.js';
import { isDangerousStateKey } from './clone-state-value.js';

export interface ObjectPropertyRegistration {
    readonly owner: string;
    readonly keys: readonly string[];
}

interface PropertyRecord {
    readonly owner: string;
    references: number;
}

function assertIdentifier(value: string, label: string): void {
    if (value.trim().length === 0 || value.trim() !== value) {
        throw new StateRegistrationError(`${label} must be a non-empty trimmed string.`);
    }
}

export class ObjectPropertyRegistry implements Disposable {
    private readonly properties = new Map<string, PropertyRecord>();
    private disposed = false;

    register(registration: ObjectPropertyRegistration): Disposable {
        this.assertActive();
        if (!isRuntimeIdentifier(registration.owner)) {
            throw new StateRegistrationError(
                'Object property owner must match "namespace:kebab-case".',
                registration.owner,
            );
        }
        if (registration.keys.length === 0) {
            throw new StateRegistrationError(
                `Object property registration for "${registration.owner}" must include a key.`,
            );
        }
        const keys = [...new Set(registration.keys)];
        for (const key of keys) {
            assertIdentifier(key, 'Object property key');
            if (isDangerousStateKey(key)) {
                throw new StateRegistrationError(`Object property key "${key}" is forbidden.`);
            }
            const existing = this.properties.get(key);
            if (existing && existing.owner !== registration.owner) {
                throw new StateRegistrationError(
                    `Object property "${key}" is already owned by "${existing.owner}".`,
                );
            }
        }
        for (const key of keys) {
            const existing = this.properties.get(key);
            if (existing) existing.references += 1;
            else this.properties.set(key, { owner: registration.owner, references: 1 });
        }
        return createDisposable(() => {
            for (const key of keys) {
                const record = this.properties.get(key);
                if (!record || record.owner !== registration.owner) continue;
                record.references -= 1;
                if (record.references === 0) this.properties.delete(key);
            }
        });
    }

    listKeys(): readonly string[] {
        this.assertActive();
        return Object.freeze([...this.properties.keys()]);
    }

    getOwner(key: string): string | null {
        this.assertActive();
        return this.properties.get(key)?.owner ?? null;
    }

    dispose(): void {
        if (this.disposed) return;
        this.properties.clear();
        this.disposed = true;
    }

    private assertActive(): void {
        if (this.disposed)
            throw new StateRegistrationError('Object property registry is disposed.');
    }
}
