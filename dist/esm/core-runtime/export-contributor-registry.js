import { createDisposable } from '../plugin-kernel/index.js';
import { CoreRuntimeError } from './errors.js';
export class ExportContributorRegistry {
    constructor() {
        Object.defineProperty(this, "contributors", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "registrationSequence", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    register(owner, contributor) {
        this.assertActive('register an export contributor');
        if (owner.trim().length === 0 || owner.trim() !== owner) {
            throw new CoreRuntimeError('[ImageEditor] Export contributor owner must be non-empty.');
        }
        if (contributor.id.trim().length === 0 || contributor.id.trim() !== contributor.id) {
            throw new CoreRuntimeError('[ImageEditor] Export contributor id must be non-empty.');
        }
        if (!Number.isFinite(contributor.order)) {
            throw new CoreRuntimeError(`[ImageEditor] Export contributor "${contributor.id}" must use a finite order.`);
        }
        const existing = this.contributors.get(contributor.id);
        if (existing) {
            throw new CoreRuntimeError(`[ImageEditor] Export contributor "${contributor.id}" is already registered by "${existing.owner}".`);
        }
        const record = {
            owner,
            contributor: Object.freeze({ ...contributor }),
            registrationOrder: this.registrationSequence++,
        };
        this.contributors.set(contributor.id, record);
        return createDisposable(() => {
            if (this.contributors.get(contributor.id) === record) {
                this.contributors.delete(contributor.id);
            }
        });
    }
    async render(context) {
        this.assertActive('render export contributors');
        const records = [...this.contributors.values()].sort((left, right) => left.contributor.order - right.contributor.order ||
            left.registrationOrder - right.registrationOrder);
        for (const record of records) {
            let enabled;
            try {
                enabled = record.contributor.isEnabled(context.options);
            }
            catch (error) {
                throw new CoreRuntimeError(`[ImageEditor] Export contributor "${record.contributor.id}" enablement failed.`, { code: 'EXPORT_CONTRIBUTOR_ERROR', cause: error });
            }
            if (!enabled)
                continue;
            try {
                await record.contributor.render(context);
            }
            catch (error) {
                throw new CoreRuntimeError(`[ImageEditor] Export contributor "${record.contributor.id}" render failed.`, { code: 'EXPORT_CONTRIBUTOR_ERROR', cause: error });
            }
        }
    }
    dispose() {
        if (this.disposed)
            return;
        this.contributors.clear();
        this.disposed = true;
    }
    assertActive(operation) {
        if (this.disposed) {
            throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} after disposal.`);
        }
    }
}
//# sourceMappingURL=export-contributor-registry.js.map