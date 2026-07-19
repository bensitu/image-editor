/**
 * Isolates mutable Plugin state within installation-owned namespaces.
 *
 * @module
 */

import { createDisposable, type Disposable } from './disposable.js';
import { InvalidPluginDefinitionError, PluginKernelDisposedError } from './errors.js';
import { assertPluginIdentifier } from './plugin-identifier.js';

export interface ScopedPluginStateStore {
    has(key: string): boolean;
    get<T>(key: string): T | undefined;
    set<T>(key: string, value: T): void;
    delete(key: string): boolean;
    clear(): void;
}

function assertStateKey(key: string): void {
    if (key.trim().length === 0 || key.trim() !== key) {
        throw new InvalidPluginDefinitionError(
            'Plugin state keys must be non-empty trimmed strings.',
        );
    }
}

export class PluginStateStore implements Disposable {
    private readonly stateByPlugin = new Map<string, Map<string, unknown>>();
    private readonly activePluginIds = new Set<string>();
    private disposed = false;

    createScoped(
        pluginId: string,
        registerCleanup: (disposable: Disposable) => void,
        registerFinalizer: (disposable: Disposable) => void,
        isScopeActive: () => boolean,
    ): ScopedPluginStateStore {
        this.assertActive('create plugin state');
        assertPluginIdentifier(pluginId, 'Plugin state owner id');
        if (this.activePluginIds.has(pluginId)) {
            throw new InvalidPluginDefinitionError(
                `Plugin state scope "${pluginId}" is already active.`,
                pluginId,
            );
        }
        this.activePluginIds.add(pluginId);
        let active = true;
        let cleanupRegistered = false;
        const cleanup = createDisposable(() => {
            this.stateByPlugin.delete(pluginId);
        });
        try {
            registerFinalizer(
                createDisposable(() => {
                    this.stateByPlugin.delete(pluginId);
                    this.activePluginIds.delete(pluginId);
                    active = false;
                }),
            );
        } catch (error) {
            this.activePluginIds.delete(pluginId);
            throw error;
        }

        const assertScopedActive = (): void => {
            this.assertActive('access plugin state');
            if (!active || !isScopeActive()) {
                throw new PluginKernelDisposedError(`access state for plugin "${pluginId}"`);
            }
        };
        const activate = (): Map<string, unknown> => {
            assertScopedActive();
            if (!cleanupRegistered) {
                registerCleanup(cleanup);
                cleanupRegistered = true;
            }
            let namespace = this.stateByPlugin.get(pluginId);
            if (!namespace) {
                namespace = new Map();
                this.stateByPlugin.set(pluginId, namespace);
            }
            return namespace;
        };

        return Object.freeze({
            has: (key: string): boolean => {
                assertStateKey(key);
                assertScopedActive();
                return this.stateByPlugin.get(pluginId)?.has(key) ?? false;
            },
            get: <T>(key: string): T | undefined => {
                assertStateKey(key);
                assertScopedActive();
                return this.stateByPlugin.get(pluginId)?.get(key) as T | undefined;
            },
            set: <T>(key: string, value: T): void => {
                assertStateKey(key);
                activate().set(key, value);
            },
            delete: (key: string): boolean => {
                assertStateKey(key);
                assertScopedActive();
                return this.stateByPlugin.get(pluginId)?.delete(key) ?? false;
            },
            clear: (): void => {
                assertScopedActive();
                this.stateByPlugin.get(pluginId)?.clear();
            },
        });
    }

    hasPluginState(pluginId: string): boolean {
        this.assertActive('inspect plugin state');
        return this.stateByPlugin.has(pluginId);
    }

    dispose(): void {
        if (this.disposed) return;
        this.stateByPlugin.clear();
        this.activePluginIds.clear();
        this.disposed = true;
    }

    private assertActive(operation: string): void {
        if (this.disposed) throw new PluginKernelDisposedError(operation);
    }
}
