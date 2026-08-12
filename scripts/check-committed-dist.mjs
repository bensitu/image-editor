/**
 * Builds and verifies that the tracked distribution exactly matches current source output.
 *
 * @module
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { formatCommittedDistReport, inspectCommittedDist } from './committed-dist-policy.mjs';

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsRoot, '..');
const npmCliPath = process.env.npm_execpath;
const argumentsList = process.argv.slice(2);
const skipBuild = argumentsList.length === 1 && argumentsList[0] === '--skip-build';

if (argumentsList.length > (skipBuild ? 1 : 0)) {
    throw new Error('Usage: check-committed-dist.mjs [--skip-build]');
}

function runBuild(scriptName) {
    if (!npmCliPath) {
        throw new Error('npm_execpath is unavailable; run through an npm script.');
    }
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [npmCliPath, 'run', scriptName], {
            cwd: repositoryRoot,
            stdio: 'inherit',
            windowsHide: true,
        });
        child.on('error', reject);
        child.on('close', (code, signal) => {
            if (signal) reject(new Error(`${scriptName} terminated by ${signal}.`));
            else if (code === 0) resolve();
            else reject(new Error(`${scriptName} exited with code ${code}.`));
        });
    });
}

if (!skipBuild) {
    await runBuild('build');
    await runBuild('build:codemod');
}
const report = await inspectCommittedDist(repositoryRoot);
const message = formatCommittedDistReport(report);
if (!report.passed) throw new Error(message);
console.log(message);
