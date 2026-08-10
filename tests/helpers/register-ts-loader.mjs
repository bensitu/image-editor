import * as moduleApi from 'node:module';

// Keep the TypeScript hook in Node's isolated loader context. Synchronous hooks
// share the application module graph and can interfere with CJS dependencies
// that bridge into ESM through vm modules.
const register = Reflect.get(moduleApi, 'register');
if (typeof register !== 'function') {
    throw new Error('This Node.js release cannot register the TypeScript test loader.');
}
Reflect.apply(register, moduleApi, ['./ts-resolve-hook.mjs', import.meta.url]);
