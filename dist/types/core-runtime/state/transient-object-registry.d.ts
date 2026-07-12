import { type Disposable } from '../../plugin-kernel/disposable.js';
import type { StateWarningSink } from './state-types.js';
export type TransientObjectPredicate<TObject = unknown> = (object: TObject) => boolean;
export declare class TransientObjectRegistry<TObject = unknown> implements Disposable {
    private readonly warningSink?;
    private readonly predicates;
    private disposed;
    constructor(warningSink?: StateWarningSink | undefined);
    register(owner: string, predicate: TransientObjectPredicate<TObject>): Disposable;
    isTransient(object: TObject): boolean;
    dispose(): void;
    private assertActive;
}
