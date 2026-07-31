/**
 * Adds internal asynchronous Plugin setup to the Plugin Host.
 *
 * @module
 */

import {
    InvalidPluginDefinitionError,
    PluginAlreadyInstalledError,
    PluginKernelStateError,
    PluginSetupError,
} from './errors.js';
import {
    acquirePluginDefinitionLease,
    releasePluginDefinitionLease,
} from './plugin-definition-lease.js';
import {
    PluginManager,
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
            const outcome = await this.performAsyncInstall(host, plugin);
            // The installed API was produced by the same typed plugin argument.
            return outcome.api as TApi;
        } finally {
            host.topLevelInstallActive = false;
        }
    }

    private async performAsyncInstall(
        host: AsyncPluginInstallationHost<TEvents>,
        input: PluginDefinitionInput<TEvents>,
    ): Promise<InstallOutcome<TEvents>> {
        const plugin = host.normalizePluginDefinition(input);
        const pluginId = plugin.ref.id;
        const existing = host.installed.get(pluginId);
        if (existing) throw new PluginAlreadyInstalledError(pluginId);

        host.assertPluginDependenciesInstalled(plugin);
        const { required, optional } = host.resolveCapabilities(plugin);
        acquirePluginDefinitionLease(plugin, this, pluginId);
        const scope = new RegistrationScope(pluginId, host.options);

        try {
            const contexts = host.createContexts(plugin.ref, scope, required, optional);
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
}
