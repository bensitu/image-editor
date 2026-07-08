/**
 * Color normalization for persistent overlay state.
 *
 * Exported overlay colors use canonical #RRGGBB or #RRGGBBAA strings.
 * Import accepts canonical hex plus rgb()/rgba() for interoperability.
 *
 * @module
 */

const HEX_SHORT = /^#([0-9a-f]{3}|[0-9a-f]{4})$/i;
const HEX_LONG = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_FUNCTION = /^rgba?\((.+)\)$/i;

function toHexByte(value: number): string {
    return Math.max(0, Math.min(255, Math.round(value)))
        .toString(16)
        .padStart(2, '0')
        .toUpperCase();
}

function normalizeHex(value: string): `#${string}` | null {
    const trimmed = value.trim();
    if (HEX_LONG.test(trimmed)) return `#${trimmed.slice(1).toUpperCase()}`;
    if (!HEX_SHORT.test(trimmed)) return null;
    const digits = trimmed.slice(1);
    const expanded = digits
        .split('')
        .map((digit) => `${digit}${digit}`)
        .join('')
        .toUpperCase();
    return `#${expanded}`;
}

function parseRgbChannel(value: string): number | null {
    const trimmed = value.trim();
    if (trimmed.endsWith('%')) {
        const percent = Number(trimmed.slice(0, -1));
        if (!Number.isFinite(percent)) return null;
        return Math.max(0, Math.min(100, percent)) * 2.55;
    }
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : null;
}

function parseAlpha(value: string | undefined): number | null {
    if (value === undefined) return 1;
    const trimmed = value.trim();
    if (trimmed.endsWith('%')) {
        const percent = Number(trimmed.slice(0, -1));
        if (!Number.isFinite(percent)) return null;
        return Math.max(0, Math.min(100, percent)) / 100;
    }
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : null;
}

function normalizeRgbFunction(value: string): `#${string}` | null {
    const match = value.trim().match(RGB_FUNCTION);
    if (!match) return null;
    const parts = match[1]!.split(',').map((part) => part.trim());
    if (parts.length !== 3 && parts.length !== 4) return null;
    const r = parseRgbChannel(parts[0]!);
    const g = parseRgbChannel(parts[1]!);
    const b = parseRgbChannel(parts[2]!);
    const alpha = parseAlpha(parts[3]);
    if (r === null || g === null || b === null || alpha === null) return null;
    const rgb = `${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
    return alpha >= 1 ? `#${rgb}` : `#${rgb}${toHexByte(alpha * 255)}`;
}

export function tryNormalizeOverlayColor(value: unknown): `#${string}` | null {
    if (typeof value !== 'string') return null;
    if (value.trim().toLowerCase() === 'transparent') return '#00000000';
    return normalizeHex(value) ?? normalizeRgbFunction(value);
}

export function normalizeOverlayColor(value: unknown, fallback: `#${string}`): `#${string}` {
    return tryNormalizeOverlayColor(value) ?? fallback;
}

export function isCanonicalOverlayColor(value: unknown): value is `#${string}` {
    return typeof value === 'string' && HEX_LONG.test(value);
}
