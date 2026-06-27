/**
 * File-input helpers used by the editor's file-input flow.
 *
 * These helpers cover three concerns:
 *
 * - Determining whether a `File` selected through the upload control is a
 *   supported image, including the extension fallback when `file.type` is
 *   empty (some operating systems and browsers report an empty MIME type
 *   for known extensions).
 * - Reading the file as a base64 data URL so the result can be routed
 *   through the existing transactional `loadImage` pipeline (and therefore
 *   inherit its rollback behavior on decode/Fabric/timeout failure).
 * - Reading the file as an ArrayBuffer for lightweight metadata probes such
 *   as JPEG EXIF orientation parsing.
 * - Resetting the file input value after every attempt so selecting the
 *   same file again triggers a fresh `change` event.
 *
 * The helpers do not call `loadImage` themselves; the orchestrator wires
 * them into the file-input change handler. That keeps the public
 * `loadImage` API unchanged beyond `LoadImageOptions`.
 */

/**
 * Supported image extensions and the MIME type each one resolves to.
 *
 * Supported file extensions: `png`, `jpg`/`jpeg`, `webp`.
 *
 * Keys are lowercase extensions without the leading `.`.
 */
export const SUPPORTED_IMAGE_EXTENSIONS: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
};

export const SUPPORTED_IMAGE_MIME_TYPES = new Set(Object.values(SUPPORTED_IMAGE_EXTENSIONS));

/**
 * Return true only for image data URLs whose MIME type is accepted by the
 * upload path. This keeps public `loadImage(dataUrl)` validation aligned
 * with file-input validation and rejects unsupported image containers such as
 * SVG before any canvas or lifecycle state is touched.
 *
 * The `data:image/` prefix remains case-sensitive to preserve the previous
 * public no-op contract for non-matching data URL prefixes.
 *
 * @param value - Candidate data URL.
 * @returns True when the data URL carries a supported image MIME type.
 */
export function isSupportedImageDataUrl(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    if (!value.startsWith('data:image/')) return false;
    const match = /^data:(image\/[^;,]+)(?:[;,])/.exec(value);
    if (!match) return false;
    return SUPPORTED_IMAGE_MIME_TYPES.has(match[1]!.toLowerCase());
}

/**
 * Determine whether a `File` is a supported image and return its resolved
 * MIME type, or `null` when it should be rejected.
 *
 * Resolution order:
 *
 * 1. If `file.type` is one of the supported image MIME types, return it
 *    verbatim.
 * 2. If `file.type` is empty, infer the MIME type from the file
 *    extension via {@link SUPPORTED_IMAGE_EXTENSIONS}. This covers the
 *    case where a browser or OS reports `''` for files with a known
 *    extension.
 * 3. Otherwise, return `null` so the caller can skip the load without
 *    mutating editor state.
 *
 * @param file - File selected via the upload control.
 * @returns The resolved MIME type, or `null` when the file is not a
 *          supported image.
 */
export function inferImageMimeType(file: File): string | null {
    if (file.type && SUPPORTED_IMAGE_MIME_TYPES.has(file.type)) return file.type;
    if (file.type) return null;
    const match = /\.([a-z0-9]+)$/i.exec(file.name);
    const ext = match?.[1]?.toLowerCase();
    if (!ext) return null;
    return SUPPORTED_IMAGE_EXTENSIONS[ext] ?? null;
}

/**
 * Read a `File` as a base64 data URL using `FileReader`.
 *
 * The returned data URL is suitable for the transactional `loadImage`
 * pipeline: on failure the editor's existing
 * rollback bundle restores placeholder visibility, scroll, overflow,
 * `originalImage`, `lastSnapshot`, and the canvas JSON snapshot.
 *
 * @param file - File to read.
 * @returns A promise that resolves to the data URL string, or rejects when
 *          the underlying `FileReader` errors out or returns a non-string
 *          result.
 */
export function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const fileReaderResult = reader.result;
            if (typeof fileReaderResult === 'string') {
                resolve(fileReaderResult);
            } else {
                reject(new Error('FileReader returned a non-string result'));
            }
        };
        reader.onerror = () => {
            reject(reader.error ?? new Error('FileReader error'));
        };
        reader.onabort = () => {
            reject(new Error('FileReader read aborted'));
        };
        reader.readAsDataURL(file);
    });
}

/**
 * Read a `File` as an ArrayBuffer.
 *
 * Uses the native Blob API when available and falls back to FileReader for
 * older browser-like environments.
 */
export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    if (typeof file.arrayBuffer === 'function') {
        return file.arrayBuffer();
    }

    return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (result instanceof ArrayBuffer) {
                resolve(result);
            } else {
                reject(new Error('FileReader returned a non-ArrayBuffer result'));
            }
        };
        reader.onerror = () => {
            reject(reader.error ?? new Error('FileReader error'));
        };
        reader.onabort = () => {
            reject(new Error('FileReader read aborted'));
        };
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Reset a file input element's value so selecting the same file again
 * triggers a fresh `change` event.
 *
 * Some browsers reject programmatic assignment to `input.value` on
 * security grounds; the assignment is wrapped in a `try`/`catch` so the
 * caller never has to special-case those environments. A `null` input is
 * a no-op so callers can pass the result of `document.getElementById`
 * without an extra null check.
 *
 * @param input - File input element, or `null` when the element is not
 *              present in the DOM.
 */
export function resetFileInput(input: HTMLInputElement | null): void {
    if (!input) return;
    try {
        input.value = '';
    } catch {
        /* Some browsers reject programmatic resets; ignore. */
    }
}
