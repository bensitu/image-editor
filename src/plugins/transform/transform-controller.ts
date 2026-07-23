/**
 * Coordinates Base Image scale, rotation, reflection, animation, state, and geometry mutations.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import {
    animateProps,
    restoreOrigin,
    type AnimationControl,
} from '../../fabric/fabric-animation.js';
import type { DocumentMutationContext, GeometryMutationPort } from '../../core/index.js';
import type {
    BaseImageReadPort,
    CoreStatusPort,
    FabricRuntimePort,
    RenderRequestPort,
} from '../../sdk/index.js';

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

export interface TransformMutationOptions {
    readonly parent?: DocumentMutationContext;
}

interface MutableTransformState {
    scale: number;
    rotationDegrees: number;
    flipX: boolean;
    flipY: boolean;
}

interface TargetedRollbackState {
    readonly transform: TransformPluginState;
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

class PluginAnimationControl implements AnimationControl {
    private disposed = false;
    private readonly aborters = new Set<() => void>();

    isDisposed(): boolean {
        return this.disposed;
    }

    registerAnimationAborter(abort: () => void): () => void {
        if (this.disposed) {
            abort();
            return () => undefined;
        }
        this.aborters.add(abort);
        return () => this.aborters.delete(abort);
    }

    cancelAnimations(): void {
        for (const abort of [...this.aborters]) {
            try {
                abort();
            } catch {
                // Cancellation must continue across independent Fabric handles.
            }
        }
        this.aborters.clear();
    }

    dispose(): void {
        this.disposed = true;
        this.cancelAnimations();
    }
}

export class TransformPluginController {
    private readonly animations = new PluginAnimationControl();
    private readonly state: MutableTransformState = {
        scale: 1,
        rotationDegrees: 0,
        flipX: false,
        flipY: false,
    };
    private mutationSequence = 0;

    constructor(
        private readonly environment: CoreStatusPort & FabricRuntimePort,
        private readonly baseImage: BaseImageReadPort,
        private readonly render: RenderRequestPort,
        private readonly geometry: GeometryMutationPort,
        readonly options: ResolvedTransformPluginOptions,
    ) {}

    scale(factor: number, options: TransformMutationOptions = {}): Promise<void> {
        return this.scaleWithOperation(factor, 'transform:scale', options);
    }

    private scaleWithOperation(
        factor: number,
        operationId: string,
        options: TransformMutationOptions = {},
    ): Promise<void> {
        if (!Number.isFinite(factor)) return Promise.resolve();
        return this.enqueue(
            operationId,
            async (signal) => {
                const image = this.baseImage.getBaseImage();
                if (!image) return;
                await this.applyScale(image, factor, signal);
            },
            options,
        );
    }

    zoomIn(options: TransformMutationOptions = {}): Promise<void> {
        return this.scaleWithOperation(
            this.state.scale + this.options.scaleStep,
            'transform:zoom-in',
            options,
        );
    }

    zoomOut(options: TransformMutationOptions = {}): Promise<void> {
        return this.scaleWithOperation(
            this.state.scale - this.options.scaleStep,
            'transform:zoom-out',
            options,
        );
    }

    rotate(degrees: number, options: TransformMutationOptions = {}): Promise<void> {
        if (!Number.isFinite(degrees)) return Promise.resolve();
        return this.enqueue(
            'transform:rotate',
            async (signal) => {
                const image = this.baseImage.getBaseImage();
                if (!image) return;
                await this.applyRotation(image, degrees, signal);
            },
            options,
        );
    }

    flipHorizontal(options: TransformMutationOptions = {}): Promise<void> {
        return this.flip('flipX', 'transform:flip-horizontal', options);
    }

    flipVertical(options: TransformMutationOptions = {}): Promise<void> {
        return this.flip('flipY', 'transform:flip-vertical', options);
    }

    resetImageTransform(options: TransformMutationOptions = {}): Promise<void> {
        return this.enqueue(
            'transform:reset',
            async (signal) => {
                const image = this.baseImage.getBaseImage();
                if (!image) return;
                await this.applyScale(image, 1, signal);
                await this.applyRotation(image, 0, signal);
                image.set({ flipX: false, flipY: false });
                image.setCoords();
                this.state.flipX = false;
                this.state.flipY = false;
            },
            options,
        );
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
        const image = this.baseImage.getBaseImage();
        this.state.scale = 1;
        this.state.rotationDegrees = Number(image?.angle) || 0;
        this.state.flipX = image?.flipX === true;
        this.state.flipY = image?.flipY === true;
    }

    dispose(): void {
        this.animations.dispose();
    }

    private flip(
        property: 'flipX' | 'flipY',
        operationId: string,
        options: TransformMutationOptions,
    ): Promise<void> {
        return this.enqueue(
            operationId,
            async () => {
                const image = this.baseImage.getBaseImage();
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
            },
            options,
        );
    }

    private enqueue(
        operationId: string,
        mutate: (signal: AbortSignal) => Promise<void>,
        options: TransformMutationOptions,
    ): Promise<void> {
        if (this.animations.isDisposed()) return Promise.resolve();
        const image = this.baseImage.getBaseImage();
        if (!image) return Promise.resolve();
        const rollback = this.captureRollback(image);
        const mutationId = `${operationId}:${++this.mutationSequence}`;
        return this.geometry
            .run({
                id: mutationId,
                kind: 'transform',
                operationId,
                ...(options.parent ? { parent: options.parent } : {}),
                mutateBase: async ({ signal }) => {
                    await mutate(signal);
                },
                rollbackBase: () => this.restoreRollback(image, rollback),
                metadata: Object.freeze({ pluginId: 'plugin:transform' }),
            })
            .then(() => undefined);
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
        const target = this.baseImage.getBaseImageScale() * scale;
        await this.runAnimation(signal, () =>
            animateProps(
                image,
                { scaleX: target, scaleY: target },
                {
                    duration: this.options.animationDuration,
                    onChange: () => this.render.requestRender(),
                },
                this.animations,
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
            await this.runAnimation(signal, () =>
                animateProps(
                    image,
                    { angle: degrees },
                    {
                        duration: this.options.animationDuration,
                        onChange: () => this.render.requestRender(),
                    },
                    this.animations,
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
            if (this.animations.isDisposed()) restoreOrigin(image, 'left', 'top');
        }
    }

    private captureRollback(image: FabricNS.FabricImage): TargetedRollbackState {
        return Object.freeze({
            transform: this.getState(),
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
        if (this.environment.isDisposed()) return;
        image.set(rollback.image);
        image.setCoords();
        this.restoreState(rollback.transform);
        this.render.requestRender();
    }

    private computeTopLeftPoint(image: FabricNS.FabricImage): FabricNS.Point {
        image.setCoords();
        const first = image.getCoords()[0];
        if (first) return first;
        const bounds = image.getBoundingRect();
        const PointConstructor = this.environment.fabric.Point;
        if (typeof PointConstructor === 'function') {
            return new PointConstructor(bounds.left, bounds.top);
        }
        return { x: bounds.left, y: bounds.top } as FabricNS.Point;
    }

    private throwIfAborted(signal: AbortSignal): void {
        if (signal.aborted) throw signal.reason ?? new Error('Transform operation aborted.');
        if (this.animations.isDisposed()) throw new Error('Transform plugin is disposed.');
    }

    private async runAnimation(signal: AbortSignal, animation: () => Promise<void>): Promise<void> {
        const cancel = (): void => this.animations.cancelAnimations();
        signal.addEventListener('abort', cancel, { once: true });
        if (signal.aborted) cancel();
        try {
            await animation();
        } finally {
            signal.removeEventListener('abort', cancel);
        }
    }
}
