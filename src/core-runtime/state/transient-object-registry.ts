/**
 * Registers Plugin-owned predicates that exclude transient Canvas objects from snapshots.
 *
 * @module
 */

import { createDisposable, type Disposable } from '../../plugin-kernel/disposable.js';
import { isRuntimeIdentifier } from '../../plugin-kernel/plugin-identifier.js';
import { StateRegistrationError } from '../errors.js';
import type { StateWarningSink } from './state-types.js';

export type TransientObjectPredicate<TObject = unknown> = (object: TObject) => boolean;

interface PredicateRecord<TObject> {
    readonly owner: string;
    readonly predicate: TransientObjectPredicate<TObject>;
}

export class TransientObjectRegistry<TObject = unknown> implements Disposable {
    private readonly predicates: {
        readonly records: PredicateRecord<TObject>[];
        snapshot: readonly PredicateRecord<TObject>[];
    } = {
        records: [],
        snapshot: Object.freeze([]),
    };
    private disposed = false;

    constructor(private readonly warningSink?: StateWarningSink) {}

    register(owner: string, predicate: TransientObjectPredicate<TObject>): Disposable {
        this.assertActive();
        if (!isRuntimeIdentifier(owner)) {
            throw new StateRegistrationError('Invalid transient predicate owner Runtime ID.');
        }
        if (typeof predicate !== 'function') {
            throw new StateRegistrationError(
                `Transient predicate for "${owner}" must be a function.`,
            );
        }
        const record = { owner, predicate };
        this.predicates.records.push(record);
        this.predicates.snapshot = Object.freeze([...this.predicates.records]);
        return createDisposable(() => {
            const index = this.predicates.records.indexOf(record);
            if (index < 0) return;
            this.predicates.records.splice(index, 1);
            this.predicates.snapshot = Object.freeze([...this.predicates.records]);
        });
    }

    isTransient(object: TObject): boolean {
        this.assertActive();
        const snapshot = this.predicates.snapshot;
        for (const record of snapshot) {
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
        this.predicates.records.length = 0;
        this.predicates.snapshot = Object.freeze([]);
        this.disposed = true;
    }

    private assertActive(): void {
        if (this.disposed)
            throw new StateRegistrationError('Transient object registry is disposed.');
    }
}
