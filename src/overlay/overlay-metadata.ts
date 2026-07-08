/**
 * JSON-compatible metadata validation and cloning helpers.
 *
 * @module
 */

import type {
    OverlayImportWarning,
    OverlayMetadata,
    OverlayValidationError,
    OverlayValidationOptions,
} from './overlay-state-types.js';

export const DEFAULT_METADATA_DEPTH = 4;
export const DEFAULT_METADATA_BYTES = 65536;

const METADATA_NAMESPACE = /^(core|app|plugin)\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/;

export interface MetadataValidationResult {
    value?: OverlayMetadata;
    errors: OverlayValidationError[];
    warnings: OverlayImportWarning[];
}

function getUtf8ByteLength(value: string): number {
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(value).byteLength;
    return value.length;
}

function metadataLimit(value: number | undefined, fallback: number): number {
    return Number.isFinite(value) && Number(value) > 0 ? Math.floor(Number(value)) : fallback;
}

function addError(
    errors: OverlayValidationError[],
    path: string,
    code: string,
    message: string,
): void {
    errors.push({ path, code, message });
}

function cloneJsonValue(
    input: unknown,
    path: string,
    depth: number,
    maxDepth: number,
    seen: WeakSet<object>,
    errors: OverlayValidationError[],
): unknown {
    if (
        input === null ||
        typeof input === 'string' ||
        typeof input === 'number' ||
        typeof input === 'boolean'
    ) {
        if (typeof input === 'number' && !Number.isFinite(input)) {
            addError(errors, path, 'metadata.invalidNumber', 'Metadata numbers must be finite.');
            return undefined;
        }
        return input;
    }

    if (input === undefined || typeof input === 'function' || typeof input === 'symbol') {
        addError(errors, path, 'metadata.invalidValue', 'Metadata must be JSON-compatible.');
        return undefined;
    }

    if (typeof input === 'bigint') {
        addError(errors, path, 'metadata.invalidBigInt', 'Metadata must not contain bigint.');
        return undefined;
    }

    if (!input || typeof input !== 'object') return input;
    if (seen.has(input)) {
        addError(errors, path, 'metadata.cyclic', 'Metadata must not contain cyclic references.');
        return undefined;
    }
    if (depth > maxDepth) {
        addError(errors, path, 'metadata.maxDepth', `Metadata exceeds max depth ${maxDepth}.`);
        return undefined;
    }

    seen.add(input);
    if (Array.isArray(input)) {
        const output = input.map((entry, index) =>
            cloneJsonValue(entry, `${path}[${index}]`, depth + 1, maxDepth, seen, errors),
        );
        seen.delete(input);
        return output;
    }

    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
        output[key] = cloneJsonValue(value, `${path}.${key}`, depth + 1, maxDepth, seen, errors);
    }
    seen.delete(input);
    return output;
}

export function validateOverlayMetadata(
    input: unknown,
    path: string,
    options: OverlayValidationOptions = {},
): MetadataValidationResult {
    const errors: OverlayValidationError[] = [];
    const warnings: OverlayImportWarning[] = [];
    if (input === undefined) return { errors, warnings };
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        addError(errors, path, 'metadata.invalidRoot', 'Metadata must be an object.');
        return { errors, warnings };
    }

    const maxDepth = metadataLimit(options.maxMetadataDepth, DEFAULT_METADATA_DEPTH);
    const maxBytes = metadataLimit(options.maxMetadataBytes, DEFAULT_METADATA_BYTES);
    const output: OverlayMetadata = {};

    for (const [namespace, namespaceValue] of Object.entries(input)) {
        const namespacePath = `${path}.${namespace}`;
        if (!METADATA_NAMESPACE.test(namespace)) {
            addError(
                errors,
                namespacePath,
                'metadata.invalidNamespace',
                `Metadata namespace "${namespace}" is not valid.`,
            );
            continue;
        }
        if (
            !namespaceValue ||
            typeof namespaceValue !== 'object' ||
            Array.isArray(namespaceValue)
        ) {
            addError(
                errors,
                namespacePath,
                'metadata.invalidNamespaceValue',
                'Metadata namespace values must be objects.',
            );
            continue;
        }
        const cloned = cloneJsonValue(
            namespaceValue,
            namespacePath,
            1,
            maxDepth,
            new WeakSet(),
            errors,
        );
        if (cloned && typeof cloned === 'object' && !Array.isArray(cloned)) {
            output[namespace] = cloned as Record<string, unknown>;
        }
    }

    if (errors.length === 0) {
        const bytes = getUtf8ByteLength(JSON.stringify(output));
        if (bytes > maxBytes) {
            addError(
                errors,
                path,
                'metadata.maxBytes',
                `Metadata size ${bytes} bytes exceeds maxMetadataBytes ${maxBytes}.`,
            );
        }
    }

    return {
        value: errors.length === 0 ? output : undefined,
        errors,
        warnings,
    };
}

export function cloneOverlayMetadata(
    metadata: OverlayMetadata | undefined,
): OverlayMetadata | undefined {
    if (!metadata) return undefined;
    return JSON.parse(JSON.stringify(metadata)) as OverlayMetadata;
}
