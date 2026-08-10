/**
 * Owns the public lifecycle and status surface for Canvas interactions.
 *
 * @module
 */

import type {
    BaseImageReadPort,
    CanvasReadPort,
    CoreDiagnosticsPort,
    Disposable,
    PluginToolAccess,
} from '../../sdk/index.js';
import type {
    CanvasInteractionsPluginApi,
    CanvasInteractionsPluginOptions,
    CanvasInteractionsStatus,
    CanvasInteractionsStatusListener,
    InteractionCancelReason,
} from './canvas-interactions-types.js';
import { FabricPointerSource } from './fabric-pointer-source.js';
import type { CanvasInteractionBinding } from './interaction-binding.js';
import { InteractionRuntime } from './interaction-runtime.js';
import { PointerCoordinateMapper } from './pointer-coordinate-mapper.js';

interface CanvasInteractionsHost extends CanvasReadPort, BaseImageReadPort, CoreDiagnosticsPort {}

export class CanvasInteractionsController implements CanvasInteractionsPluginApi {
    private readonly listeners = new Set<CanvasInteractionsStatusListener>();
    private readonly runtime: InteractionRuntime;
    private canvas: ReturnType<CanvasReadPort['getCanvas']> = null;
    private pointerSource: FabricPointerSource | null = null;
    private disposed = false;

    constructor(
        private readonly host: CanvasInteractionsHost,
        tools: PluginToolAccess,
        options: CanvasInteractionsPluginOptions,
        bindings: readonly CanvasInteractionBinding[] = [],
    ) {
        this.runtime = new InteractionRuntime(bindings, tools, host, options, () =>
            this.publishStatus(),
        );
    }

    refresh(): void {
        this.assertActive('refresh Canvas interactions');
        const canvas = this.host.getCanvas();
        if (canvas === this.canvas && this.pointerSource) return;
        this.releasePointerSource();
        this.canvas = canvas;
        if (canvas) {
            this.pointerSource = new FabricPointerSource(
                canvas,
                new PointerCoordinateMapper(this.host),
                this.runtime,
            );
        }
        this.publishStatus();
    }

    async cancel(reason: InteractionCancelReason = 'requested'): Promise<void> {
        this.assertActive('cancel Canvas interactions');
        await this.runtime.cancelGesture(reason);
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
        this.runtime.dispose();
        this.releasePointerSource();
        this.disposed = true;
        this.publishStatus();
        this.listeners.clear();
    }

    private status(): Readonly<CanvasInteractionsStatus> {
        return Object.freeze({
            isBound: this.pointerSource !== null,
            isDisposed: this.disposed,
            ...this.runtime.status(),
        });
    }

    private releasePointerSource(): void {
        this.pointerSource?.dispose();
        this.pointerSource = null;
        this.canvas = null;
    }

    invalidateLifecycle(reason: InteractionCancelReason): void {
        this.runtime.invalidateLifecycle(reason);
    }

    private publishStatus(): void {
        const status = this.status();
        for (const listener of [...this.listeners]) this.invokeListener(listener, status);
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
