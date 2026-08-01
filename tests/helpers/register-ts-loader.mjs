import * as moduleApi from 'node:module';

import { load, resolve } from './ts-resolve-hook.mjs';

if (typeof moduleApi.registerHooks === 'function') {
    moduleApi.registerHooks({ load, resolve });
} else {
    // Node 20 and early Node 22 releases predate registerHooks(). Keep the
    // compatibility path isolated so supported newer runtimes never invoke
    // the deprecated asynchronous registration API.
    const legacyRegister = Reflect.get(moduleApi, 'register');
    if (typeof legacyRegister !== 'function') {
        throw new Error('This Node.js release cannot register the TypeScript test loader.');
    }
    Reflect.apply(legacyRegister, moduleApi, ['./ts-resolve-hook.mjs', import.meta.url]);
}
