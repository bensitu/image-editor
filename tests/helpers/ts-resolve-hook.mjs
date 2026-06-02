// ESM hook that lets property tests run against `.ts` source directly
// without invoking the build pipeline. It handles two cases:
//   - `import { X } from '../foo.js'` resolves to `../foo.ts` when the
//     source file exists and the built `.js` sibling does not.
//   - `.ts` modules are transpiled on load for Node versions that do not
//     natively strip TypeScript syntax.
//
// This mirrors TypeScript's source-relative resolution under the published
// `"moduleResolution": "bundler"` setting.
//
// The hook is intentionally narrow:
//   - Only relative specifiers (starting with `.`) are remapped.
//   - Only `.js` suffixes are rewritten; bare specifiers and `.json` /
//     `.node` resolutions are forwarded unchanged.
//   - When the sibling `.ts` does not exist, the original `.js` request
//     is forwarded so genuine "not found" errors keep their original
//     message.

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const compilerOptions = {
    target: ts.ScriptTarget.ES2019,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    esModuleInterop: true,
    isolatedModules: true,
    sourceMap: false,
    importHelpers: false,
    removeComments: false,
};

export function resolve(specifier, context, nextResolve) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && specifier.endsWith('.js')) {
        const parentURL = context.parentURL;
        if (parentURL) {
            const tsURL = new URL(specifier.replace(/\.js$/, '.ts'), parentURL);
            try {
                if (existsSync(fileURLToPath(tsURL))) {
                    return nextResolve(specifier.replace(/\.js$/, '.ts'), context);
                }
            } catch {
                // fall through to the default resolver
            }
        }
    }
    return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
    if (url.startsWith('file:') && url.endsWith('.ts')) {
        const fileName = fileURLToPath(url);
        const source = await readFile(fileName, 'utf8');
        const output = ts.transpileModule(source, {
            compilerOptions,
            fileName,
        });

        return {
            format: 'module',
            shortCircuit: true,
            source: output.outputText,
        };
    }

    return nextLoad(url, context);
}
