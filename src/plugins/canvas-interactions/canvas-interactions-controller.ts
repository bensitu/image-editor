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
} from '../../sdk/index.js';
import type {
    CanvasInteractionsPluginApi,
    CanvasInteractionsStatus,
    CanvasInteractionsStatusListener,
    InteractionCancelReason,
} from './canvas-interactions-types.js';
import { FabricPointerSource } from './fabric-pointer-source.js';
import type { PointerSample, PointerSourceSink } from './interaction-types.js';
import { PointerCoordinateMapper } from './pointer-coordinate-mapper.js';

interface CanvasInteractionsHost extends CanvasReadPort, BaseImageReadPort, CoreDiagnosticsPort {}

export class CanvasInteractionsController implements CanvasInteractionsPluginApi {
    private readonly listeners = new Set<CanvasInteractionsStatusListener>();
    private canvas: ReturnType<CanvasReadPort['getCanvas']> = null;
    private pointerSource: FabricPointerSource | null = null;
    private disposed = false;

    constructor(private readonly host: CanvasInteractionsHost) {}

    refresh(): void {
        this.assertActive('refresh Canvas interactions');
        const canvas = this.host.getCanvas();
        if (canvas === this.canvas && this.pointerSource) return;
        this.releasePointerSource();
        this.canvas = canvas;
        if (canvas) {
            const sink: PointerSourceSink = {
                down: (sample) => this.handlePointerDown(sample),
                move: (sample) => this.handlePointerMove(sample),
                up: (sample) => this.handlePointerUp(sample),
                cancel: () => this.handlePointerCancel(),
            };
            this.pointerSource = new FabricPointerSource(
                canvas,
                new PointerCoordinateMapper(this.host),
                sink,
            );
        }
        this.publishStatus();
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
        this.releasePointerSource();
        this.disposed = true;
        this.publishStatus();
        this.listeners.clear();
    }

    private status(): Readonly<CanvasInteractionsStatus> {
        return Object.freeze({
            isBound: this.pointerSource !== null,
            isDisposed: this.disposed,
            activeBindingId: null,
            gestureActive: false,
        });
    }

    private releasePointerSource(): void {
        this.pointerSource?.dispose();
        this.pointerSource = null;
        this.canvas = null;
    }

    private handlePointerDown(_sample: PointerSample): void {}

    private handlePointerMove(_sample: PointerSample): void {}

    private handlePointerUp(_sample: PointerSample): void {}

    private handlePointerCancel(): void {}

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
