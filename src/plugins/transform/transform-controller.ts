import type * as FabricNS from 'fabric';

import { AnimationQueue } from '../../animation/animation-queue.js';
import { OperationGuard } from '../../core/operation-guard.js';
import { animateProps, restoreOrigin } from '../../fabric/fabric-animation.js';
import type { GeometryMutationCoordinator } from '../../core-runtime/geometry/index.js';
import type { CoreHostPort } from '../../core-runtime/internal-capabilities.js';

export interface TransformPluginOptions {
    readonly animationDuration?: number;
    readonly minScale?: number;
    readonly maxScale?: number;
    readonly scaleStep?: number;
    readonly rotationStep?: number;
}

export interface ResolvedTransformPluginOptions {
    readonly animationDuration: number;
    readonly minScale: number;
    readonly maxScale: number;
    readonly scaleStep: number;
    readonly rotationStep: number;
}

export interface TransformPluginState {
    readonly scale: number;
    readonly rotationDegrees: number;
    readonly flipX: boolean;
    readonly flipY: boolean;
}

interface MutableTransformState {
    scale: number;
    rotationDegrees: number;
    flipX: boolean;
    flipY: boolean;
}

interface TargetedRollbackState {
    readonly transform: TransformPluginState;
    readonly geometryRevision: number;
    readonly canvasSize: Readonly<{ width: number; height: number }>;
    readonly image: Readonly<{
        left: number;
        top: number;
        scaleX: number;
        scaleY: number;
        angle: number;
        flipX: boolean;
        flipY: boolean;
        originX: FabricNS.TOriginX;
        originY: FabricNS.TOriginY;
    }>;
}

const DEFAULT_OPTIONS: ResolvedTransformPluginOptions = Object.freeze({
    animationDuration: 300,
    minScale: 0.1,
    maxScale: 5,
    scaleStep: 0.05,
    rotationStep: 90,
});

