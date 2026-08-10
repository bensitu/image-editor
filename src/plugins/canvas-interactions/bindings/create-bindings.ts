/**
 * Resolves configured public Feature APIs into private Canvas interaction adapters.
 *
 * @module
 */

import type { CanvasInteractionBinding } from '../interaction-binding.js';
import type { CanvasInteractionsPluginOptions } from '../canvas-interactions-types.js';
import { ShapeInteractionBinding } from './shape-interaction-binding.js';
import { DrawInteractionBinding } from './draw-interaction-binding.js';

export function createCanvasInteractionBindings(
    options: CanvasInteractionsPluginOptions,
): readonly CanvasInteractionBinding[] {
    const bindings: CanvasInteractionBinding[] = [];
    if (options.shape) bindings.push(new ShapeInteractionBinding(options.shape));
    if (options.draw) bindings.push(new DrawInteractionBinding(options.draw));
    return Object.freeze(bindings);
}
