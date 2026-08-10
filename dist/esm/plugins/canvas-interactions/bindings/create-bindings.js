import { ShapeInteractionBinding } from './shape-interaction-binding.js';
import { DrawInteractionBinding } from './draw-interaction-binding.js';
import { MosaicInteractionBinding } from './mosaic-interaction-binding.js';
import { TextInteractionBinding } from './text-interaction-binding.js';
export function createCanvasInteractionBindings(options) {
    const bindings = [];
    if (options.text)
        bindings.push(new TextInteractionBinding(options.text));
    if (options.shape)
        bindings.push(new ShapeInteractionBinding(options.shape));
    if (options.draw)
        bindings.push(new DrawInteractionBinding(options.draw));
    if (options.mosaic)
        bindings.push(new MosaicInteractionBinding(options.mosaic));
    return Object.freeze(bindings);
}
//# sourceMappingURL=create-bindings.js.map