/**
 * Defines a configurable status Plugin using only public SDK contracts.
 *
 * @module
 */

import type { CoreEventMap } from '@bensitu/image-editor/core';
import {
    CORE_STATUS_CAPABILITY,
    createDisposable,
    definePlugin,
    definePluginRef,
    type ConfigurablePluginApi,
    type SynchronousEditorPlugin,
} from '@bensitu/image-editor/sdk';

export interface StatusPluginConfiguration {
    readonly label: string;
}

export interface StatusPluginApi extends ConfigurablePluginApi<StatusPluginConfiguration> {
    read(): string;
}

export interface StatusPluginOptions {
    readonly label?: string;
}

const defaultConfiguration: StatusPluginConfiguration = Object.freeze({ label: 'Editor' });

export const statusPluginRef = definePluginRef<StatusPluginApi>('example:status-plugin', '1.0.0');

function validateConfiguration(value: StatusPluginConfiguration): StatusPluginConfiguration {
    if (typeof value.label !== 'string' || value.label.trim().length === 0) {
        throw new TypeError('Status label must be a non-empty string.');
    }
    return Object.freeze({ label: value.label.trim() });
}

export function statusPlugin(
    options: StatusPluginOptions = {},
): SynchronousEditorPlugin<StatusPluginApi, CoreEventMap> {
    let configuration: StatusPluginConfiguration | null = validateConfiguration({
        ...defaultConfiguration,
        ...options,
    });
    const requireConfiguration = (): StatusPluginConfiguration => {
        if (!configuration) throw new Error('Status Plugin has been disposed.');
        return configuration;
    };

    return definePlugin({
        ref: statusPluginRef,
        manifest: {
            id: statusPluginRef.id,
            version: '1.0.0',
            apiVersion: statusPluginRef.apiVersion,
            engine: '^3.0.0',
            requires: [{ token: CORE_STATUS_CAPABILITY, range: '^1.0.0' }],
        },
        setupMode: 'sync',
        setup(context) {
            const status = context.capabilities.require(CORE_STATUS_CAPABILITY);
            context.disposables.add(
                createDisposable(() => {
                    configuration = null;
                }),
            );
            return Object.freeze({
                configure(patch: Partial<StatusPluginConfiguration>) {
                    configuration = validateConfiguration({
                        ...requireConfiguration(),
                        ...patch,
                    });
                },
                getConfiguration: () => requireConfiguration(),
                read: () =>
                    `${requireConfiguration().label}: ${status.isDisposed() ? 'disposed' : 'ready'}`,
            });
        },
    });
}
