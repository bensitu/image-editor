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
        getImageEditorConstructor() {
            const candidate =
                window.ImageEditor?.ImageEditor ||
                window.ImageEditor?.default ||
                window.ImageEditor;
            return typeof candidate === 'function' ? candidate : null;
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

    const isGitHubPages = window.location.hostname.endsWith('github.io');
    const fabricSrc = isGitHubPages
        ? 'https://cdn.jsdelivr.net/npm/fabric@7.4.0/dist/index.min.js'
        : '../node_modules/fabric/dist/index.min.js';
    const imageEditorSrc = isGitHubPages
        ? 'https://cdn.jsdelivr.net/npm/@bensitu/image-editor@latest/dist/umd/image-editor.umd.js'
        : '../dist/umd/image-editor.umd.js';

    try {
        await loadScript(fabricSrc);
        await loadScript(imageEditorSrc);
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
