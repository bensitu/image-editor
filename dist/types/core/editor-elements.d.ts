/**
 * Canonical DOM target resolution for ImageEditor.
 *
 * The resolver merges user-provided string IDs, HTMLElement refs, and explicit
 * null targets with built-in defaults so UI modules can work with a complete
 * logical key table while still supporting framework-owned DOM nodes.
 */
import type { ElementIdMap } from './public-types.js';
export type ElementKey = keyof Required<ElementIdMap>;
export type ResolvedElementTarget = string | HTMLElement | null;
export type ResolvedElementMap = Record<ElementKey, ResolvedElementTarget>;
export declare function resolveDomElement<T extends HTMLElement>(target: string | HTMLElement | null | undefined, ownerDocument?: Document | null): T | null;
export declare function resolveElementTargets(elementMap?: ElementIdMap): ResolvedElementMap;
//# sourceMappingURL=editor-elements.d.ts.map