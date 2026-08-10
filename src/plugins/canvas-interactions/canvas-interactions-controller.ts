/**
 * Owns the public lifecycle and status surface for Canvas interactions.
 *
 * @module
 */

import type { CanvasReadPort, CoreDiagnosticsPort, Disposable } from '../../sdk/index.js';
import type {
    CanvasInteractionsPluginApi,
    CanvasInteractionsStatus,
    CanvasInteractionsStatusListener,
    InteractionCancelReason,
} from './canvas-interactions-types.js';

interface CanvasInteractionsHost extends CanvasReadPort, CoreDiagnosticsPort {}

export class CanvasInteractionsController implements CanvasInteractionsPluginApi {
    private readonly listeners = new Set<CanvasInteractionsStatusListener>();
    private disposed = false;

    constructor(private readonly host: CanvasInteractionsHost) {}

    refresh(): void {
        this.assertActive('refresh Canvas interactions');
    }

    async cancel(_reason: InteractionCancelReason = 'requested'): Promise<void> {
        this.assertActive('cancel Canvas interactions');
    }

    getStatus(): Readonly<CanvasInteractionsStatus> {
        return this.status();
    }

    subscribe(listener: CanvasInteractionsStatusListener): Disposable {
        this.assertActive('subscribe to Canvas interaction status');
        if (typeof listener !== 'function') {
            throw new TypeError(
                '[ImageEditor] Canvas interaction status listener must be a function.',
            );
        }
        this.listeners.add(listener);
        this.invokeListener(listener, this.status());
        let active = true;
        return Object.freeze({
            dispose: () => {
                if (!active) return;
                active = false;
                this.listeners.delete(listener);
            },
        });
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        const status = this.status();
        for (const listener of [...this.listeners]) this.invokeListener(listener, status);
        this.listeners.clear();
    }

    private status(): Readonly<CanvasInteractionsStatus> {
        return Object.freeze({
            isBound: false,
            isDisposed: this.disposed,
            activeBindingId: null,
            gestureActive: false,
        });
    }

    private invokeListener(
        listener: CanvasInteractionsStatusListener,
        status: Readonly<CanvasInteractionsStatus>,
    ): void {
        try {
            listener(status);
        } catch (error) {
            this.host.reportWarning(error, 'A Canvas interaction status listener failed.');
        }
    }

    private assertActive(operation: string): void {
        if (this.disposed) {
            throw new Error(
                `[ImageEditor] Cannot ${operation} after Canvas Interactions disposal.`,
            );
        }
    }
}
