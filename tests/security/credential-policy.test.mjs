import assert from 'node:assert/strict';
import test from 'node:test';

import { containsCredential, findCredentialKinds } from '../../scripts/credential-policy.mjs';

const credentialCases = Object.freeze([
    ['private-key', ['-----BEGIN ', 'OPENSSH PRIVATE KEY-----'].join('')],
    ['github-token', `ghp_${'A'.repeat(36)}`],
    ['github-token', `github_pat_${'B'.repeat(70)}`],
    ['aws-access-key', `AKIA${'C'.repeat(16)}`],
    ['aws-access-key', `ASIA${'D'.repeat(16)}`],
    ['slack-token', `xoxb-${'1'.repeat(12)}-${'E'.repeat(24)}`],
    ['gitlab-token', `glpat-${'F'.repeat(24)}`],
    ['google-api-key', `AIza${'G'.repeat(35)}`],
    ['npm-token', `npm_${'H'.repeat(36)}`],
    ['openai-api-key', `sk-proj-${'I'.repeat(32)}`],
]);

test('shared credential policy covers supported provider signatures', () => {
    for (const [expectedKind, candidate] of credentialCases) {
        assert.equal(containsCredential(candidate), true, expectedKind);
        assert.ok(findCredentialKinds(candidate).includes(expectedKind), expectedKind);
    }
});

test('shared credential policy avoids generic JWT and ordinary identifier false positives', () => {
    for (const candidate of [
        `eyJ${'a'.repeat(80)}.${'b'.repeat(40)}.${'c'.repeat(40)}`,
        'plugin:history',
        'sketch-project-name',
        'github_pat_documentation_placeholder',
        'AKIA-short-fixture',
    ]) {
        assert.equal(containsCredential(candidate), false, candidate);
        assert.deepEqual(findCredentialKinds(candidate), []);
    }
});
