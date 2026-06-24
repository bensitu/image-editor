export class DomBindings {
    constructor(resolveElement, isDisposed) {
        Object.defineProperty(this, "registry", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "resolveElement", {
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
        this.resolveElement = resolveElement;
        this.isDisposed = isDisposed;
    }
    bindIfExists(key, eventType, handler) {
        const element = this.resolveElement(key);
        if (!element)
            return false;
        const wrapped = (event) => {
            if (this.isDisposed())
                return;
            handler(event);
        };
        element.addEventListener(eventType, wrapped);
        this.registry.push({ elementKey: key, element, eventType, handler: wrapped });
        return true;
    }
    removeAll() {
        for (const entry of this.registry) {
            try {
                entry.element.removeEventListener(entry.eventType, entry.handler);
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