/**
 * Registers mutually exclusive Tools and serializes their lifecycle transitions.
 *
 * @module
 */

import {
    createDisposable,
    isPromiseLike,
    type Disposable,
    type MaybePromise,
} from './disposable.js';
import { PluginKernelDisposedError, ToolRegistrationError, ToolTransitionError } from './errors.js';
import { reportErrorSafely, type PluginErrorSink } from './reporting.js';
import { isRuntimeIdentifier } from './plugin-identifier.js';

export type ToolId = string;
export type ToolExitReason =
    'requested' | 'switch' | 'operation' | 'plugin-dispose' | 'host-dispose';

export interface ToolContext {
    readonly toolId: ToolId;
    readonly ownerPluginId: string;
}

export interface ToolDefinition {
    readonly id: ToolId;
    enter(context: ToolContext): MaybePromise<void>;
    exit(reason: ToolExitReason, context: ToolContext): MaybePromise<void>;
    canRunOperation?(operationId: string): boolean;
}

interface RegisteredTool {
    readonly definition: ToolDefinition;
    readonly ownerPluginId: string;
    readonly context: ToolContext;
}

export interface ToolCoordinatorOptions {
    readonly errorSink?: PluginErrorSink;
}

export class ToolCoordinator implements Disposable {
    private readonly tools = new Map<ToolId, RegisteredTool>();
    private active: RegisteredTool | null = null;
    private transitioning = false;
    private disposed = false;

    constructor(private readonly options: ToolCoordinatorOptions = {}) {}

    register(definition: ToolDefinition, ownerPluginId: string): Disposable {
        this.assertActive('register a tool');
        if (!isRuntimeIdentifier(ownerPluginId)) {
            throw new ToolRegistrationError('Invalid Tool owner Runtime ID.', ownerPluginId);
        }
        if (!isRuntimeIdentifier(definition.id)) {
            throw new ToolRegistrationError('Invalid Tool Runtime ID.', ownerPluginId);
        }
        const existing = this.tools.get(definition.id);
        if (existing) {
            throw new ToolRegistrationError(
                `Tool "${definition.id}" is already registered by "${existing.ownerPluginId}".`,
                ownerPluginId,
            );
        }
        const record: RegisteredTool = {
            definition,
            ownerPluginId,
            context: Object.freeze({ toolId: definition.id, ownerPluginId }),
        };
        this.tools.set(definition.id, record);

        return createDisposable(() => {
            if (this.active === record) {
                return this.exitCurrent('plugin-dispose').finally(() => {
                    if (this.tools.get(definition.id) === record) this.tools.delete(definition.id);
                });
            }
            if (this.tools.get(definition.id) === record) this.tools.delete(definition.id);
            return undefined;
        });
    }

    disposeSync(): void {
        if (this.disposed) return;
        let exitError: unknown;
        try {
            const current = this.active;
            this.active = null;
            if (current) {
                const result = current.definition.exit('host-dispose', current.context);
                if (isPromiseLike(result)) {
                    void Promise.resolve(result).catch((error: unknown) => {
                        reportErrorSafely(this.options.errorSink, error);
                    });
                    throw new ToolTransitionError(
                        current.definition.id,
                        'returned a Promise during synchronous host disposal',
                        current.ownerPluginId,
                    );
                }
            }
        } catch (error) {
            exitError = error;
        } finally {
            this.active = null;
            this.tools.clear();
            this.disposed = true;
        }
        if (exitError) throw exitError;
    }

    async enter(toolId: ToolId, requesterPluginId?: string): Promise<void> {
        this.assertActive('enter a tool');
        const next = this.tools.get(toolId);
        if (!next) throw new ToolTransitionError(toolId, 'is not registered', requesterPluginId);
        if (requesterPluginId && requesterPluginId !== next.ownerPluginId) {
            throw new ToolTransitionError(
                toolId,
                `belongs to "${next.ownerPluginId}", not "${requesterPluginId}"`,
                requesterPluginId,
            );
        }
        if (this.active === next) return;
        await this.runTransition(toolId, async () => {
            if (this.active) await this.exitCurrent('switch');
            try {
                await next.definition.enter(next.context);
                this.active = next;
            } catch (error) {
                this.active = null;
                const transitionError = new ToolTransitionError(
                    toolId,
                    'failed to enter',
                    next.ownerPluginId,
                    error,
                );
                reportErrorSafely(this.options.errorSink, transitionError);
                throw transitionError;
            }
        });
    }

    async exit(reason: ToolExitReason = 'requested'): Promise<void> {
        this.assertActive('exit a tool');
        if (!this.active) return;
        await this.runTransition(this.active.definition.id, () => this.exitCurrent(reason));
    }

    getActiveToolId(): ToolId | null {
        this.assertActive('inspect active tool state');
        return this.active?.definition.id ?? null;
    }

    canRunOperation(operationId: string): boolean {
        this.assertActive('check tool operation policy');
        if (!this.active?.definition.canRunOperation) return true;
        try {
            return this.active.definition.canRunOperation(operationId);
        } catch (error) {
            const transitionError = new ToolTransitionError(
                this.active.definition.id,
                `operation policy failed for "${operationId}"`,
                this.active.ownerPluginId,
                error,
            );
            reportErrorSafely(this.options.errorSink, transitionError);
            return false;
        }
    }

    async dispose(): Promise<void> {
        if (this.disposed) return;
        let exitError: unknown;
        try {
            if (this.active) await this.exitCurrent('host-dispose');
        } catch (error) {
            exitError = error;
        } finally {
            this.active = null;
            this.tools.clear();
            this.disposed = true;
        }
        if (exitError) throw exitError;
    }

    private async exitCurrent(reason: ToolExitReason): Promise<void> {
        const current = this.active;
        if (!current) return;
        this.active = null;
        try {
            await current.definition.exit(reason, current.context);
        } catch (error) {
            const transitionError = new ToolTransitionError(
                current.definition.id,
                `failed to exit for reason "${reason}"`,
                current.ownerPluginId,
                error,
            );
            reportErrorSafely(this.options.errorSink, transitionError);
            throw transitionError;
        }
    }

    private async runTransition(toolId: string, task: () => Promise<void>): Promise<void> {
        if (this.transitioning) {
            throw new ToolTransitionError(
                toolId,
                'cannot transition while another transition is active',
            );
        }
        this.transitioning = true;
        try {
            await task();
        } finally {
            this.transitioning = false;
        }
    }

    private assertActive(operation: string): void {
        if (this.disposed) throw new PluginKernelDisposedError(operation);
    }
}
