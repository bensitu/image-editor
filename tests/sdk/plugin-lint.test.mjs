import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { inspectPluginPackage } from '../../scripts/check-plugin-conformance.mjs';

const fixtures = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../fixtures/plugin-lint',
);

test('structural Plugin checks accept a public-only package with declared permissions', async () => {
    const report = await inspectPluginPackage(path.join(fixtures, 'passing'));

    assert.equal(report.profile, '3.0');
    assert.equal(report.structuralPassed, true);
    assert.equal(report.strictPassed, true);
    assert.deepEqual(report.diagnostics, []);
    assert.deepEqual(report.declaredPermissions, ['fabric:custom-class', 'fabric:objects']);
    assert.deepEqual(report.scannedFiles, ['src/plugin.ts', 'src/runtime.js']);
    assert.equal(report.limitations.securitySandbox, false);
    assert.equal(report.limitations.runtimeConformanceRequired, true);
});

test('structural and best-effort Plugin checks report exact source locations', async () => {
    const report = await inspectPluginPackage(path.join(fixtures, 'failing'));
    const rules = new Set(report.diagnostics.map((diagnostic) => diagnostic.ruleId));

    for (const rule of [
        'no-internal-import',
        'require-declared-fabric-import-permission',
        'require-peer-dependencies',
        'no-core-in-dependencies',
        'no-fabric-in-dependencies',
        'require-overlay-persistence-definition',
        'detect-obvious-prototype-write',
        'detect-obvious-class-registry-write',
        'detect-unhandled-registration-return',
    ]) {
        assert.equal(rules.has(rule), true, `${rule} must have a negative fixture`);
    }
    assert.equal(report.structuralPassed, false);
    assert.equal(report.strictPassed, false);
    assert.ok(
        report.diagnostics.every(
            (diagnostic) =>
                diagnostic.file.length > 0 && diagnostic.line > 0 && diagnostic.column > 0,
        ),
    );
    assert.ok(
        report.diagnostics
            .filter((diagnostic) => diagnostic.category === 'best-effort')
            .every(
                (diagnostic) =>
                    /false negatives/u.test(diagnostic.message) &&
                    /not a sandbox/u.test(diagnostic.message),
            ),
    );
});
