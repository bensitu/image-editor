import { createDisposable } from '../../plugin-kernel/disposable.js';
import { isRuntimeIdentifier } from '../../plugin-kernel/plugin-identifier.js';
import { StateRegistrationError } from '../errors.js';
import { isDangerousStateKey } from './clone-state-value.js';
function assertIdentifier(value, label) {
    if (value.trim().length === 0 || value.trim() !== value) {
        throw new StateRegistrationError(`${label} must be a non-empty trimmed string.`);
    }
}
export class ObjectPropertyRegistry {
    constructor() {
        Object.defineProperty(this, "properties", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {
                records: new Map(),
                snapshot: Object.freeze([]),
            }
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    register(registration) {
        this.assertActive();
        if (!isRuntimeIdentifier(registration.owner)) {
            throw new StateRegistrationError('Invalid object property owner Runtime ID.', registration.owner);
        }
        if (registration.keys.length === 0) {
            throw new StateRegistrationError(`Object property registration for "${registration.owner}" must include a key.`);
        }
        const keys = [...new Set(registration.keys)];
        for (const key of keys) {
            assertIdentifier(key, 'Object property key');
            if (isDangerousStateKey(key)) {
                throw new StateRegistrationError(`Object property key "${key}" is forbidden.`);
            }
            const existing = this.properties.records.get(key);
            if (existing && existing.owner !== registration.owner) {
                throw new StateRegistrationError(`Object property "${key}" is already owned by "${existing.owner}".`);
            }
        }
        let keySetChanged = false;
        for (const key of keys) {
            const existing = this.properties.records.get(key);
            if (existing)
                existing.references += 1;
            else {
                this.properties.records.set(key, {
                    owner: registration.owner,
                    references: 1,
                });
                keySetChanged = true;
            }
        }
        if (keySetChanged) {
            this.properties.snapshot = Object.freeze([...this.properties.records.keys()]);
        }
        return createDisposable(() => {
            let registeredKeyRemoved = false;
            for (const key of keys) {
                const record = this.properties.records.get(key);
                if (!record || record.owner !== registration.owner)
                    continue;
                record.references -= 1;
                if (record.references === 0) {
                    this.properties.records.delete(key);
                    registeredKeyRemoved = true;
                }
            }
            if (registeredKeyRemoved) {
                this.properties.snapshot = Object.freeze([...this.properties.records.keys()]);
            }
        });
    }
    listKeys() {
        this.assertActive();
        return this.properties.snapshot;
    }
    getOwner(key) {
        var _a, _b;
        this.assertActive();
        return (_b = (_a = this.properties.records.get(key)) === null || _a === void 0 ? void 0 : _a.owner) !== null && _b !== void 0 ? _b : null;
    }
    dispose() {
        if (this.disposed)
            return;
        this.properties.records.clear();
        this.properties.snapshot = Object.freeze([]);
        this.disposed = true;
    }
    assertActive() {
        if (this.disposed)
            throw new StateRegistrationError('Object property registry is disposed.');
    }
}
//# sourceMappingURL=object-property-registry.js.map