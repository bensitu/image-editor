/**
 * Detects untrusted workflow-dispatch expressions embedded directly in shell source.
 *
 * @module
 */

const WORKFLOW_INPUT_EXPRESSION_PATTERN = /\$\{\{\s*(?:github\.event\.)?inputs\.[^}]+\}\}/gu;
const RUN_KEY_PATTERN = /^(?<indent>\s*)(?:-\s+)?run:\s*(?<value>.*)$/u;
const BLOCK_SCALAR_PATTERN = /^[>|][+-]?(?:\s+#.*)?$/u;

function leadingWhitespaceLength(line) {
    return /^\s*/u.exec(line)?.[0].length ?? 0;
}

function collectExpressions(line, lineNumber, diagnostics) {
    for (const match of line.matchAll(WORKFLOW_INPUT_EXPRESSION_PATTERN)) {
        diagnostics.push(
            Object.freeze({
                line: lineNumber,
                column: (match.index ?? 0) + 1,
                expression: match[0],
            }),
        );
    }
}

export function findUnsafeWorkflowRunInputs(source) {
    const diagnostics = [];
    const lines = source.split(/\r?\n/u);
    let runBlockIndent = null;

    for (const [index, line] of lines.entries()) {
        const lineNumber = index + 1;
        if (runBlockIndent !== null) {
            if (line.trim().length > 0 && leadingWhitespaceLength(line) <= runBlockIndent) {
                runBlockIndent = null;
            } else {
                collectExpressions(line, lineNumber, diagnostics);
                continue;
            }
        }

        const runMatch = RUN_KEY_PATTERN.exec(line);
        if (!runMatch) continue;
        const value = runMatch.groups?.value ?? '';
        if (BLOCK_SCALAR_PATTERN.test(value.trim())) {
            runBlockIndent = runMatch.groups?.indent.length ?? 0;
        } else {
            collectExpressions(value, lineNumber, diagnostics);
        }
    }

    return Object.freeze(diagnostics);
}
