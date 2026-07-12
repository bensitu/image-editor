import type * as FabricNS from 'fabric';

import { createDisposable, type Disposable, type MaybePromise } from '../plugin-kernel/index.js';
import { CoreRuntimeError } from './errors.js';
import type { CoreExportOptions } from './public-types.js';

export interface CoreExportRenderContext {
    readonly canvas: FabricNS.StaticCanvas;
    readonly options: Readonly<CoreExportOptions>;
}

export interface CoreExportContributor {
    readonly id: string;
    readonly order: number;
    isEnabled(options: Readonly<CoreExportOptions>): boolean;
    render(context: CoreExportRenderContext): MaybePromise<void>;
}

interface ContributorRecord {
    readonly owner: string;
    readonly contributor: CoreExportContributor;
    readonly registrationOrder: number;
}

export class ExportContributorRegistry implements Disposable {
    private readonly contributors = new Map<string, ContributorRecord>();
    private registrationSequence = 0;
    private disposed = false;

    register(owner: string, contributor: CoreExportContributor): Disposable {
        this.assertActive('register an export contributor');
        if (owner.trim().length === 0 || owner.trim() !== owner) {
            throw new CoreRuntimeError('[ImageEditor] Export contributor owner must be non-empty.');
        }
        if (contributor.id.trim().length === 0 || contributor.id.trim() !== contributor.id) {
            throw new CoreRuntimeError('[ImageEditor] Export contributor id must be non-empty.');
        }
        if (!Number.isFinite(contributor.order)) {
            throw new CoreRuntimeError(
                `[ImageEditor] Export contributor "${contributor.id}" must use a finite order.`,
            );
        }
        const existing = this.contributors.get(contributor.id);
        if (existing) {
            throw new CoreRuntimeError(
                `[ImageEditor] Export contributor "${contributor.id}" is already registered by "${existing.owner}".`,
            );
        }
        const record: ContributorRecord = {
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

    async render(context: CoreExportRenderContext): Promise<void> {
        this.assertActive('render export contributors');
        const records = [...this.contributors.values()].sort(
            (left, right) =>
                left.contributor.order - right.contributor.order ||
                left.registrationOrder - right.registrationOrder,
        );
        for (const record of records) {
            let enabled: boolean;
            try {
                enabled = record.contributor.isEnabled(context.options);
            } catch (error) {
                throw new CoreRuntimeError(
                    `[ImageEditor] Export contributor "${record.contributor.id}" enablement failed.`,
                    { code: 'EXPORT_CONTRIBUTOR_ERROR', cause: error },
                );
            }
            if (!enabled) continue;
            try {
                await record.contributor.render(context);
            } catch (error) {
                throw new CoreRuntimeError(
                    `[ImageEditor] Export contributor "${record.contributor.id}" render failed.`,
                    { code: 'EXPORT_CONTRIBUTOR_ERROR', cause: error },
                );
            }
        }
    }

    dispose(): void {
        if (this.disposed) return;
        this.contributors.clear();
        this.disposed = true;
    }

    private assertActive(operation: string): void {
        if (this.disposed) {
            throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} after disposal.`);
        }
    }
}
