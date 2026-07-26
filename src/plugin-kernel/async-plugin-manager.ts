/**
 * Adds internal asynchronous Plugin setup and composed dependency installation to the Plugin Host.
 *
 * @module
 */

import { createDisposable } from './disposable.js';
import {
    InvalidPluginDefinitionError,
    PluginAggregateError,
    PluginAlreadyInstalledError,
    PluginKernelStateError,
    PluginLifecycleError,
    PluginSetupError,
    PluginVersionMismatchError,
} from './errors.js';
import {
    acquirePluginDefinitionLease,
    releasePluginDefinitionLease,
} from './plugin-definition-lease.js';
import {
    PluginManager,
    sameInstallationDefinition,
    type AsyncPluginInstallationHost,
    type InstallOutcome,
    type InstalledPluginRecord,
    type PluginManagerOptions,
} from './plugin-manager.js';
import { RegistrationScope } from './registration-scope.js';
import type { PluginEventMap } from './committed-event-bus.js';
import type { EditorPlugin, PluginDefinitionInput } from './plugin-types.js';

/**
 * Internal Plugin Host variant used by testing and conformance paths that accept asynchronous setup.
 *
 * Runtime Core imports the synchronous base manager directly, so this implementation is excluded
 * from the static Platform Anchor graph.
 */
export class AsyncPluginManager<
    TEvents extends object = PluginEventMap,
> extends PluginManager<TEvents> {
    constructor(options: PluginManagerOptions = {}) {
        super(options);
    }

    override async install<TApi>(plugin: EditorPlugin<TApi, TEvents>): Promise<TApi> {
        const host = this.getAsyncInstallationHost();
        host.assertCanInstall();
        if (host.topLevelInstallActive) {
            throw new PluginKernelStateError('start a concurrent plugin installation', this.state);
        }
        host.topLevelInstallActive = true;
        try {
            const outcome = await this.performAsyncInstall(host, plugin, 'strict', []);
            // The installed API was produced by the same typed plugin argument.
            return outcome.api as TApi;
        } finally {
            host.topLevelInstallActive = false;
        }
    }

    private async performAsyncInstall(
        host: AsyncPluginInstallationHost<TEvents>,
        input: PluginDefinitionInput<TEvents>,
        mode: 'strict' | 'ensure',
        parentStack: readonly string[],
    ): Promise<InstallOutcome<TEvents>> {
        const plugin = host.normalizePluginDefinition(input);
        const pluginId = plugin.ref.id;
        if (parentStack.includes(pluginId)) {
            throw new InvalidPluginDefinitionError(
                `Plugin dependency cycle detected: ${[...parentStack, pluginId].join(' -> ')}.`,
                pluginId,
            );
        }

        const existing = host.installed.get(pluginId);
        if (existing) {
            if (mode === 'strict') throw new PluginAlreadyInstalledError(pluginId);
            if (!sameInstallationDefinition(existing.plugin, plugin)) {
                throw new PluginVersionMismatchError(
                    pluginId,
                    existing.plugin.manifest.version,
                    plugin.manifest.version,
                    existing.plugin.ref.apiVersion,
                    plugin.ref.apiVersion,
                );
            }
            return { api: existing.api, installedPlugin: existing.plugin };
        }

        host.assertPluginDependenciesInstalled(plugin);
        const { required, optional } = host.resolveCapabilities(plugin);
        acquirePluginDefinitionLease(plugin, this, pluginId);
        const scope = new RegistrationScope(pluginId, host.options);
        const stack = [...parentStack, pluginId];
        const installDependency = this.createDependencyInstaller(host, scope, stack);

        try {
            const contexts = host.createContexts(
                plugin.ref,
                scope,
                required,
                optional,
                installDependency,
            );
            const api = await plugin.setup(contexts.setup);
            if (!((typeof api === 'object' && api !== null) || typeof api === 'function')) {
                throw new InvalidPluginDefinitionError(
                    `Plugin "${pluginId}" setup must return a non-null object or function API.`,
                    pluginId,
                );
            }
            scope.commit();
            const record: InstalledPluginRecord<TEvents> = {
                plugin,
                refObject: plugin.ref,
                api,
                scope,
                lifecycleContext: contexts.lifecycle,
            };
            host.installed.set(pluginId, record);
            host.installationOrder.push(pluginId);
            return { api, installedPlugin: plugin };
        } catch (error) {
            const cleanupErrors = await scope.rollback();
            releasePluginDefinitionLease(plugin, this);
            throw new PluginSetupError(pluginId, error, cleanupErrors);
        }
    }

    private createDependencyInstaller(
        host: AsyncPluginInstallationHost<TEvents>,
        scope: RegistrationScope,
        stack: readonly string[],
    ): (dependency: PluginDefinitionInput<TEvents>) => Promise<unknown> {
        const installNow = async (dependency: PluginDefinitionInput<TEvents>): Promise<unknown> => {
            scope.assertOpen('ensure a composed plugin dependency');
            const before = new Set(host.installationOrder);
            const outcome = await this.performAsyncInstall(host, dependency, 'ensure', stack);
            const newlyInstalled = host.installationOrder.filter((id) => !before.has(id));
            for (const installedPluginId of newlyInstalled) {
                scope.addRollback(
                    createDisposable(() =>
                        this.rollbackAsyncInstalledPlugin(host, installedPluginId),
                    ),
                );
            }
            return outcome.api;
        };
        let queue: Promise<void> = Promise.resolve();
        return (dependency: PluginDefinitionInput<TEvents>): Promise<unknown> => {
            const result = queue.then(() => installNow(dependency));
            queue = result.then(
                () => undefined,
                () => undefined,
            );
            return result;
        };
    }

    private async rollbackAsyncInstalledPlugin(
        host: AsyncPluginInstallationHost<TEvents>,
        pluginId: string,
    ): Promise<void> {
        const record = host.installed.get(pluginId);
        if (!record) return;
        host.installed.delete(pluginId);
        const orderIndex = host.installationOrder.lastIndexOf(pluginId);
        if (orderIndex >= 0) host.installationOrder.splice(orderIndex, 1);
        const errors: unknown[] = [];

        if (record.plugin.onDispose) {
            try {
                await record.plugin.onDispose(record.lifecycleContext);
            } catch (error) {
                errors.push(new PluginLifecycleError(pluginId, 'dispose', error));
            }
        }
        try {
            await record.scope.dispose();
        } catch (error) {
            errors.push(error);
        }
        releasePluginDefinitionLease(record.plugin, this);
        if (errors.length > 0) {
            throw new PluginAggregateError(
                `[ImageEditor] Rollback of composed plugin "${pluginId}" failed.`,
                errors,
                { pluginId },
            );
        }
    }
}
