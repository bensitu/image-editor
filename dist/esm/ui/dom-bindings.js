export class DomBindings {
    constructor(resolveElementId, isDisposed) {
        Object.defineProperty(this, "registry", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "resolveElementId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "isDisposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.resolveElementId = resolveElementId;
        this.isDisposed = isDisposed;
    }
    bindIfExists(key, eventType, handler) {
        const id = this.resolveElementId(key);
        if (!id)
            return false;
        const el = document.getElementById(id);
        if (!el)
            return false;
        const wrapped = (event) => {
            if (this.isDisposed())
                return;
            handler(event);
        };
        el.addEventListener(eventType, wrapped);
        this.registry.push({ elementKey: key, eventType, handler: wrapped });
        return true;
    }
    removeAll() {
        for (const entry of this.registry) {
            const id = this.resolveElementId(entry.elementKey);
            if (!id)
                continue;
            const el = document.getElementById(id);
            if (!el)
                continue;
            try {
                el.removeEventListener(entry.eventType, entry.handler);
            }
            catch {
            }
        }
        this.registry = [];
    }
    size() {
        return this.registry.length;
    }
}
//# sourceMappingURL=dom-bindings.js.map