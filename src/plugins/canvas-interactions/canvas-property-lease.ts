/**
 * Temporarily owns mutable Canvas properties without overwriting later Host changes.
 *
 * @module
 */

import type { Disposable } from '../../sdk/index.js';

export class CanvasPropertyLease<
    TObject extends object,
    TKey extends keyof TObject,
> implements Disposable {
    private readonly previous: TObject[TKey];
    private active = true;

    constructor(
        private readonly target: TObject,
        private readonly key: TKey,
        private readonly owned: TObject[TKey],
    ) {
        this.previous = target[key];
        target[key] = owned;
    }

    dispose(): void {
        if (!this.active) return;
        this.active = false;
        if (this.target[this.key] === this.owned) {
            this.target[this.key] = this.previous;
        }
    }
}

export class CanvasPropertyLeaseGroup implements Disposable {
    private readonly leases: Disposable[] = [];
    private active = true;

    add<TDisposable extends Disposable>(lease: TDisposable): TDisposable {
        if (!this.active) {
            lease.dispose();
            throw new Error('[ImageEditor] Cannot add a Canvas property lease after release.');
        }
        this.leases.push(lease);
        return lease;
    }

    dispose(): void {
        if (!this.active) return;
        this.active = false;
        for (const lease of this.leases.reverse()) lease.dispose();
        this.leases.length = 0;
    }
}
