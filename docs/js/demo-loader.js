(async function () {
    'use strict';

    const loaderScript = document.currentScript;
    const entryScript = loaderScript?.dataset.demoEntry || 'js/demo-pages.js';
    const errorTarget = loaderScript?.dataset.errorTarget || 'demoMessage';
    const pluginDefinitions = Object.freeze({
        overlay: Object.freeze({ globalName: 'Overlay', dependencies: [] }),
        annotation: Object.freeze({
            globalName: 'Annotation',
            dependencies: ['overlay'],
        }),
        transform: Object.freeze({ globalName: 'Transform', dependencies: [] }),
        history: Object.freeze({ globalName: 'History', dependencies: [] }),
        mask: Object.freeze({ globalName: 'Mask', dependencies: ['overlay'] }),
        filters: Object.freeze({ globalName: 'Filters', dependencies: [] }),
        crop: Object.freeze({ globalName: 'Crop', dependencies: ['overlay'] }),
        mosaic: Object.freeze({ globalName: 'Mosaic', dependencies: [] }),
        'annotation-text': Object.freeze({
            globalName: 'AnnotationText',
            dependencies: ['overlay', 'annotation'],
        }),
        'annotation-shape': Object.freeze({
            globalName: 'AnnotationShape',
            dependencies: ['overlay', 'annotation'],
        }),
        'annotation-draw': Object.freeze({
            globalName: 'AnnotationDraw',
            dependencies: ['overlay', 'annotation'],
        }),
        'overlay-state': Object.freeze({
            globalName: 'OverlayState',
            dependencies: ['overlay'],
        }),
        'dom-controls': Object.freeze({ globalName: 'DomControls', dependencies: [] }),
    });
    const emptyPluginNamespace = Object.freeze({});

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.body.appendChild(script);
        });
    }

    function readPluginPlan() {
        const pluginIds = (loaderScript?.dataset.demoPlugins || '')
            .trim()
            .split(/\s+/u)
            .filter(Boolean);
        const loaded = new Set();

        for (const pluginId of pluginIds) {
            const definition = pluginDefinitions[pluginId];
            if (!definition) {
                throw new Error(`Unknown ImageEditor demo Plugin "${pluginId}".`);
            }
            if (loaded.has(pluginId)) {
                throw new Error(`ImageEditor demo Plugin "${pluginId}" is listed more than once.`);
            }
            const missingDependencies = definition.dependencies.filter(
                (dependency) => !loaded.has(dependency),
            );
            if (missingDependencies.length > 0) {
                throw new Error(
                    `ImageEditor demo Plugin "${pluginId}" must load after ${missingDependencies.join(
                        ', ',
                    )}.`,
                );
            }
            loaded.add(pluginId);
        }

        return Object.freeze(pluginIds);
    }

    const pluginIds = readPluginPlan();

    window.__imageEditorDemoRuntime = Object.freeze({
        get core() {
            return window.ImageEditor;
        },
        get plugins() {
            return window.ImageEditorPlugins || emptyPluginNamespace;
        },
        pluginIds,
        createEditor(coreOptions, pluginPlan) {
            const api = window.ImageEditor;
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
    });

    const loaderPath = loaderScript ? new URL(loaderScript.src, window.location.href).pathname : '';
    const usesRepositoryLayout = /\/docs\/js\/[^/]+$/.test(loaderPath);
    const fabricSrc = usesRepositoryLayout
        ? '../node_modules/fabric/dist/index.min.js'
        : 'https://cdn.jsdelivr.net/npm/fabric@7.4.0/dist/index.min.js';
    const imageEditorBase = usesRepositoryLayout
        ? '../dist/umd'
        : 'https://cdn.jsdelivr.net/npm/@bensitu/image-editor@latest/dist/umd';

    try {
        await loadScript(fabricSrc);
        await loadScript(`${imageEditorBase}/image-editor.core.umd.min.js`);
        if (
            !window.fabric ||
            typeof window.ImageEditor?.ImageEditorCore !== 'function' ||
            typeof window.ImageEditor?.composePlugins !== 'function'
        ) {
            throw new Error('The ImageEditor v3 Core UMD did not expose its expected global.');
        }

        for (const pluginId of pluginIds) {
            await loadScript(
                `${imageEditorBase}/plugins/image-editor.plugin.${pluginId}.umd.min.js`,
            );
            const globalName = pluginDefinitions[pluginId].globalName;
            if (!window.ImageEditorPlugins?.[globalName]) {
                throw new Error(
                    `The ImageEditor v3 Plugin UMD "${pluginId}" did not expose ImageEditorPlugins.${globalName}.`,
                );
            }
        }

        await loadScript(entryScript);
    } catch (error) {
        document.body.dataset.demoError = 'true';
        const message = document.getElementById(errorTarget);
        if (message) {
            message.textContent = error instanceof Error ? error.message : String(error);
            message.dataset.tone = 'error';
        }
        console.error('[ImageEditor demo] Failed to load dependencies.', error);
    }
})();
