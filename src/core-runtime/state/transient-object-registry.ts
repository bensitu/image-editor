import { createDisposable, type Disposable } from '../../plugin-kernel/disposable.js';
import { StateRegistrationError } from '../errors.js';
import type { StateWarningSink } from './state-types.js';

export type TransientObjectPredicate<TObject = unknown> = (object: TObject) => boolean;

interface PredicateRecord<TObject> {
    readonly owner: string;
    readonly predicate: TransientObjectPredicate<TObject>;
}

export class TransientObjectRegistry<TObject = unknown> implements Disposable {
    private readonly predicates: PredicateRecord<TObject>[] = [];
    private disposed = false;

    constructor(private readonly warningSink?: StateWarningSink) {}

    register(owner: string, predicate: TransientObjectPredicate<TObject>): Disposable {
        this.assertActive();
        if (owner.trim().length === 0 || owner.trim() !== owner) {
            throw new StateRegistrationError(
                'Transient predicate owner must be non-empty and trimmed.',
            );
        }
        if (typeof predicate !== 'function') {
            throw new StateRegistrationError(
                `Transient predicate for "${owner}" must be a function.`,
            );
        }
        const record = { owner, predicate };
        this.predicates.push(record);
        return createDisposable(() => {
            const index = this.predicates.indexOf(record);
            if (index >= 0) this.predicates.splice(index, 1);
        });
    }

    isTransient(object: TObject): boolean {
        this.assertActive();
        for (const record of [...this.predicates]) {
            try {
                if (record.predicate(object)) return true;
            } catch (error) {
                this.warningSink?.({
                    code: 'TRANSIENT_PREDICATE_FAILED',
                    message: `Transient object predicate owned by "${record.owner}" failed and was ignored.`,
                    details: Object.freeze({ owner: record.owner, cause: error }),
                });
            }
        }
        return false;
    }

    dispose(): void {
        if (this.disposed) return;
        this.predicates.length = 0;
        this.disposed = true;
    }

    private assertActive(): void {
        if (this.disposed)
            throw new StateRegistrationError('Transient object registry is disposed.');
    }
}
