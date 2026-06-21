export class DomBindings {
    constructor(resolveElementId, isDisposed, resolveDocument = () => typeof document !== 'undefined' ? document : null) {
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
        Object.defineProperty(this, "resolveDocument", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.resolveElementId = resolveElementId;
        this.isDisposed = isDisposed;
        this.resolveDocument = resolveDocument;
    }
    bindIfExists(key, eventType, handler) {
        const id = this.resolveElementId(key);
        if (!id)
            return false;
        const ownerDocument = this.resolveDocument();
        if (!ownerDocument)
            return false;
        const element = ownerDocument.getElementById(id);
        if (!element)
            return false;
        const wrapped = (event) => {
            if (this.isDisposed())
                return;
            handler(event);
        };
        element.addEventListener(eventType, wrapped);
        this.registry.push({ elementKey: key, eventType, handler: wrapped });
        return true;
    }
    removeAll() {
        for (const entry of this.registry) {
            const id = this.resolveElementId(entry.elementKey);
            if (!id)
                continue;
            const ownerDocument = this.resolveDocument();
            if (!ownerDocument)
                continue;
            const element = ownerDocument.getElementById(id);
            if (!element)
                continue;
            try {
                element.removeEventListener(entry.eventType, entry.handler);
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