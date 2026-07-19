import { createDisposable } from '../../plugin-kernel/disposable.js';
import { isRuntimeIdentifier } from '../../plugin-kernel/runtime-identifier.js';
import { StateRegistrationError } from '../errors.js';
export class TransientObjectRegistry {
    constructor(warningSink) {
        Object.defineProperty(this, "warningSink", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: warningSink
        });
        Object.defineProperty(this, "predicates", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    register(owner, predicate) {
        this.assertActive();
        if (!isRuntimeIdentifier(owner)) {
            throw new StateRegistrationError('Transient predicate owner must match "namespace:kebab-case".');
        }
        if (typeof predicate !== 'function') {
            throw new StateRegistrationError(`Transient predicate for "${owner}" must be a function.`);
        }
        const record = { owner, predicate };
        this.predicates.push(record);
        return createDisposable(() => {
            const index = this.predicates.indexOf(record);
            if (index >= 0)
                this.predicates.splice(index, 1);
        });
    }
    isTransient(object) {
        var _a;
        this.assertActive();
        for (const record of [...this.predicates]) {
            try {
                if (record.predicate(object))
                    return true;
            }
            catch (error) {
                (_a = this.warningSink) === null || _a === void 0 ? void 0 : _a.call(this, {
                    code: 'TRANSIENT_PREDICATE_FAILED',
                    message: `Transient object predicate owned by "${record.owner}" failed and was ignored.`,
                    details: Object.freeze({ owner: record.owner, cause: error }),
                });
            }
        }
        return false;
    }
    dispose() {
        if (this.disposed)
            return;
        this.predicates.length = 0;
        this.disposed = true;
    }
    assertActive() {
        if (this.disposed)
            throw new StateRegistrationError('Transient object registry is disposed.');
    }
}
//# sourceMappingURL=transient-object-registry.js.map