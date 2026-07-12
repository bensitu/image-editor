import { createDisposable, type Disposable } from './disposable.js';
import {
    OperationConflictError,
    OperationRegistrationError,
    PluginKernelDisposedError,
} from './errors.js';

export type OperationId = string;
export type OperationMode = 'idle' | 'busy' | 'animation';

export interface OperationDefinition {
    readonly id: OperationId;
    readonly mode: OperationMode;
    readonly allowedDuringTool?: readonly string[];
}

export interface OperationToken extends Disposable {
    readonly id: OperationId;
    readonly ownerPluginId: string;
    readonly active: boolean;
}

interface RegisteredOperation {
    readonly definition: OperationDefinition;
    readonly ownerPluginId: string;
}

export class OperationRegistry implements Disposable {
    private readonly operations = new Map<OperationId, RegisteredOperation>();
    private activeToken: OperationToken | null = null;
    private disposed = false;

    register(definition: OperationDefinition, ownerPluginId: string): Disposable {
        this.assertActive('register an operation');
        if (definition.id.trim().length === 0 || definition.id.trim() !== definition.id) {
            throw new OperationRegistrationError(
                'Operation id must be a non-empty trimmed string.',
                ownerPluginId,
            );
        }
        if (!['idle', 'busy', 'animation'].includes(definition.mode)) {
            throw new OperationRegistrationError(
                `Operation "${definition.id}" has invalid mode "${definition.mode}".`,
                ownerPluginId,
            );
        }
        const existing = this.operations.get(definition.id);
        if (existing) {
            throw new OperationRegistrationError(
                `Operation "${definition.id}" is already registered by "${existing.ownerPluginId}".`,
                ownerPluginId,
            );
        }
        const frozenDefinition: OperationDefinition = Object.freeze({
            ...definition,
            allowedDuringTool: definition.allowedDuringTool
                ? Object.freeze([...definition.allowedDuringTool])
                : undefined,
        });
        const record = { definition: frozenDefinition, ownerPluginId };
        this.operations.set(definition.id, record);
        return createDisposable(() => {
            if (this.operations.get(definition.id) !== record) return;
            if (this.activeToken?.id === definition.id) this.activeToken.dispose();
            this.operations.delete(definition.id);
        });
    }

    begin(operationId: OperationId, ownerPluginId: string): OperationToken {
        this.assertActive('begin an operation');
        const registered = this.operations.get(operationId);
        if (!registered) {
            throw new OperationConflictError(
                `Operation "${operationId}" is not registered.`,
                ownerPluginId,
            );
        }
        if (registered.ownerPluginId !== ownerPluginId) {
            throw new OperationConflictError(
                `Operation "${operationId}" belongs to "${registered.ownerPluginId}", not "${ownerPluginId}".`,
                ownerPluginId,
            );
        }
        if (this.activeToken) {
            throw new OperationConflictError(
                `Operation "${operationId}" cannot start while "${this.activeToken.id}" is active.`,
                ownerPluginId,
            );
        }

        let active = true;
        const token: OperationToken = {
            id: operationId,
            ownerPluginId,
            get active() {
                return active;
            },
            dispose: () => {
                if (!active) return;
                active = false;
                if (this.activeToken === token) this.activeToken = null;
            },
        };
        this.activeToken = Object.freeze(token);
        return this.activeToken;
    }

    /** @internal Acquires a registered operation on behalf of the Core coordinator. */
    beginForHost(operationId: OperationId): OperationToken {
        this.assertActive('begin an operation');
        const registered = this.operations.get(operationId);
        if (!registered) {
            throw new OperationConflictError(
                `Operation "${operationId}" is not registered.`,
                '@bensitu/core',
            );
        }
        return this.begin(operationId, registered.ownerPluginId);
    }

    has(operationId: OperationId): boolean {
        this.assertActive('inspect an operation');
        return this.operations.has(operationId);
    }

    get(operationId: OperationId): OperationDefinition | null {
        this.assertActive('inspect an operation');
        return this.operations.get(operationId)?.definition ?? null;
    }

    isActive(operationId?: OperationId): boolean {
        this.assertActive('inspect operation state');
        return operationId ? this.activeToken?.id === operationId : this.activeToken !== null;
    }

    dispose(): void {
        if (this.disposed) return;
        this.activeToken?.dispose();
        this.activeToken = null;
        this.operations.clear();
        this.disposed = true;
    }

    private assertActive(operation: string): void {
        if (this.disposed) throw new PluginKernelDisposedError(operation);
    }
}
