/**
 * Color normalization for persistent overlay state.
 *
 * Exported overlay colors use canonical #RRGGBB or #RRGGBBAA strings.
 * Import accepts canonical hex plus rgb()/rgba() for interoperability.
 *
 * @module
 */
export declare function tryNormalizeOverlayColor(value: unknown): `#${string}` | null;
export declare function normalizeOverlayColor(value: unknown, fallback: `#${string}`): `#${string}`;
export declare function isCanonicalOverlayColor(value: unknown): value is `#${string}`;
