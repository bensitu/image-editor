import type { ElementIdMap } from './public-types.js';
export type ElementKey = keyof Required<ElementIdMap>;
export type ResolvedElementIdMap = Record<ElementKey, string | null>;
export declare function resolveElementIds(idMap: ElementIdMap): ResolvedElementIdMap;
//# sourceMappingURL=editor-elements.d.ts.map