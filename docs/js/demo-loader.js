(async function () {
    'use strict';

    const loaderScript = document.currentScript;
    const entryScript = loaderScript?.dataset.demoEntry || 'js/demo-pages.js';
    const errorTarget = loaderScript?.dataset.errorTarget || 'demoMessage';

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.body.appendChild(script);
        });
    }

    window.__imageEditorDemoRuntime = {
        createEditor(coreOptions, pluginPlan) {
            const api = window.ImageEditorFull;
            if (
                typeof api?.ImageEditorCore !== 'function' ||
                typeof api?.composePlugins !== 'function' ||
                !window.fabric
            ) {
                throw new Error('The ImageEditor v3 modular runtime is unavailable.');
            }
            const editor = new api.ImageEditorCore(window.fabric, coreOptions);
            const plugins = editor.install(api.composePlugins(pluginPlan));
            return Object.freeze({ editor, ...plugins });
        },
        createCanvas(width, height) {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Canvas 2D context is unavailable.');
            return { canvas, context };
        },
        drawPanel(context, x, y, width, height, color, options = {}) {
            context.save();
            context.fillStyle = color;
            context.strokeStyle = options.stroke || '#cbd5e1';
            context.lineWidth = options.lineWidth || 2;
            context.beginPath();
            context.roundRect(x, y, width, height, options.radius || 14);
            context.fill();
            context.stroke();
            context.restore();
        },
    };

    const loaderPath = loaderScript ? new URL(loaderScript.src, window.location.href).pathname : '';
    const usesRepositoryLayout = /\/docs\/js\/[^/]+$/.test(loaderPath);
    const fabricSrc = usesRepositoryLayout
        ? '../node_modules/fabric/dist/index.min.js'
        : 'https://cdn.jsdelivr.net/npm/fabric@7.4.0/dist/index.min.js';
    const imageEditorSrc = usesRepositoryLayout
        ? '../dist/umd/image-editor.full.umd.min.js'
        : 'https://cdn.jsdelivr.net/npm/@bensitu/image-editor@latest/dist/umd/image-editor.full.umd.min.js';

    try {
        await loadScript(fabricSrc);
        await loadScript(imageEditorSrc);
        if (
            !window.fabric ||
            typeof window.ImageEditorFull?.ImageEditorCore !== 'function' ||
            typeof window.ImageEditorFull?.composePlugins !== 'function'
        ) {
            throw new Error(
                'The ImageEditor v3 browser runtime did not expose its expected globals.',
            );
        }
        await loadScript(entryScript);
    } catch (error) {
        const message = document.getElementById(errorTarget);
        if (message) {
            message.textContent = error instanceof Error ? error.message : String(error);
            message.dataset.tone = 'error';
        }
        console.error('[ImageEditor demo] Failed to load dependencies.', error);
    }
})();
