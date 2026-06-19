import type { ResolvedDrawConfig, ResolvedMosaicConfig, ResolvedTextAnnotationConfig } from '../core/public-types.js';
import type { ElementKey } from '../core/editor-elements.js';
export interface EditorInputSnapshot {
    currentScale: number;
    mosaicConfig: Readonly<ResolvedMosaicConfig>;
    textConfig: Readonly<ResolvedTextAnnotationConfig>;
    drawConfig: Readonly<ResolvedDrawConfig>;
}
export type EditorInputResolver = (key: ElementKey) => HTMLInputElement | null;
export declare function applyEditorInputState(snapshot: EditorInputSnapshot, getInputElement: EditorInputResolver): void;
//# sourceMappingURL=editor-input-state.d.ts.map