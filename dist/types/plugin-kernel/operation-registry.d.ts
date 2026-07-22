/**
 * Registers operations and coordinates conflict, cancellation, and reentrancy policy.
 *
 * @module
 */
import { type Disposable, type MaybePromise } from './disposable.js';
export type OperationId = string;
export type OperationMode = 'read' | 'busy' | 'animation' | 'mutation';
export type OperationConflictDomain = 'document' | 'base-image' | 'geometry' | 'raster' | 'overlay' | 'selection' | 'tool' | 'export' | 'state' | 'image-decode';
export type OperationReentrancy = 'reject' | 'queue' | 'replace' | 'coalesce';
export interface OperationDefinition<TArgs = unknown> {
    readonly id: OperationId;
    readonly mode: OperationMode;
    readonly conflictDomains: readonly OperationConflictDomain[];
    readonly reentrancy: OperationReentrancy;
    readonly allowedDuringTool?: readonly string[];
    coalesce?(previous: TArgs, next: TArgs): TArgs;
}
export interface OperationToken extends Disposable {
    readonly id: OperationId;
    readonly ownerPluginId: string;
    readonly parentId: OperationId | null;
    readonly topLevel: boolean;
    readonly ownsHistory: boolean;
    readonly signal: AbortSignal;
    readonly active: boolean;
}
export interface OperationExecutionContext {
    readonly signal: AbortSignal;
    readonly token: OperationToken;
    readonly topLevel: boolean;
    readonly ownsHistory: boolean;
}
export interface OperationRunOptions {
    readonly parent?: OperationToken;
    readonly signal?: AbortSignal;
}
export declare class OperationRegistry implements Disposable {
    private readonly operations;
    private readonly activeOperations;
    private readonly executingRequests;
    private readonly idleWaiters;
    private pendingRequests;
    private suspendedReason;
    private disposed;
    register<TArgs>(definition: OperationDefinition<TArgs>, ownerPluginId: string): Disposable;
    begin(operationId: OperationId, ownerPluginId: string): OperationToken;
    run<TArgs, TResult>(operationId: OperationId, ownerPluginId: string, args: TArgs, task: (args: TArgs, context: OperationExecutionContext) => MaybePromise<TResult>, options?: OperationRunOptions): Promise<TResult>;
    has(operationId: OperationId): boolean;
    get(operationId: OperationId): OperationDefinition | null;
    isActive(operationId?: OperationId): boolean;
    waitForIdle(): Promise<void>;
    dispose(): void;
    private schedule;
    private startRequest;
    private finishRequest;
    private drainPending;
    private createActive;
    private retireActive;
    private abortActive;
    private findConflicts;
    private findCoalesciblePending;
    private addWaiter;
    private abortRequestWithoutWaiters;
    private attachExternalAbort;
    private rejectPending;
    private resolveRequest;
    private rejectRequest;
    private requireRegistered;
    private requireOwned;
    private validateParent;
    private validateDefinition;
    private conflictError;
    private isIdle;
    private resolveIdleWaiters;
    private assertActive;
}
