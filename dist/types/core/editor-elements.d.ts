/**
 * Canonical DOM element key resolution for ImageEditor.
 *
 * The resolver merges user-provided IDs with built-in defaults so UI binding
 * modules can work with a complete key-to-ID table.
 */
import type { ElementIdMap } from './public-types.js';
export type ElementKey = keyof Required<ElementIdMap>;
export type ResolvedElementIdMap = Record<ElementKey, string | null>;
export declare function resolveElementIds(idMap: ElementIdMap): ResolvedElementIdMap;
//# sourceMappingURL=editor-elements.d.ts.map