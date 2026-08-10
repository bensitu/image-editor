/**
 * Defines the private contract between the pointer runtime and Feature adapters.
 *
 * @module
 */

import type {
    InteractionCancelReason,
    CanvasInteractionErrorContext,
} from './canvas-interactions-types.js';
import type { PointerSample } from './interaction-types.js';

export interface InteractionGestureContext {
    readonly epoch: number;
    isCurrent(): boolean;
}

export interface PointerDownContext {
    readonly sample: PointerSample;
    readonly activeToolId: string;
    readonly gesture: InteractionGestureContext;
}

export interface InteractionClaim<TGesture> {
    readonly gesture: TGesture;
}

export interface CanvasInteractionBinding<TGesture = unknown> {
    readonly id: string;
    readonly toolId: string;
    claim(context: PointerDownContext): InteractionClaim<TGesture> | null;
    move(gesture: TGesture, sample: PointerSample): Promise<void> | void;
    end(gesture: TGesture, sample: PointerSample): Promise<void> | void;
    cancel(gesture: TGesture, reason: InteractionCancelReason): Promise<void> | void;
}

export type InteractionOperation = CanvasInteractionErrorContext['operation'];
