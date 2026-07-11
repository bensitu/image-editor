import { type Disposable } from './disposable.js';
export type OperationId = string;
export type OperationMode = 'idle' | 'busy' | 'animation';
export interface OperationDefinition {
    readonly id: OperationId;
    readonly mode: OperationMode;
    readonly allowedDuringTool?: readonly string[];
}
export interface OperationToken extends Disposable {
    readonly id: OperationId;
    readonly ownerPluginId: string;
    readonly active: boolean;
}
export declare class OperationRegistry implements Disposable {
    private readonly operations;
    private activeToken;
    private disposed;
    register(definition: OperationDefinition, ownerPluginId: string): Disposable;
    begin(operationId: OperationId, ownerPluginId: string): OperationToken;
    get(operationId: OperationId): OperationDefinition | null;
    isActive(operationId?: OperationId): boolean;
    dispose(): void;
    private assertActive;
}
