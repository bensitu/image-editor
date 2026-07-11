import { type Disposable, type MaybePromise } from './disposable.js';
import { type PluginErrorSink } from './reporting.js';
export type ToolId = string;
export type ToolExitReason = 'requested' | 'switch' | 'operation' | 'plugin-dispose' | 'host-dispose';
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
}
export declare class ToolCoordinator implements Disposable {
    private readonly options;
    private readonly tools;
    private active;
    private transitioning;
    private disposed;
    constructor(options?: ToolCoordinatorOptions);
    register(definition: ToolDefinition, ownerPluginId: string): Disposable;
    enter(toolId: ToolId, requesterPluginId?: string): Promise<void>;
    exit(reason?: ToolExitReason): Promise<void>;
    getActiveToolId(): ToolId | null;
    canRunOperation(operationId: string): boolean;
    dispose(): Promise<void>;
    private exitCurrent;
    private runTransition;
    private assertActive;
}
