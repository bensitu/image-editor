import { createDisposable } from '../../plugin-kernel/disposable.js';
import { isRuntimeIdentifier } from '../../plugin-kernel/runtime-identifier.js';
import { StateRegistrationError } from '../errors.js';
function assertDefinition(definition) {
    if (!isRuntimeIdentifier(definition.id)) {
        throw new StateRegistrationError('State slice id must match "namespace:kebab-case".', definition.id);
    }
    if (!Number.isSafeInteger(definition.version) || definition.version <= 0) {
        throw new StateRegistrationError(`State slice "${definition.id}" must use a positive integer version.`, definition.id);
    }
    if (typeof definition.capture !== 'function' ||
        typeof definition.validate !== 'function' ||
        typeof definition.restore !== 'function') {
        throw new StateRegistrationError(`State slice "${definition.id}" has an incomplete contract.`, definition.id);
    }
    if (definition.capturePolicy !== undefined &&
        definition.capturePolicy !== 'always' &&
        definition.capturePolicy !== 'reference') {
        throw new StateRegistrationError(`State slice "${definition.id}" capturePolicy must be "always" or "reference".`, definition.id);
    }
}
export class StateSliceRegistry {
    constructor() {
        Object.defineProperty(this, "definitions", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    register(definition) {
        var _a;
        this.assertActive();
        assertDefinition(definition);
        if (this.definitions.has(definition.id)) {
            throw new StateRegistrationError(`State slice "${definition.id}" is already registered.`, definition.id);
        }
        const stored = Object.freeze({
            ...definition,
            capturePolicy: (_a = definition.capturePolicy) !== null && _a !== void 0 ? _a : 'always',
        });
        this.definitions.set(definition.id, stored);
        return createDisposable(() => {
            if (this.definitions.get(definition.id) === stored) {
                this.definitions.delete(definition.id);
            }
        });
    }
    get(id) {
        var _a;
        this.assertActive();
        return (_a = this.definitions.get(id)) !== null && _a !== void 0 ? _a : null;
    }
    list() {
        this.assertActive();
        return Object.freeze([...this.definitions.values()]);
    }
    dispose() {
        if (this.disposed)
            return;
        this.definitions.clear();
        this.disposed = true;
    }
    assertActive() {
        if (this.disposed)
            throw new StateRegistrationError('State slice registry is disposed.');
    }
}
//# sourceMappingURL=state-slice-registry.js.map