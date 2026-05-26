// ESM resolve hook that allows `import { X } from '../foo.js'` to resolve
// to `../foo.ts` when the `.ts` file exists and the `.js` does not. This
// mirrors TypeScript's source-relative resolution under the published
// `"moduleResolution": "bundler"` setting and lets property tests run
// against `.ts` source directly under Node's native type-stripping (Node
// 24+) without invoking the build pipeline.
//
// The hook is intentionally narrow:
//   - Only relative specifiers (starting with `.`) are remapped.
//   - Only `.js` suffixes are rewritten; bare specifiers and `.json` /
//     `.node` resolutions are forwarded unchanged.
//   - When the sibling `.ts` does not exist, the original `.js` request
//     is forwarded so genuine "not found" errors keep their original
//     message.

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function resolve(specifier, context, nextResolve) {
    if (
        (specifier.startsWith('./') || specifier.startsWith('../')) &&
        specifier.endsWith('.js')
    ) {
        const parentURL = context.parentURL;
        if (parentURL) {
            const tsURL = new URL(
                specifier.replace(/\.js$/, '.ts'),
                parentURL,
            );
            try {
                if (existsSync(fileURLToPath(tsURL))) {
                    return nextResolve(
                        specifier.replace(/\.js$/, '.ts'),
                        context,
                    );
                }
            } catch {
                // fall through to the default resolver
            }
        }
    }
    return nextResolve(specifier, context);
}
