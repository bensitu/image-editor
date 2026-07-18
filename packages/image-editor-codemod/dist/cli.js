#!/usr/bin/env node
/**
 * Parses the public command-line contract and delegates source changes to the codemod runner.
 *
 * @module
 */
import { runCodemod, writeCodemodReport } from './index.js';
const USAGE = `Usage:
  image-editor-codemod v2-to-v3 <path...> [--write | --dry-run | --diff] [--report <file>]

Modes:
  --write     Apply safe transformations atomically (default).
  --dry-run   Report changes without writing source files.
  --diff      Print a source diff without writing source files.
`;
function parseArguments(args) {
    if (args.includes('--help') || args.includes('-h'))
        return null;
    if (args[0] !== 'v2-to-v3')
        throw new Error('The required command is "v2-to-v3".');
    const targets = [];
    let mode = 'write';
    let selectedMode = false;
    let reportPath;
    for (let index = 1; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === '--write' || argument === '--dry-run' || argument === '--diff') {
            if (selectedMode)
                throw new Error('Select exactly one codemod mode.');
            mode = argument.slice(2);
            selectedMode = true;
            continue;
        }
        if (argument === '--report') {
            const value = args[index + 1];
            if (!value || value.startsWith('--'))
                throw new Error('--report requires a file path.');
            reportPath = value;
            index += 1;
            continue;
        }
        if (argument.startsWith('-'))
            throw new Error(`Unknown option: ${argument}`);
        targets.push(argument);
    }
    if (targets.length === 0)
        throw new Error('At least one source path is required.');
    return Object.freeze({
        targets: Object.freeze(targets),
        mode,
        ...(reportPath ? { reportPath } : {}),
    });
}
async function main() {
    const options = parseArguments(process.argv.slice(2));
    if (!options) {
        process.stdout.write(USAGE);
        return;
    }
    const report = await runCodemod(options.targets, { mode: options.mode });
    if (options.mode === 'diff') {
        for (const file of report.files) {
            if (file.diff)
                process.stdout.write(file.diff);
        }
    }
    if (options.reportPath)
        await writeCodemodReport(options.reportPath, report);
    process.stdout.write(`${JSON.stringify({
        result: report.result,
        mode: report.mode,
        filesScanned: report.filesScanned,
        filesChanged: report.filesChanged,
        filesWritten: report.filesWritten,
        unresolvedCount: report.unresolvedCount,
    }, null, 2)}\n`);
    for (const unresolved of report.files.flatMap((file) => file.unresolved)) {
        process.stderr.write(`${unresolved.file}:${unresolved.line}:${unresolved.column} ${unresolved.code} ${unresolved.message}\n`);
    }
    if (report.unresolvedCount > 0)
        process.exitCode = 2;
    else if (options.mode !== 'write' && report.filesChanged > 0)
        process.exitCode = 1;
}
main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
    process.exitCode = 64;
});
//# sourceMappingURL=cli.js.map