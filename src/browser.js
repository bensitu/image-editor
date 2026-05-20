import ImageEditor, { setFabric } from './image-editor.js';

const scope = typeof globalThis !== 'undefined'
    ? globalThis
    : (typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null));

setFabric(scope && scope.fabric);

if (scope) {
    scope.ImageEditor = ImageEditor;
}