function nonNegative(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function positive(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

export function resolveTransformOptions(
    options: TransformPluginOptions = {},
): ResolvedTransformPluginOptions {
    const minScale = positive(options.minScale, DEFAULT_OPTIONS.minScale);
    const maxScale = Math.max(minScale, positive(options.maxScale, DEFAULT_OPTIONS.maxScale));
    return Object.freeze({
        animationDuration: nonNegative(
            options.animationDuration,
            DEFAULT_OPTIONS.animationDuration,
        ),
        minScale,
        maxScale,
        scaleStep: positive(options.scaleStep, DEFAULT_OPTIONS.scaleStep),
        rotationStep: positive(options.rotationStep, DEFAULT_OPTIONS.rotationStep),
    });
}

function cloneState(state: MutableTransformState): TransformPluginState {
    return Object.freeze({ ...state });
}

export class TransformPluginController {
    private readonly guard = new OperationGuard();
    private readonly queue = new AnimationQueue();
    private readonly state: MutableTransformState = {
        scale: 1,
        rotationDegrees: 0,
        flipX: false,
        flipY: false,
    };
    private mutationSequence = 0;

    constructor(
        private readonly host: CoreHostPort,
        private readonly geometry: GeometryMutationCoordinator,
        readonly options: ResolvedTransformPluginOptions,
    ) {}

    scale(factor: number): Promise<void> {
        return this.scaleWithOperation(factor, 'transform:scale');
    }

    private scaleWithOperation(factor: number, operationId: string): Promise<void> {
        if (!Number.isFinite(factor)) return Promise.resolve();
        return this.enqueue(operationId, async (signal) => {
            const image = this.host.getBaseImage();
            if (!image) return;
            await this.applyScale(image, factor, signal);
            this.host.finalizeBaseImageGeometry();
        });
    }

    zoomIn(): Promise<void> {
        return this.scaleWithOperation(
            this.state.scale + this.options.scaleStep,
            'transform:zoom-in',
        );
    }

    zoomOut(): Promise<void> {
        return this.scaleWithOperation(
            this.state.scale - this.options.scaleStep,
            'transform:zoom-out',
        );
    }

    rotate(degrees: number): Promise<void> {
        if (!Number.isFinite(degrees)) return Promise.resolve();
        return this.enqueue('transform:rotate', async (signal) => {
            const image = this.host.getBaseImage();
            if (!image) return;
            await this.applyRotation(image, degrees, signal);
            this.host.finalizeBaseImageGeometry();
        });
    }

    flipHorizontal(): Promise<void> {
        return this.flip('flipX', 'transform:flip-horizontal');
    }

    flipVertical(): Promise<void> {
        return this.flip('flipY', 'transform:flip-vertical');
    }

    resetImageTransform(): Promise<void> {
        return this.enqueue('transform:reset', async (signal) => {
            const image = this.host.getBaseImage();
            if (!image) return;
            await this.applyScale(image, 1, signal);
            await this.applyRotation(image, 0, signal);
            image.set({ flipX: false, flipY: false });
            image.setCoords();
            this.state.flipX = false;
            this.state.flipY = false;
            this.host.finalizeBaseImageGeometry();
        });
    }

    /** @internal Runtime alias retained for source-level compatibility tests. */
    reset(): Promise<void> {
        return this.resetImageTransform();
    }

    getState(): TransformPluginState {
        return cloneState(this.state);
    }

    restoreState(state: TransformPluginState): void {
        this.state.scale = state.scale;
        this.state.rotationDegrees = state.rotationDegrees;
        this.state.flipX = state.flipX;
        this.state.flipY = state.flipY;
    }

    resetStateFromImage(): void {
        const image = this.host.getBaseImage();
        this.state.scale = 1;
        this.state.rotationDegrees = Number(image?.angle) || 0;
        this.state.flipX = image?.flipX === true;
        this.state.flipY = image?.flipY === true;
    }

    dispose(): void {
        this.guard.markDisposed();
        this.queue.clear();
    }

    private flip(property: 'flipX' | 'flipY', operationId: string): Promise<void> {
        return this.enqueue(operationId, async () => {
            const image = this.host.getBaseImage();
            if (!image) return;
            const center = image.getCenterPoint();
            image.set({ originX: 'center', originY: 'center' });
            image.setPositionByOrigin(center, 'center', 'center');
            image.set({ [property]: !image[property] });
            image.setCoords();
            const topLeft = this.computeTopLeftPoint(image);
            image.set({ originX: 'left', originY: 'top' });
            image.setPositionByOrigin(topLeft, 'left', 'top');
            image.setCoords();
            this.state[property] = image[property] === true;
            this.host.finalizeBaseImageGeometry();
        });
    }

    private enqueue(
        operationId: string,
        mutate: (signal: AbortSignal) => Promise<void>,
    ): Promise<void> {
        if (this.guard.isDisposed()) return Promise.resolve();
        return this.queue.add(async () => {
            const image = this.host.getBaseImage();
            if (!image || this.guard.isDisposed()) return;
            const rollback = this.captureRollback(image);
            const mutationId = `${operationId}:${++this.mutationSequence}`;
            await this.geometry.run({
                id: mutationId,
                kind: 'transform',
                operationId,
                mutateBase: async ({ signal }) => {
                    const abort = (): void => this.guard.markDisposed();
                    signal.addEventListener('abort', abort, { once: true });
                    try {
                        await mutate(signal);
                    } finally {
                        signal.removeEventListener('abort', abort);
                    }
                },
                rollbackBase: () => this.restoreRollback(image, rollback),
                metadata: Object.freeze({ pluginId: '@bensitu/transform' }),
            });
        });
    }

    private async applyScale(
        image: FabricNS.FabricImage,
        factor: number,
        signal: AbortSignal,
    ): Promise<void> {
        this.throwIfAborted(signal);
        const scale = Math.max(this.options.minScale, Math.min(this.options.maxScale, factor));
        const topLeft = this.computeTopLeftPoint(image);
        image.set({ originX: 'left', originY: 'top' });
        image.setPositionByOrigin(topLeft, 'left', 'top');
        image.setCoords();
        const target = this.host.getBaseImageScale() * scale;
        await this.guard.runAnimation(() =>
            animateProps(
                image,
                { scaleX: target, scaleY: target },
                {
                    duration: this.options.animationDuration,
                    onChange: () => this.host.requestRender(),
                },
                this.guard,
            ),
        );
        this.throwIfAborted(signal);
        image.set({ scaleX: target, scaleY: target });
        image.setCoords();
        this.state.scale = scale;
    }

    private async applyRotation(
        image: FabricNS.FabricImage,
        degrees: number,
        signal: AbortSignal,
    ): Promise<void> {
        this.throwIfAborted(signal);
        const center = image.getCenterPoint();
        image.set({ originX: 'center', originY: 'center' });
        image.setPositionByOrigin(center, 'center', 'center');
        image.setCoords();
        try {
            await this.guard.runAnimation(() =>
                animateProps(
                    image,
                    { angle: degrees },
                    {
                        duration: this.options.animationDuration,
                        onChange: () => this.host.requestRender(),
                    },
                    this.guard,
                ),
            );
            this.throwIfAborted(signal);
            image.set('angle', degrees);
            image.setCoords();
            const topLeft = this.computeTopLeftPoint(image);
            image.set({ originX: 'left', originY: 'top' });
            image.setPositionByOrigin(topLeft, 'left', 'top');
            image.setCoords();
            this.state.rotationDegrees = degrees;
        } finally {
            if (this.guard.isDisposed()) restoreOrigin(image, 'left', 'top');
        }
    }

    private captureRollback(image: FabricNS.FabricImage): TargetedRollbackState {
        return Object.freeze({
            transform: this.getState(),
            geometryRevision: this.host.getGeometryRevision(),
            canvasSize: this.host.getCanvasSize(),
            image: Object.freeze({
                left: Number(image.left) || 0,
                top: Number(image.top) || 0,
                scaleX: Number(image.scaleX) || 1,
                scaleY: Number(image.scaleY) || 1,
                angle: Number(image.angle) || 0,
                flipX: image.flipX === true,
                flipY: image.flipY === true,
                originX: image.originX ?? 'left',
                originY: image.originY ?? 'top',
            }),
        });
    }

    private restoreRollback(image: FabricNS.FabricImage, rollback: TargetedRollbackState): void {
        if (this.host.isDisposed()) return;
        image.set(rollback.image);
        image.setCoords();
        this.restoreState(rollback.transform);
        this.host.setCanvasSize(rollback.canvasSize.width, rollback.canvasSize.height);
        this.host.setGeometryRevision(rollback.geometryRevision);
        this.host.requestRender();
    }

    private computeTopLeftPoint(image: FabricNS.FabricImage): FabricNS.Point {
        image.setCoords();
        const first = image.getCoords()[0];
        if (first) return first;
        const bounds = image.getBoundingRect();
        const PointConstructor = this.host.fabric.Point;
        if (typeof PointConstructor === 'function') {
            return new PointConstructor(bounds.left, bounds.top);
        }
        return { x: bounds.left, y: bounds.top } as FabricNS.Point;
    }

    private throwIfAborted(signal: AbortSignal): void {
        if (signal.aborted) throw signal.reason ?? new Error('Transform operation aborted.');
        if (this.guard.isDisposed()) throw new Error('Transform plugin is disposed.');
    }
}
