/**
 * Registers mutually exclusive Tools and serializes their lifecycle transitions.
 *
 * @module
 */
import { type Disposable, type MaybePromise } from './disposable.js';
import { type PluginErrorSink } from './reporting.js';
export type ToolId = string;
export type ToolExitReason = 'requested' | 'switch' | 'operation' | 'plugin-dispose' | 'host-dispose';
export interface ToolStatus {
    readonly activeToolId: ToolId | null;
}
export type ToolStatusListener = (status: Readonly<ToolStatus>) => void;
export interface ToolStatusSubscriptionOptions {
    readonly emitCurrent?: boolean;
}
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
export interface ToolCoordinatorOptions {
    readonly errorSink?: PluginErrorSink;
    readonly activitySink?: () => void;
}
export declare class ToolCoordinator implements Disposable {
    private readonly options;
    private readonly tools;
    private readonly statusListeners;
    private active;
    private lastPublishedActiveToolId;
    private transitioning;
    private transitionCompletion;
    private disposed;
    constructor(options?: ToolCoordinatorOptions);
    register(definition: ToolDefinition, ownerPluginId: string): Disposable;
    disposeSync(): void;
    enter(toolId: ToolId, requesterPluginId?: string): Promise<void>;
    exit(reason?: ToolExitReason): Promise<void>;
    getActiveToolId(): ToolId | null;
    canRunOperation(operationId: string): boolean;
    subscribe(listener: ToolStatusListener, options?: ToolStatusSubscriptionOptions): Disposable;
    dispose(): Promise<void>;
    private exitCurrent;
    private runTransition;
    private disposeRegistration;
    private waitForTransition;
    private notifyActivityChange;
    private status;
    private invokeStatusListener;
    private assertActive;
}
