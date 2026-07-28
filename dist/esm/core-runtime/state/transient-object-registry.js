import { createDisposable } from '../../plugin-kernel/disposable.js';
import { isRuntimeIdentifier } from '../../plugin-kernel/plugin-identifier.js';
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
            value: {
                records: [],
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
    register(owner, predicate) {
        this.assertActive();
        if (!isRuntimeIdentifier(owner)) {
            throw new StateRegistrationError('Invalid transient predicate owner Runtime ID.');
        }
        if (typeof predicate !== 'function') {
            throw new StateRegistrationError(`Transient predicate for "${owner}" must be a function.`);
        }
        const record = { owner, predicate };
        this.predicates.records.push(record);
        this.predicates.snapshot = Object.freeze([...this.predicates.records]);
        return createDisposable(() => {
            const index = this.predicates.records.indexOf(record);
            if (index < 0)
                return;
            this.predicates.records.splice(index, 1);
            this.predicates.snapshot = Object.freeze([...this.predicates.records]);
        });
    }
    isTransient(object) {
        var _a;
        this.assertActive();
        const snapshot = this.predicates.snapshot;
        for (const record of snapshot) {
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
        this.predicates.records.length = 0;
        this.predicates.snapshot = Object.freeze([]);
        this.disposed = true;
    }
    assertActive() {
        if (this.disposed)
            throw new StateRegistrationError('Transient object registry is disposed.');
    }
}
//# sourceMappingURL=transient-object-registry.js.map