/**
 * Enforces product-domain language in production, test, and example source.
 *
 * The checker is read-only. Every exception is exact, path-scoped, counted,
 * and documented in tests/source-language/exceptions.json.
 *
 * @module
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsDirectory, '..');
const exceptionPath = path.join(repositoryRoot, 'tests', 'source-language', 'exceptions.json');
const sourceExtensions = new Set(['.cjs', '.js', '.jsx', '.mjs', '.ts', '.tsx', '.vue']);
const ignoredDirectories = new Set([
    '.next',
    'coverage',
    'dist',
    'node_modules',
    'playwright-report',
    'test-results',
]);
const scopeRoots = Object.freeze([
    { name: 'production', root: 'src' },
    { name: 'production', root: 'packages' },
    { name: 'test', root: 'tests' },
    { name: 'example', root: 'examples' },
]);

const versionOrHistoryPattern = /\b(?:legacy|compatibility|compat|v\d+(?:\.\d+)*)\b/giu;
const comparisonPatterns = [
    /\b(?:old|new|next generation|previous generation)\b.{0,80}\b(?:architecture|implementation|path|repository|runtime|version)\b/giu,
    /\b(?:architecture|implementation|path|repository|runtime|version)\b.{0,80}\b(?:old|new|next generation|previous generation)\b/giu,
];

function toRepositoryPath(filePath) {
    return path.relative(repositoryRoot, filePath).replaceAll('\\', '/');
}

async function collectSourceFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory() && !ignoredDirectories.has(entry.name)) {
            files.push(...(await collectSourceFiles(absolutePath)));
        } else if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) {
            files.push(absolutePath);
        }
    }
    return files;
}

function identifierWords(identifier) {
    return identifier
        .replace(/([a-z\d])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .split(/[^A-Za-z0-9.]+/u)
        .filter(Boolean);
}

function lineNumberAt(sourceText, position) {
    let line = 1;
    for (let index = 0; index < position; index += 1) {
        if (sourceText.charCodeAt(index) === 10) line += 1;
    }
    return line;
}

function matchesFrom(pattern, value) {
    pattern.lastIndex = 0;
    return [...value.matchAll(pattern)];
}

function classifyToken(token) {
    if (
        token === ts.SyntaxKind.SingleLineCommentTrivia ||
        token === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
        return 'comment';
    }
    if (token === ts.SyntaxKind.Identifier) return 'identifier';
    if (
        token === ts.SyntaxKind.StringLiteral ||
        token === ts.SyntaxKind.NoSubstitutionTemplateLiteral ||
        token === ts.SyntaxKind.TemplateHead ||
        token === ts.SyntaxKind.TemplateMiddle ||
        token === ts.SyntaxKind.TemplateTail ||
        token === ts.SyntaxKind.RegularExpressionLiteral
    ) {
        return 'literal';
    }
    return null;
}

function inspectToken({ file, scope, sourceText, token, text, position }) {
    const kind = classifyToken(token);
    if (!kind) return [];
    const inspectedText = kind === 'identifier' ? identifierWords(text).join(' ') : text;
    const findings = matchesFrom(versionOrHistoryPattern, inspectedText).map((match) => ({
        file,
        scope,
        kind,
        term: match[0].toLowerCase(),
        text,
        line: lineNumberAt(sourceText, position),
        rule: kind === 'identifier' ? 'VERSION_OR_HISTORY_IDENTIFIER' : 'VERSION_OR_HISTORY_TEXT',
    }));
    if (kind === 'comment') {
        for (const pattern of comparisonPatterns) {
            for (const match of matchesFrom(pattern, inspectedText)) {
                findings.push({
                    file,
                    scope,
                    kind,
                    term: match[0].toLowerCase(),
                    text,
                    line: lineNumberAt(sourceText, position),
                    rule: 'HISTORICAL_COMPARISON_COMMENT',
                });
            }
        }
    }
    return findings;
}

function inspectFile(filePath, scope, sourceText) {
    const file = toRepositoryPath(filePath);
    const scanner = ts.createScanner(
        ts.ScriptTarget.Latest,
        false,
        ts.LanguageVariant.JSX,
        sourceText,
    );
    const findings = [];
    const templateBraceDepths = [];
    let token = scanner.scan();
    while (token !== ts.SyntaxKind.EndOfFileToken) {
        findings.push(
            ...inspectToken({
                file,
                scope,
                sourceText,
                token,
                text: scanner.getTokenText(),
                position: scanner.getTokenPos(),
            }),
        );
        if (token === ts.SyntaxKind.TemplateHead) {
            templateBraceDepths.push(0);
        } else if (templateBraceDepths.length > 0 && token === ts.SyntaxKind.OpenBraceToken) {
            templateBraceDepths[templateBraceDepths.length - 1] += 1;
        } else if (templateBraceDepths.length > 0 && token === ts.SyntaxKind.CloseBraceToken) {
            const index = templateBraceDepths.length - 1;
            if (templateBraceDepths[index] > 0) {
                templateBraceDepths[index] -= 1;
            } else {
                token = scanner.reScanTemplateToken(false);
                findings.push(
                    ...inspectToken({
                        file,
                        scope,
                        sourceText,
                        token,
                        text: scanner.getTokenText(),
                        position: scanner.getTokenPos(),
                    }),
                );
                if (token === ts.SyntaxKind.TemplateTail) templateBraceDepths.pop();
            }
        }
        token = scanner.scan();
    }
    return findings;
}

function matchException(finding, exceptions) {
    return exceptions.find(
        (exception) =>
            exception.path === finding.file &&
            exception.kind === finding.kind &&
            exception.term.toLowerCase() === finding.term &&
            new RegExp(exception.sourcePattern, 'u').test(finding.text),
    );
}

function validateExceptions(exceptions) {
    const errors = [];
    const ids = new Set();
    for (const exception of exceptions) {
        if (ids.has(exception.id)) errors.push(`Duplicate exception ID: ${exception.id}`);
        ids.add(exception.id);
        if (!exception.path || path.isAbsolute(exception.path)) {
            errors.push(`${exception.id}: path must be repository-relative.`);
        }
        if (!['comment', 'identifier', 'literal'].includes(exception.kind)) {
            errors.push(`${exception.id}: unsupported kind ${String(exception.kind)}.`);
        }
        if (!exception.reason || !exception.category) {
            errors.push(`${exception.id}: category and reason are required.`);
        }
        if (
            !Number.isInteger(exception.minimumHits) ||
            !Number.isInteger(exception.maximumHits) ||
            exception.minimumHits < 0 ||
            exception.maximumHits < exception.minimumHits
        ) {
            errors.push(`${exception.id}: invalid hit bounds.`);
        }
        try {
            new RegExp(exception.sourcePattern, 'u');
        } catch (error) {
            errors.push(`${exception.id}: invalid sourcePattern (${error.message}).`);
        }
    }
    return errors;
}

async function main() {
    const exceptionDocument = JSON.parse(await readFile(exceptionPath, 'utf8'));
    if (exceptionDocument.schemaVersion !== 1 || !Array.isArray(exceptionDocument.exceptions)) {
        throw new Error('Source-language exception schema is invalid.');
    }
    const exceptions = exceptionDocument.exceptions;
    const configurationErrors = validateExceptions(exceptions);
    if (configurationErrors.length > 0) {
        throw new Error(configurationErrors.join('\n'));
    }

    const filesByScope = new Map();
    const findings = [];
    for (const scope of scopeRoots) {
        const files = await collectSourceFiles(path.join(repositoryRoot, scope.root));
        filesByScope.set(scope.name, (filesByScope.get(scope.name) ?? 0) + files.length);
        for (const filePath of files) {
            findings.push(...inspectFile(filePath, scope.name, await readFile(filePath, 'utf8')));
        }
    }

    const hitCounts = new Map(exceptions.map((exception) => [exception.id, 0]));
    const violations = [];
    for (const finding of findings) {
        const exception = matchException(finding, exceptions);
        if (!exception) {
            violations.push(finding);
            continue;
        }
        hitCounts.set(exception.id, hitCounts.get(exception.id) + 1);
    }

    for (const exception of exceptions) {
        const hits = hitCounts.get(exception.id);
        if (hits < exception.minimumHits || hits > exception.maximumHits) {
            violations.push({
                file: exception.path,
                scope: 'configuration',
                kind: exception.kind,
                line: 0,
                term: exception.term,
                rule: 'EXCEPTION_HIT_COUNT',
                text: `${exception.id}: expected ${exception.minimumHits}-${exception.maximumHits} hit(s), received ${hits}`,
            });
        }
    }

    const identifierViolations = violations.filter((finding) => finding.kind === 'identifier');
    const productionCommentViolations = violations.filter(
        (finding) => finding.scope === 'production' && finding.kind === 'comment',
    );
    const testExampleIdentifierViolations = identifierViolations.filter(
        (finding) => finding.scope === 'test' || finding.scope === 'example',
    );
    const reviewedExceptionHits = [...hitCounts.values()].reduce((sum, count) => sum + count, 0);

    console.log('Source-language check');
    console.log(`production files scanned: ${filesByScope.get('production')}`);
    console.log(`test files scanned: ${filesByScope.get('test')}`);
    console.log(`example files scanned: ${filesByScope.get('example')}`);
    console.log(`reviewed exception hits: ${reviewedExceptionHits}`);
    console.log(
        `active production source version-labelled identifiers: ${identifierViolations.filter((finding) => finding.scope === 'production').length}`,
    );
    console.log(
        `active production comments containing version comparison language: ${productionCommentViolations.length}`,
    );
    console.log(
        `active test/example identifiers containing version labels: ${testExampleIdentifierViolations.length}`,
    );
    console.log(`unreviewed exceptions: ${violations.length}`);

    if (violations.length > 0) {
        for (const finding of violations) {
            console.error(
                `${finding.file}:${finding.line} [${finding.rule}] ${finding.term}: ${finding.text.replace(/\s+/gu, ' ').slice(0, 180)}`,
            );
        }
        process.exitCode = 1;
    }
}

await main();
