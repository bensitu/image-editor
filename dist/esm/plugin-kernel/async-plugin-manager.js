import { InvalidPluginDefinitionError, PluginAlreadyInstalledError, PluginKernelStateError, PluginSetupError, } from './errors.js';
import { acquirePluginDefinitionLease, releasePluginDefinitionLease, } from './plugin-definition-lease.js';
import { PluginManager, } from './plugin-manager.js';
import { RegistrationScope } from './registration-scope.js';
export class AsyncPluginManager extends PluginManager {
    constructor(options = {}) {
        super(options);
    }
    async install(plugin) {
        const host = this.getAsyncInstallationHost();
        host.assertCanInstall();
        if (host.topLevelInstallActive) {
            throw new PluginKernelStateError('start a concurrent plugin installation', this.state);
        }
        host.topLevelInstallActive = true;
        try {
            const outcome = await this.performAsyncInstall(host, plugin);
            return outcome.api;
        }
        finally {
            host.topLevelInstallActive = false;
        }
    }
    async performAsyncInstall(host, input) {
        const plugin = host.normalizePluginDefinition(input);
        const pluginId = plugin.ref.id;
        const existing = host.installed.get(pluginId);
        if (existing)
            throw new PluginAlreadyInstalledError(pluginId);
        host.assertPluginDependenciesInstalled(plugin);
        const { required, optional } = host.resolveCapabilities(plugin);
        acquirePluginDefinitionLease(plugin, this, pluginId);
        const scope = new RegistrationScope(pluginId, host.options);
        try {
            const contexts = host.createContexts(plugin.ref, scope, required, optional);
            const api = await plugin.setup(contexts.setup);
            if (!((typeof api === 'object' && api !== null) || typeof api === 'function')) {
                throw new InvalidPluginDefinitionError(`Plugin "${pluginId}" setup must return a non-null object or function API.`, pluginId);
            }
            scope.commit();
            const record = {
                plugin,
                refObject: plugin.ref,
                api,
                scope,
                lifecycleContext: contexts.lifecycle,
            };
            host.installed.set(pluginId, record);
            host.installationOrder.push(pluginId);
            return { api, installedPlugin: plugin };
        }
        catch (error) {
            const cleanupErrors = await scope.rollback();
            releasePluginDefinitionLease(plugin, this);
            throw new PluginSetupError(pluginId, error, cleanupErrors);
        }
    }
}
//# sourceMappingURL=async-plugin-manager.js.map