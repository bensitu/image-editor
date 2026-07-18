/** Audits tracked tests and helpers for lasting product responsibilities. */

import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsRoot, '..');

function assertCondition(condition, message) {
    if (!condition) throw new Error(message);
}

const { stdout } = await execFileAsync('git', ['ls-files', '-z'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
});
const tracked = [];
for (const file of stdout.split('\0').filter(Boolean)) {
    const normalized = file.replaceAll('\\', '/');
    try {
        await access(path.join(repositoryRoot, normalized));
        tracked.push(normalized);
    } catch {
        // Files deleted by the current reviewed change are outside the resulting test scope.
    }
}
const tests = tracked.filter((file) => /(?:^|\/)tests\/.*\.test\.mjs$/u.test(`/${file}`));
const helpers = tracked.filter((file) => /^tests\/helpers\/.*\.mjs$/u.test(file));
const searchable = tracked.filter(
    (file) => /\.(?:[cm]?js|ts|tsx|vue)$/u.test(file) && !file.startsWith('dist/'),
);
const sourceByFile = new Map();
for (const file of searchable) {
    sourceByFile.set(file, await readFile(path.join(repositoryRoot, file), 'utf8'));
}

const prohibitedNames = tests.filter((file) =>
    /(?:^|\/)(?:stage[-_ ]?\d+|implementation-report|release-gate|test-runner-config|demo-page)\.test\.mjs$/iu.test(
        file,
    ),
);
assertCondition(
    prohibitedNames.length === 0,
    `Tests with non-product responsibilities remain: ${prohibitedNames.join(', ')}.`,
);

const prohibitedSubjects = [];
for (const file of tests) {
    const source = sourceByFile.get(file) ?? '';
    if (
        /(?:scripts\/release-gate\.mjs|\.internal\/implementation|allowed-release-ref|git\s+branch|integrated-editor\.html|playwright\.config|eslint\.config|prettier\.config)/iu.test(
            source,
        )
    ) {
        prohibitedSubjects.push(file);
    }
}
assertCondition(
    prohibitedSubjects.length === 0,
    `Tests exercise configuration, branch, private evidence, or Demo concerns: ${prohibitedSubjects.join(', ')}.`,
);

const unusedHelpers = helpers.filter((helper) => {
    const relativeFromTests = helper.slice('tests/'.length);
    const basename = path.posix.basename(helper);
    return ![...sourceByFile.entries()].some(
        ([file, source]) =>
            file !== helper && (source.includes(relativeFromTests) || source.includes(basename)),
    );
});
assertCondition(
    unusedHelpers.length === 0,
    `Tracked test helpers have no consumer: ${unusedHelpers.join(', ')}.`,
);

console.log(
    `Tracked test scope passed (${tests.length} product tests, ${helpers.length} shared helpers, 0 prohibited subjects).`,
);
