/**
 * Defines the shared credential signatures used by repository and package scans.
 *
 * @module
 */

export const CREDENTIAL_PATTERNS = Object.freeze([
    Object.freeze({
        kind: 'private-key',
        pattern: /-----BEGIN (?:EC |OPENSSH |PGP |RSA )?PRIVATE KEY-----/u,
    }),
    Object.freeze({
        kind: 'github-token',
        pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{30,255}|github_pat_[A-Za-z0-9_]{50,255})\b/u,
    }),
    Object.freeze({
        kind: 'aws-access-key',
        pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u,
    }),
    Object.freeze({
        kind: 'slack-token',
        pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,255}\b/u,
    }),
    Object.freeze({
        kind: 'gitlab-token',
        pattern: /\bglpat-[A-Za-z0-9_-]{20,255}\b/u,
    }),
    Object.freeze({
        kind: 'google-api-key',
        pattern: /\bAIza[A-Za-z0-9_-]{35}\b/u,
    }),
    Object.freeze({
        kind: 'npm-token',
        pattern: /\bnpm_[A-Za-z0-9]{36,255}\b/u,
    }),
    Object.freeze({
        kind: 'openai-api-key',
        pattern: /\bsk-(?:(?:proj|svcacct)-)?[A-Za-z0-9_-]{20,255}\b/u,
    }),
]);

export function findCredentialKinds(source) {
    if (typeof source !== 'string') return Object.freeze([]);
    return Object.freeze(
        CREDENTIAL_PATTERNS.filter(({ pattern }) => pattern.test(source)).map(({ kind }) => kind),
    );
}

export function containsCredential(source) {
    return findCredentialKinds(source).length > 0;
}
