/**
 * Coordinates ownership of additional Fabric object properties included in snapshots.
 *
 * @module
 */
import { type Disposable } from '../../plugin-kernel/disposable.js';
export interface ObjectPropertyRegistration {
    readonly owner: string;
    readonly keys: readonly string[];
}
export declare class ObjectPropertyRegistry implements Disposable {
    private readonly properties;
    private disposed;
    register(registration: ObjectPropertyRegistration): Disposable;
    listKeys(): readonly string[];
    getOwner(key: string): string | null;
    dispose(): void;
    private assertActive;
}
