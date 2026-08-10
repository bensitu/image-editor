export class CanvasPropertyLease {
    constructor(target, key, owned) {
        Object.defineProperty(this, "target", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: target
        });
        Object.defineProperty(this, "key", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: key
        });
        Object.defineProperty(this, "owned", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: owned
        });
        Object.defineProperty(this, "previous", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "active", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        this.previous = target[key];
        target[key] = owned;
    }
    dispose() {
        if (!this.active)
            return;
        this.active = false;
        if (this.target[this.key] === this.owned) {
            this.target[this.key] = this.previous;
        }
    }
}
export class CanvasPropertyLeaseGroup {
    constructor() {
        Object.defineProperty(this, "leases", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "active", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
    }
    add(lease) {
        if (!this.active) {
            lease.dispose();
            throw new Error('[ImageEditor] Cannot add a Canvas property lease after release.');
        }
        this.leases.push(lease);
        return lease;
    }
    dispose() {
        if (!this.active)
            return;
        this.active = false;
        for (const lease of this.leases.reverse())
            lease.dispose();
        this.leases.length = 0;
    }
}
//# sourceMappingURL=canvas-property-lease.js.map