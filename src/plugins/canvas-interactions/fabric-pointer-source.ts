/**
 * Captures primary Fabric pointer events and forwards immutable coordinate snapshots.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import type { Disposable } from '../../sdk/index.js';
import type { PointerSample, PointerSourceSink } from './interaction-types.js';
import { PointerCoordinateMapper } from './pointer-coordinate-mapper.js';

interface NativePointerDetails {
    readonly pointerId?: unknown;
    readonly pointerType?: unknown;
    readonly isPrimary?: unknown;
    readonly button?: unknown;
    readonly shiftKey?: unknown;
    readonly altKey?: unknown;
    readonly ctrlKey?: unknown;
    readonly metaKey?: unknown;
    readonly timeStamp?: unknown;
}

function finiteNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function pointerId(event: NativePointerDetails): number | null {
    return finiteNumber(event.pointerId);
}

function pointerType(event: NativePointerDetails): string | null {
    return typeof event.pointerType === 'string' && event.pointerType.length > 0
        ? event.pointerType
        : null;
}

function samePointer(activePointerId: number | null, event: NativePointerDetails): boolean {
    const incoming = pointerId(event);
    return activePointerId === null || incoming === null || activePointerId === incoming;
}

export class FabricPointerSource implements Disposable {
    private readonly disposers: Array<() => void> = [];
    private activePointerId: number | null = null;
    private pointerActive = false;
    private disposed = false;

    constructor(
        private readonly canvas: FabricNS.Canvas,
        private readonly coordinates: PointerCoordinateMapper,
        private readonly sink: PointerSourceSink,
    ) {
        this.disposers.push(
            canvas.on('mouse:down', (event) => this.handleDown(event)),
            canvas.on('mouse:move', (event) => this.handleMove(event)),
            canvas.on('mouse:up', (event) => this.handleUp(event)),
        );
        const view = canvas.upperCanvasEl.ownerDocument.defaultView;
        if (view) {
            const handleWindowUp = (event: PointerEvent): void => this.handleNativeUp(event);
            const handleCancel = (): void => this.cancelActivePointer();
            view.addEventListener('pointerup', handleWindowUp);
            view.addEventListener('pointercancel', handleCancel);
            view.addEventListener('blur', handleCancel);
            canvas.upperCanvasEl.addEventListener('lostpointercapture', handleCancel);
            this.disposers.push(
                () => view.removeEventListener('pointerup', handleWindowUp),
                () => view.removeEventListener('pointercancel', handleCancel),
                () => view.removeEventListener('blur', handleCancel),
                () => canvas.upperCanvasEl.removeEventListener('lostpointercapture', handleCancel),
            );
        }
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.cancelActivePointer();
        for (const dispose of this.disposers.splice(0).reverse()) dispose();
    }

    private handleDown(event: FabricNS.TPointerEventInfo): void {
        if (this.disposed || this.pointerActive) return;
        const native = event.e as NativePointerDetails;
        if (native.isPrimary === false || (finiteNumber(native.button) ?? 0) !== 0) return;
        const sample = this.createSample(event.scenePoint, event.target ?? null, native);
        if (!sample) return;
        this.pointerActive = true;
        this.activePointerId = sample.pointerId;
        this.sink.down(sample);
    }

    private handleMove(event: FabricNS.TPointerEventInfo): void {
        if (this.disposed || !this.pointerActive) return;
        const native = event.e as NativePointerDetails;
        if (!samePointer(this.activePointerId, native)) return;
        const sample = this.createSample(event.scenePoint, event.target ?? null, native);
        if (sample) this.sink.move(sample);
    }

    private handleUp(event: FabricNS.TPointerEventInfo): void {
        if (this.disposed || !this.pointerActive) return;
        const native = event.e as NativePointerDetails;
        if (!samePointer(this.activePointerId, native)) return;
        const sample = this.createSample(event.scenePoint, event.target ?? null, native);
        this.clearPointer();
        if (sample) this.sink.up(sample);
        else this.sink.cancel();
    }

    private handleNativeUp(event: PointerEvent): void {
        if (this.disposed || !this.pointerActive || !samePointer(this.activePointerId, event)) {
            return;
        }
        const scenePoint = this.canvas.getScenePoint(event);
        const sample = this.createSample(scenePoint, null, event);
        this.clearPointer();
        if (sample) this.sink.up(sample);
        else this.sink.cancel();
    }

    private cancelActivePointer(): void {
        if (!this.pointerActive) return;
        this.clearPointer();
        this.sink.cancel();
    }

    private clearPointer(): void {
        this.pointerActive = false;
        this.activePointerId = null;
    }

    private createSample(
        scenePoint: Readonly<{ x: number; y: number }>,
        target: FabricNS.FabricObject | null,
        native: NativePointerDetails,
    ): PointerSample | null {
        if (!Number.isFinite(scenePoint.x) || !Number.isFinite(scenePoint.y)) return null;
        const canvasPoint = Object.freeze({ x: scenePoint.x, y: scenePoint.y });
        return Object.freeze({
            canvasPoint,
            imagePoint: this.coordinates.toImagePoint(canvasPoint),
            geometryRevision: this.coordinates.getGeometryRevision(),
            timestamp: finiteNumber(native.timeStamp) ?? Date.now(),
            pointerId: pointerId(native),
            pointerType: pointerType(native),
            button: finiteNumber(native.button) ?? 0,
            shiftKey: native.shiftKey === true,
            altKey: native.altKey === true,
            ctrlKey: native.ctrlKey === true,
            metaKey: native.metaKey === true,
            target,
        });
    }
}
