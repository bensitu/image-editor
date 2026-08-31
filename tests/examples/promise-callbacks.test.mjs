/**
 * Verifies that framework event callbacks consume asynchronous rejections.
 *
 * @module
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const cases = [
    ['React file input', 'react-basic/src/App.tsx', 'onChange', 'handleFileChange'],
    [
        'Next.js file input',
        'next-client-only/app/ImageEditorClient.tsx',
        'onChange',
        'handleFileChange',
    ],
    ['React export button', 'react-basic/src/App.tsx', 'onClick', 'run'],
];

function callsOperation(node, operation) {
    if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === operation
    ) {
        return true;
    }
    return ts.forEachChild(node, (child) => callsOperation(child, operation)) === true;
}

function readCallback(file, attribute, operation) {
    const source = readFileSync(new URL(`../../examples/${file}`, import.meta.url), 'utf8');
    const sourceFile = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
    );
    const callbacks = [];
    function visit(node) {
        if (
            ts.isJsxAttribute(node) &&
            node.name.getText(sourceFile) === attribute &&
            node.initializer &&
            ts.isJsxExpression(node.initializer) &&
            node.initializer.expression &&
            ts.isArrowFunction(node.initializer.expression) &&
            callsOperation(node.initializer.expression, operation)
        ) {
            callbacks.push(node.initializer.expression);
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    assert.equal(callbacks.length, 1, `Expected one ${attribute} callback for ${operation}.`);
    return ts.transpileModule(`(${callbacks[0].getText(sourceFile)})`, {
        compilerOptions: { target: ts.ScriptTarget.ESNext },
    }).outputText;
}

for (const [label, file, attribute, operation] of cases) {
    for (const rejects of [false, true]) {
        test(`${label} returns void and handles ${rejects ? 'rejection' : 'success'}`, async () => {
            const pending = Promise.withResolvers();
            const failure = new Error('The editor operation failed.');
            const reported = [];
            const calls = [];
            const event = { currentTarget: {} };
            const exportPng = () => {};
            const callback = runInNewContext(readCallback(file, attribute, operation), {
                [operation](argument) {
                    calls.push(argument);
                    return pending.promise;
                },
                exportPng,
                console: { error: (error) => reported.push(error) },
            });

            // Keep a broken callback from leaking a rejection into other tests.
            pending.promise.catch(() => {});
            assert.equal(callback(event), undefined);
            assert.deepEqual(calls, [operation === 'run' ? exportPng : event]);
            if (rejects) pending.reject(failure);
            else pending.resolve();
            await new Promise((resolve) => setImmediate(resolve));
            assert.deepEqual(reported, rejects ? [failure] : []);
        });
    }
}
