/**
 * File-input image loading adapter.
 *
 * Reads browser `File` objects, validates supported image MIME types, and
 * forwards data URLs into the transactional image loader.
 */
import type { ResolvedOptions } from '../core/public-types.js';
export interface LoadImageFileContext {
    options: ResolvedOptions;
    getInputElement(): HTMLInputElement | null;
    loadImage(dataUrl: string): Promise<void>;
}
/**
 * Read a `File` selected via the upload control as a base64 data URL
 * and route it through the transactional `loadImage` pipeline.
 *
 * Routes through `utils/file.ts` so MIME inference (including the
 * empty-`file.type` extension fallback), `FileReader` plumbing, and
 * input reset live in one place. The input is reset on both success
 * and failure so re-selecting the same file fires a fresh `change`
 * event.
 */
export declare function loadImageFile(context: LoadImageFileContext, file: File): Promise<void>;
