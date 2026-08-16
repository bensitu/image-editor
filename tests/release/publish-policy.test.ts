import assert from 'node:assert/strict';
import test from 'node:test';

import {
    publishReleaseArtifacts,
    validateReleaseTag,
} from '../../scripts/publish-release-artifacts.mjs';

interface ReleaseArtifact {
    readonly name: string;
    readonly version: string;
    readonly integrity: string;
}

function artifacts(): ReleaseArtifact[] {
    return [
        {
            name: '@bensitu/image-editor-codemod',
            version: '3.0.0-rc.1',
            integrity: 'sha512-codemod',
        },
        {
            name: '@bensitu/image-editor',
            version: '3.0.0-rc.1',
            integrity: 'sha512-main',
        },
    ];
}

function metadataFor(artifact: ReleaseArtifact): ReleaseArtifact {
    return {
        name: artifact.name,
        version: artifact.version,
        integrity: artifact.integrity,
    };
}

test('release tag policy keeps prereleases away from latest', () => {
    assert.throws(() => validateReleaseTag('3.0.0-rc.1', 'latest'), /cannot use the npm "latest"/);
    assert.equal(validateReleaseTag('3.0.0-rc.1', 'next').channel, 'rc');
    assert.equal(validateReleaseTag('3.0.0', 'latest').channel, 'stable');
    assert.throws(() => validateReleaseTag('3.0.0-rc.1', 'invalid tag'), /invalid npm dist-tag/i);
    assert.throws(() => validateReleaseTag('3.0.0-beta.1', 'next'), /must use one of: beta/);
    assert.equal(validateReleaseTag('3.0.0-alpha.1', 'alpha').channel, 'alpha');
});

test('dual-package publish skips verified artifacts and publishes only missing versions', async () => {
    const releaseArtifacts = artifacts();
    const registry = new Map<string, ReleaseArtifact>([
        [releaseArtifacts[0].name, metadataFor(releaseArtifacts[0])],
    ]);
    const publishCalls: string[] = [];

    const statuses = await publishReleaseArtifacts(releaseArtifacts, {
        inspect: async (artifact: ReleaseArtifact) => registry.get(artifact.name) ?? null,
        publish: async (artifact: ReleaseArtifact) => {
            publishCalls.push(artifact.name);
            registry.set(artifact.name, metadataFor(artifact));
        },
    });

    assert.deepEqual(
        statuses.map(({ status }) => status),
        ['already verified', 'published'],
    );
    assert.deepEqual(publishCalls, ['@bensitu/image-editor']);
});

test('dual-package publish is safe to rerun after a partial failure', async () => {
    const releaseArtifacts = artifacts();
    const registry = new Map<string, ReleaseArtifact>();
    let failMain = true;
    const publish = async (artifact: ReleaseArtifact) => {
        if (artifact.name === '@bensitu/image-editor' && failMain) {
            throw new Error('synthetic main package publish failure');
        }
        registry.set(artifact.name, metadataFor(artifact));
    };
    const inspect = async (artifact: ReleaseArtifact) => registry.get(artifact.name) ?? null;

    await assert.rejects(
        publishReleaseArtifacts(releaseArtifacts, { inspect, publish }),
        /synthetic main package publish failure/,
    );
    assert.equal(registry.has('@bensitu/image-editor-codemod'), true);
    assert.equal(registry.has('@bensitu/image-editor'), false);

    failMain = false;
    const statuses = await publishReleaseArtifacts(releaseArtifacts, { inspect, publish });
    assert.deepEqual(
        statuses.map(({ status }) => status),
        ['already verified', 'published'],
    );
});

test('dual-package publish waits for newly published versions to become visible', async () => {
    const releaseArtifacts = artifacts();
    const published = new Set<string>();
    const inspectionAttempts = new Map<string, number>();
    let waits = 0;

    const statuses = await publishReleaseArtifacts(releaseArtifacts, {
        inspect: async (artifact: ReleaseArtifact) => {
            if (!published.has(artifact.name)) return null;
            const attempts = (inspectionAttempts.get(artifact.name) ?? 0) + 1;
            inspectionAttempts.set(artifact.name, attempts);
            return attempts >= 3 ? metadataFor(artifact) : null;
        },
        publish: async (artifact: ReleaseArtifact) => {
            published.add(artifact.name);
        },
        publishedInspection: {
            attempts: 3,
            delayMs: 0,
            wait: async () => {
                waits += 1;
            },
        },
    });

    assert.deepEqual(
        statuses.map(({ status }) => status),
        ['published', 'published'],
    );
    assert.equal(waits, 4);
});

test('an existing package with different integrity is a hard failure', async () => {
    const releaseArtifacts = artifacts();
    let publishCalls = 0;

    await assert.rejects(
        publishReleaseArtifacts(releaseArtifacts, {
            inspect: async (artifact: ReleaseArtifact) =>
                artifact === releaseArtifacts[0]
                    ? { ...metadataFor(artifact), integrity: 'sha512-different' }
                    : null,
            publish: async () => {
                publishCalls += 1;
            },
        }),
        /does not match the release tarball/,
    );
    assert.equal(publishCalls, 0);
});
