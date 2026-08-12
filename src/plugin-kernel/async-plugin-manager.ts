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

const DEFAULT_ASYNC_SETUP_TIMEOUT_MS = 30_000;

export interface AsyncPluginManagerOptions extends PluginManagerOptions {
    readonly setupTimeoutMs?: number;
}

export interface AsyncPluginInstallOptions {
    readonly signal?: AbortSignal;
    readonly setupTimeoutMs?: number;
}

function resolveSetupTimeout(value: number | undefined): number {
    const timeout = value ?? DEFAULT_ASYNC_SETUP_TIMEOUT_MS;
    if (!Number.isSafeInteger(timeout) || timeout <= 0) {
        throw new TypeError('setupTimeoutMs must be a positive safe integer.');
    }
    return timeout;
}

function setupAbortReason(signal: AbortSignal): unknown {
    return signal.reason ?? new DOMException('Plugin setup was cancelled.', 'AbortError');
}

function waitForSetup<TResult>(
    task: PromiseLike<TResult> | TResult,
    pluginId: string,
    timeoutMs: number,
    signal?: AbortSignal,
): Promise<TResult> {
    if (signal?.aborted) return Promise.reject(setupAbortReason(signal));
    return new Promise<TResult>((resolve, reject) => {
        let settled = false;
        const finish = (callback: () => void): void => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            signal?.removeEventListener('abort', abort);
            callback();
        };
        const timeoutError = new Error(
            `[ImageEditor] Plugin "${pluginId}" setup exceeded ${timeoutMs}ms.`,
        );
        timeoutError.name = 'TimeoutError';
        const timeout = setTimeout(() => finish(() => reject(timeoutError)), timeoutMs);
        const abort = (): void => finish(() => reject(setupAbortReason(signal!)));
        signal?.addEventListener('abort', abort, { once: true });
        Promise.resolve(task).then(
            (value) => finish(() => resolve(value)),
            (error: unknown) => finish(() => reject(error)),
        );
    });
}

/**
 * Internal Plugin Host variant used by testing and conformance paths that accept asynchronous setup.
 *
 * Runtime Core imports the synchronous base manager directly, so this implementation is excluded
 * from the static Platform Anchor graph.
 */
export class AsyncPluginManager<
    TEvents extends object = PluginEventMap,
> extends PluginManager<TEvents> {
    private readonly setupTimeoutMs: number;

    constructor(options: AsyncPluginManagerOptions = {}) {
        const setupTimeoutMs = resolveSetupTimeout(options.setupTimeoutMs);
        super(options);
        this.setupTimeoutMs = setupTimeoutMs;
    }

    override async install<TApi>(
        plugin: EditorPlugin<TApi, TEvents>,
        options: AsyncPluginInstallOptions = {},
    ): Promise<TApi> {
        const host = this.getAsyncInstallationHost();
        host.assertCanInstall();
        if (host.topLevelInstallActive) {
            throw new PluginKernelStateError('start a concurrent plugin installation', this.state);
        }
        host.topLevelInstallActive = true;
        try {
            const outcome = await this.performAsyncInstall(host, plugin, options);
            // The installed API was produced by the same typed plugin argument.
            return outcome.api as TApi;
        } finally {
            host.topLevelInstallActive = false;
        }
    }

    private async performAsyncInstall(
        host: AsyncPluginInstallationHost<TEvents>,
        input: PluginDefinitionInput<TEvents>,
        options: AsyncPluginInstallOptions,
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
            const api = await waitForSetup(
                plugin.setup(contexts.setup),
                pluginId,
                resolveSetupTimeout(options.setupTimeoutMs ?? this.setupTimeoutMs),
                options.signal,
            );
            if (!((typeof api === 'object' && api !== null) || typeof api === 'function')) {
                throw new InvalidPluginDefinitionError(
                    `Plugin "${pluginId}" setup must return a non-null object or function API.`,
                    pluginId,
                );
            }
            host.assertCanInstall();
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
