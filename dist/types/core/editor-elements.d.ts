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
export type DomElementGuard<TElement extends HTMLElement> = (element: HTMLElement) => element is TElement;
export declare function isCanvasElement(element: HTMLElement): element is HTMLCanvasElement;
export declare function isInputElement(element: HTMLElement): element is HTMLInputElement;
export declare function isSelectElement(element: HTMLElement): element is HTMLSelectElement;
export declare function isInputOrSelectElement(element: HTMLElement): element is HTMLInputElement | HTMLSelectElement;
/**
 * Resolve a string ID or direct HTMLElement reference to a DOM element.
 *
 * When `guard` is supplied, the resolved element must satisfy that runtime
 * predicate or `null` is returned. Callers that need a specific subtype
 * should pass a guard instead of relying on the generic type parameter alone.
 */
export declare function resolveDomElement<T extends HTMLElement = HTMLElement>(target: string | HTMLElement | null | undefined, ownerDocument?: Document | null, guard?: DomElementGuard<T>): T | null;
export declare function resolveElementTargets(elementMap?: ElementIdMap): ResolvedElementMap;
//# sourceMappingURL=editor-elements.d.ts.map