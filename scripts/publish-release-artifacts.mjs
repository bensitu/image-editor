/**
 * Validates npm release tags and publishes a two-package release idempotently.
 *
 * @module
 */

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const execFileAsync = promisify(execFile);
const DEFAULT_REGISTRY = 'https://registry.npmjs.org';
const VALID_DIST_TAG = /^[a-z][a-z0-9._-]{0,63}$/u;
const SEMVER_PATTERN =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

function parseReleaseVersion(versionInput) {
    const version = String(versionInput ?? '');
    const match = SEMVER_PATTERN.exec(version);
    if (!match) throw new Error(`Invalid release version: ${versionInput}`);
    const prerelease = match[4]?.split('.') ?? [];
    if (prerelease.some((identifier) => /^\d+$/u.test(identifier) && /^0\d+/u.test(identifier))) {
        throw new Error(`Invalid release version: ${versionInput}`);
    }
    return Object.freeze({ version, prerelease });
}

export function validateReleaseTag(versionInput, tagInput) {
    const { version, prerelease } = parseReleaseVersion(versionInput);
    const tag = String(tagInput ?? '');
    if (!VALID_DIST_TAG.test(tag)) throw new Error(`Invalid npm dist-tag: ${tag || '<empty>'}`);

    if (prerelease.length === 0) return Object.freeze({ version, tag, channel: 'stable' });
    if (tag === 'latest') {
        throw new Error(`Prerelease version ${version} cannot use the npm "latest" dist-tag.`);
    }

    const channel = String(prerelease[0]).toLowerCase();
    const permittedTags =
        channel === 'rc'
            ? ['next', 'rc']
            : channel === 'beta'
              ? ['beta']
              : channel === 'alpha'
                ? ['alpha']
                : ['next'];
    if (!permittedTags.includes(tag)) {
        throw new Error(
            `Prerelease channel "${channel}" must use one of: ${permittedTags.join(', ')}.`,
        );
    }
    return Object.freeze({ version, tag, channel });
}

export function verifyPublishedArtifact(artifact, metadata) {
    if (!metadata || typeof metadata !== 'object') {
        throw new Error(`${artifact.name}@${artifact.version} is not available from npm.`);
    }
    if (metadata.name !== artifact.name || metadata.version !== artifact.version) {
        throw new Error(`Published metadata does not match ${artifact.name}@${artifact.version}.`);
    }
    if (metadata.integrity !== artifact.integrity) {
        throw new Error(
            `Published integrity for ${artifact.name}@${artifact.version} does not match the release tarball.`,
        );
    }
}

export async function publishReleaseArtifacts(
    artifacts,
    { inspect, publish, onStatus = () => undefined },
) {
    if (!Array.isArray(artifacts) || artifacts.length !== 2) {
        throw new Error('Exactly two release artifacts are required.');
    }
    const identities = new Set();
    for (const artifact of artifacts) {
        const identity = `${artifact.name}@${artifact.version}`;
        if (identities.has(identity)) throw new Error(`Duplicate release artifact: ${identity}`);
        identities.add(identity);
    }

    const statuses = [];
    for (const artifact of artifacts) {
        try {
            const existing = await inspect(artifact);
            if (existing) {
                verifyPublishedArtifact(artifact, existing);
                const status = Object.freeze({ artifact, status: 'already verified' });
                statuses.push(status);
                onStatus(status);
                continue;
            }

            await publish(artifact);
            const published = await inspect(artifact);
            verifyPublishedArtifact(artifact, published);
            const status = Object.freeze({ artifact, status: 'published' });
            statuses.push(status);
            onStatus(status);
        } catch (error) {
            const status = Object.freeze({ artifact, status: 'failed', error });
            statuses.push(status);
            onStatus(status);
            throw error;
        }
    }

    for (const artifact of artifacts) {
        verifyPublishedArtifact(artifact, await inspect(artifact));
    }
    return Object.freeze(statuses);
}

function sha512Integrity(bytes) {
    return `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
}

async function readArtifactManifest(filePath) {
    const lines = (await readFile(filePath, 'utf8'))
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean);
    return Promise.all(
        lines.map(async (line) => {
            const [tarball, name, version] = line.split('\t');
            if (!tarball || !name || !version || line.split('\t').length !== 3) {
                throw new Error(`Invalid release artifact manifest line: ${line}`);
            }
            const absoluteTarball = path.resolve(path.dirname(filePath), tarball);
            return Object.freeze({
                tarball: absoluteTarball,
                name,
                version,
                integrity: sha512Integrity(await readFile(absoluteTarball)),
            });
        }),
    );
}

function registryNotFound(error) {
    const output = `${error?.stdout ?? ''}\n${error?.stderr ?? ''}`;
    return /\bE404\b|404 Not Found/iu.test(output);
}

async function inspectFromNpm(artifact, registry) {
    try {
        const { stdout } = await execFileAsync(
            'npm',
            [
                'view',
                `${artifact.name}@${artifact.version}`,
                'name',
                'version',
                'dist.integrity',
                '--json',
                '--registry',
                registry,
            ],
            { encoding: 'utf8' },
        );
        const metadata = JSON.parse(stdout);
        return Object.freeze({
            name: metadata.name,
            version: metadata.version,
            integrity: metadata['dist.integrity'] ?? metadata.dist?.integrity,
        });
    } catch (error) {
        if (registryNotFound(error)) return null;
        throw error;
    }
}

async function runCli() {
    const [command, ...args] = process.argv.slice(2);
    if (command === '--check-tag') {
        const [version, tag] = args;
        const policy = validateReleaseTag(version, tag);
        console.log(
            `npm release tag policy: PASS (${policy.version}, ${policy.tag}, ${policy.channel})`,
        );
        return;
    }
    if (command !== '--publish') {
        throw new Error(
            'Usage: publish-release-artifacts.mjs --check-tag <version> <tag> | --publish <manifest> <tag>',
        );
    }

    const [manifestPath, tag] = args;
    if (!manifestPath) throw new Error('A release artifact manifest path is required.');
    const artifacts = await readArtifactManifest(path.resolve(manifestPath));
    const versions = new Set(artifacts.map((artifact) => artifact.version));
    if (versions.size !== 1) throw new Error('Release artifact versions must match.');
    validateReleaseTag(artifacts[0].version, tag);
    const registry = process.env.NPM_CONFIG_REGISTRY || DEFAULT_REGISTRY;
    await publishReleaseArtifacts(artifacts, {
        inspect: (artifact) => inspectFromNpm(artifact, registry),
        publish: async (artifact) => {
            await execFileAsync(
                'npm',
                [
                    'publish',
                    artifact.tarball,
                    '--access',
                    'public',
                    '--tag',
                    tag,
                    '--provenance',
                    '--registry',
                    registry,
                ],
                { encoding: 'utf8' },
            );
        },
        onStatus: ({ artifact, status }) => {
            console.log(`${artifact.name}@${artifact.version}: ${status}`);
        },
    });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    runCli().catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
}
