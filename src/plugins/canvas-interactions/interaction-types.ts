/**
 * Declares renderer event snapshots and the internal pointer source contract.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

export interface InteractionPoint {
    readonly x: number;
    readonly y: number;
}

export interface PointerSample {
    readonly canvasPoint: InteractionPoint;
    readonly imagePoint: InteractionPoint | null;
    readonly geometryRevision: number;
    readonly timestamp: number;
    readonly pointerId: number | null;
    readonly pointerType: string | null;
    readonly button: number;
    readonly shiftKey: boolean;
    readonly altKey: boolean;
    readonly ctrlKey: boolean;
    readonly metaKey: boolean;
    readonly target: FabricNS.FabricObject | null;
}

export interface PointerSourceSink {
    down(sample: PointerSample): void;
    move(sample: PointerSample): void;
    up(sample: PointerSample): void;
    cancel(): void;
}
