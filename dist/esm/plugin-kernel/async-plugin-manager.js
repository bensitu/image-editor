import { createDisposable } from './disposable.js';
import { InvalidPluginDefinitionError, PluginAggregateError, PluginAlreadyInstalledError, PluginKernelStateError, PluginLifecycleError, PluginSetupError, PluginVersionMismatchError, } from './errors.js';
import { acquirePluginDefinitionLease, releasePluginDefinitionLease, } from './plugin-definition-lease.js';
import { PluginManager, sameInstallationDefinition, } from './plugin-manager.js';
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
            const outcome = await this.performAsyncInstall(host, plugin, 'strict', []);
            return outcome.api;
        }
        finally {
            host.topLevelInstallActive = false;
        }
    }
    async performAsyncInstall(host, input, mode, parentStack) {
        const plugin = host.normalizePluginDefinition(input);
        const pluginId = plugin.ref.id;
        if (parentStack.includes(pluginId)) {
            throw new InvalidPluginDefinitionError(`Plugin dependency cycle detected: ${[...parentStack, pluginId].join(' -> ')}.`, pluginId);
        }
        const existing = host.installed.get(pluginId);
        if (existing) {
            if (mode === 'strict')
                throw new PluginAlreadyInstalledError(pluginId);
            if (!sameInstallationDefinition(existing.plugin, plugin)) {
                throw new PluginVersionMismatchError(pluginId, existing.plugin.manifest.version, plugin.manifest.version, existing.plugin.ref.apiVersion, plugin.ref.apiVersion);
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
            const contexts = host.createContexts(plugin.ref, scope, required, optional, installDependency);
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
    createDependencyInstaller(host, scope, stack) {
        const installNow = async (dependency) => {
            scope.assertOpen('ensure a composed plugin dependency');
            const before = new Set(host.installationOrder);
            const outcome = await this.performAsyncInstall(host, dependency, 'ensure', stack);
            const newlyInstalled = host.installationOrder.filter((id) => !before.has(id));
            for (const installedPluginId of newlyInstalled) {
                scope.addRollback(createDisposable(() => this.rollbackAsyncInstalledPlugin(host, installedPluginId)));
            }
            return outcome.api;
        };
        let queue = Promise.resolve();
        return (dependency) => {
            const result = queue.then(() => installNow(dependency));
            queue = result.then(() => undefined, () => undefined);
            return result;
        };
    }
    async rollbackAsyncInstalledPlugin(host, pluginId) {
        const record = host.installed.get(pluginId);
        if (!record)
            return;
        host.installed.delete(pluginId);
        const orderIndex = host.installationOrder.lastIndexOf(pluginId);
        if (orderIndex >= 0)
            host.installationOrder.splice(orderIndex, 1);
        const errors = [];
        if (record.plugin.onDispose) {
            try {
                await record.plugin.onDispose(record.lifecycleContext);
            }
            catch (error) {
                errors.push(new PluginLifecycleError(pluginId, 'dispose', error));
            }
        }
        try {
            await record.scope.dispose();
        }
        catch (error) {
            errors.push(error);
        }
        releasePluginDefinitionLease(record.plugin, this);
        if (errors.length > 0) {
            throw new PluginAggregateError(`[ImageEditor] Rollback of composed plugin "${pluginId}" failed.`, errors, { pluginId });
        }
    }
}
//# sourceMappingURL=async-plugin-manager.js.map