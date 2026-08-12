import { InvalidPluginDefinitionError, PluginAlreadyInstalledError, PluginKernelStateError, PluginSetupError, } from './errors.js';
import { acquirePluginDefinitionLease, releasePluginDefinitionLease, } from './plugin-definition-lease.js';
import { PluginManager, } from './plugin-manager.js';
import { RegistrationScope } from './registration-scope.js';
const DEFAULT_ASYNC_SETUP_TIMEOUT_MS = 30000;
function resolveSetupTimeout(value) {
    const timeout = value !== null && value !== void 0 ? value : DEFAULT_ASYNC_SETUP_TIMEOUT_MS;
    if (!Number.isSafeInteger(timeout) || timeout <= 0) {
        throw new TypeError('setupTimeoutMs must be a positive safe integer.');
    }
    return timeout;
}
function setupAbortReason(signal) {
    var _a;
    return (_a = signal.reason) !== null && _a !== void 0 ? _a : new DOMException('Plugin setup was cancelled.', 'AbortError');
}
function waitForSetup(task, pluginId, timeoutMs, signal) {
    if (signal === null || signal === void 0 ? void 0 : signal.aborted)
        return Promise.reject(setupAbortReason(signal));
    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (callback) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timeout);
            signal === null || signal === void 0 ? void 0 : signal.removeEventListener('abort', abort);
            callback();
        };
        const timeoutError = new Error(`[ImageEditor] Plugin "${pluginId}" setup exceeded ${timeoutMs}ms.`);
        timeoutError.name = 'TimeoutError';
        const timeout = setTimeout(() => finish(() => reject(timeoutError)), timeoutMs);
        const abort = () => finish(() => reject(setupAbortReason(signal)));
        signal === null || signal === void 0 ? void 0 : signal.addEventListener('abort', abort, { once: true });
        Promise.resolve(task).then((value) => finish(() => resolve(value)), (error) => finish(() => reject(error)));
    });
}
export class AsyncPluginManager extends PluginManager {
    constructor(options = {}) {
        const setupTimeoutMs = resolveSetupTimeout(options.setupTimeoutMs);
        super(options);
        Object.defineProperty(this, "setupTimeoutMs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.setupTimeoutMs = setupTimeoutMs;
    }
    async install(plugin, options = {}) {
        const host = this.getAsyncInstallationHost();
        host.assertCanInstall();
        if (host.topLevelInstallActive) {
            throw new PluginKernelStateError('start a concurrent plugin installation', this.state);
        }
        host.topLevelInstallActive = true;
        try {
            const outcome = await this.performAsyncInstall(host, plugin, options);
            return outcome.api;
        }
        finally {
            host.topLevelInstallActive = false;
        }
    }
    async performAsyncInstall(host, input, options) {
        var _a;
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
            const api = await waitForSetup(plugin.setup(contexts.setup), pluginId, resolveSetupTimeout((_a = options.setupTimeoutMs) !== null && _a !== void 0 ? _a : this.setupTimeoutMs), options.signal);
            if (!((typeof api === 'object' && api !== null) || typeof api === 'function')) {
                throw new InvalidPluginDefinitionError(`Plugin "${pluginId}" setup must return a non-null object or function API.`, pluginId);
            }
            host.assertCanInstall();
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