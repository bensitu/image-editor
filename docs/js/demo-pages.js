(function () {
    'use strict';

    const pageName = document.body.dataset.demoPage || 'basic';
    const isIntegratedEditorPage = pageName === 'integrated-editor';
    const demoRuntime = window.__imageEditorDemoRuntime;
    const annotationKinds = ['annotation:text', 'annotation:shape', 'annotation:draw'];
    const maskShapeBase = {
        color: 'rgba(15, 23, 42, 0.82)',
        alpha: 0.82,
        styles: {
            stroke: '#ffffff',
            strokeWidth: 1,
        },
    };
    const maskShapeConfigs = {
        rect: { shape: 'rect', left: '18%', top: '28%', width: '28%', height: '14%' },
        circle: { shape: 'circle', left: '54%', top: '22%', radius: 48 },
        ellipse: { shape: 'ellipse', left: '58%', top: '52%', width: '22%', height: '16%' },
        polygon: {
            shape: 'polygon',
            points: [
                [610, 155],
                [820, 190],
                [792, 280],
                [640, 268],
            ],
        },
    };
    const privacySampleSize = { width: 960, height: 620 };
    const privacyMaskPresets = {
        identity: {
            shape: 'rect',
            left: fromPrivacySample(146),
            top: fromPrivacySample(266),
            width: fromPrivacySample(300),
            height: fromPrivacySample(92),
            color: 'rgba(15, 23, 42, 0.86)',
            alpha: 0.86,
        },
        address: {
            shape: 'rect',
            left: fromPrivacySample(146),
            top: fromPrivacySample(382),
            width: fromPrivacySample(390),
            height: fromPrivacySample(38),
            color: 'rgba(15, 23, 42, 0.86)',
            alpha: 0.86,
        },
        portrait: {
            shape: 'ellipse',
            left: fromPrivacySample(676),
            top: fromPrivacySample(210),
            width: fromPrivacySample(140),
            height: fromPrivacySample(190),
            color: 'rgba(15, 23, 42, 0.78)',
            alpha: 0.78,
        },
    };
    const imageFilterControlIds = [
        'imageBrightnessInput',
        'imageContrastInput',
        'imageSaturationInput',
        'imageBlurInput',
        'imageSharpenInput',
        'imageGrayscaleInput',
        'imageSepiaInput',
        'imageVintageInput',
        'applyImageFiltersButton',
        'resetImageFiltersButton',
        'clearImageFiltersButton',
    ];
    const demoState = {
        kit: null,
        cleanups: [],
        isBusy: false,
        lastOperation: null,
        filterPreviewSequence: 0,
        pointer: {
            active: false,
            start: null,
            queue: Promise.resolve(),
        },
        bindingOptions: {
            masksFollowTransform: false,
            annotationsFollowTransform: false,
        },
    };

    function getOptionalElement(id) {
        return document.getElementById(id);
    }

    function getRequiredElement(id) {
        const element = getOptionalElement(id);
        if (!element) throw new Error(`Missing demo element #${id}.`);
        return element;
    }

    function fromPrivacySample(value) {
        return (canvas) =>
            value *
            Math.min(
                canvas.getWidth() / privacySampleSize.width,
                canvas.getHeight() / privacySampleSize.height,
                1,
            );
    }

    function setText(id, value) {
        const element = getOptionalElement(id);
        if (element) element.textContent = value;
    }

    function setDisabled(id, disabled) {
        const element = getOptionalElement(id);
        if ('disabled' in (element || {})) element.disabled = disabled;
    }

    function setControlValue(id, value) {
        const element = getOptionalElement(id);
        if ('value' in (element || {})) element.value = String(value);
    }

    function setControlChecked(id, checked) {
        const element = getOptionalElement(id);
        if ('checked' in (element || {})) element.checked = !!checked;
    }

    function setControlPressed(id, pressed) {
        getOptionalElement(id)?.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    }

    function readNumberControl(id, fallback) {
        const value = Number(getOptionalElement(id)?.value);
        return Number.isFinite(value) ? value : fallback;
    }

    function showMessage(message, tone) {
        const element = getOptionalElement('demoMessage');
        if (!element) return;
        element.textContent = message instanceof Error ? message.message : String(message);
        element.dataset.tone = tone || 'neutral';
    }

    function clearMessage() {
        const element = getOptionalElement('demoMessage');
        if (!element) return;
        element.textContent = '';
        element.dataset.tone = 'neutral';
    }

    function recordOperation(operation) {
        demoState.lastOperation = operation || null;
        setText('statusLastOperation', demoState.lastOperation || 'None');
    }

    function getKit() {
        return demoState.kit;
    }

    function getEditor() {
        return getKit()?.editor || null;
    }

    function trackCleanup(disposable) {
        if (!disposable) return;
        if (typeof disposable === 'function') {
            demoState.cleanups.push(disposable);
            return;
        }
        if (typeof disposable.dispose === 'function') {
            demoState.cleanups.push(() => disposable.dispose());
        }
    }

    function releaseCleanups() {
        for (const cleanup of demoState.cleanups.splice(0).reverse()) {
            try {
                cleanup();
            } catch (error) {
                console.warn('[ImageEditor demo] Cleanup failed.', error);
            }
        }
    }

    function readBindingOptionsFromControls() {
        return {
            masksFollowTransform:
                isIntegratedEditorPage &&
                getOptionalElement('maskTransformBindingInput')?.checked === true,
            annotationsFollowTransform:
                isIntegratedEditorPage &&
                getOptionalElement('annotationTransformBindingInput')?.checked === true,
        };
    }

    function syncBindingControls(options) {
        setControlChecked('maskTransformBindingInput', options.masksFollowTransform);
        setControlChecked('annotationTransformBindingInput', options.annotationsFollowTransform);
    }

    function haveSameBindingOptions(left, right) {
        return (
            left.masksFollowTransform === right.masksFollowTransform &&
            left.annotationsFollowTransform === right.annotationsFollowTransform
        );
    }

    function createEditorOptions(bindingOptions) {
        return {
            core: {
                backgroundColor: 'transparent',
                canvasWidth: 960,
                canvasHeight: 620,
                defaultLayoutMode: 'fit',
                onError(error, message) {
                    showMessage(message || error || 'Image editor operation failed.', 'error');
                },
                onWarning(error, message) {
                    console.warn('[ImageEditor demo]', message, error);
                },
            },
            transform: { animationDuration: 120 },
            history: {},
            masks: {
                rotatable: true,
                namePrefix: 'redaction',
                listOrder: 'front-to-back',
                bindToImageTransform: bindingOptions.masksFollowTransform,
                defaultConfig: maskShapeBase,
            },
            filters: {},
            crop: {
                paddingPx: 18,
                minimumWidthPx: 60,
                minimumHeightPx: 60,
            },
            mosaic: {
                brushSizePx: 48,
                pixelBlockSizePx: 10,
                format: 'png',
            },
            annotations: {},
            text: {
                defaultText: 'Review note',
                width: 260,
                fontSize: 32,
                fill: '#b45309',
                backgroundColor: 'rgba(255,255,255,0)',
                namePrefix: 'note',
                bindToImageTransform: bindingOptions.annotationsFollowTransform,
                reflectionBehavior: 'preserve-readable',
            },
            shape: {
                stroke: '#b45309',
                strokeWidth: 4,
                fill: 'rgba(245,158,11,0.16)',
                arrowHeadLength: 20,
                namePrefix: 'shape',
                bindToImageTransform: bindingOptions.annotationsFollowTransform,
            },
            draw: {
                brush: {
                    color: '#b45309',
                    width: 8,
                    opacity: 0.92,
                    namePrefix: 'stroke',
                    bindToImageTransform: bindingOptions.annotationsFollowTransform,
                },
                eraser: {
                    radius: 18,
                    previewStroke: '#7c2d12',
                    previewFill: 'rgba(255,255,255,0.35)',
                },
            },
            overlayState: {},
        };
    }

    function createPluginPlan(options) {
        const api = window.ImageEditorFull;
        if (!api) throw new Error('ImageEditor v3 plugin factories are unavailable.');

        if (pageName === 'basic') {
            return {
                transform: api.transformPlugin(options.transform),
                history: api.historyPlugin(options.history),
                filters: api.filtersPlugin(options.filters),
                crop: api.cropPlugin(options.crop),
            };
        }
        if (pageName === 'annotation') {
            return {
                history: api.historyPlugin(options.history),
                overlays: api.overlayFoundationPlugin(),
                annotations: api.annotationFoundationPlugin(options.annotations),
                text: api.textAnnotationPlugin(options.text),
                shape: api.shapeAnnotationPlugin(options.shape),
                draw: api.drawAnnotationPlugin(options.draw),
            };
        }
        if (pageName === 'mask-mosaic') {
            return {
                overlays: api.overlayFoundationPlugin(),
                masks: api.maskPlugin(options.masks),
                mosaic: api.mosaicPlugin(options.mosaic),
            };
        }
        if (pageName === 'integrated-editor') {
            return {
                transform: api.transformPlugin(options.transform),
                history: api.historyPlugin(options.history),
                overlays: api.overlayFoundationPlugin(),
                masks: api.maskPlugin(options.masks),
                annotations: api.annotationFoundationPlugin(options.annotations),
                text: api.textAnnotationPlugin(options.text),
                shape: api.shapeAnnotationPlugin(options.shape),
                draw: api.drawAnnotationPlugin(options.draw),
            };
        }
        throw new Error(`Unsupported demo page "${pageName}".`);
    }

    function registerPluginObservers(kit) {
        const refresh = () => queueMicrotask(updateDemoUi);
        trackCleanup(kit.history?.onChange(refresh));
        trackCleanup(kit.filters?.subscribe(refresh));
        trackCleanup(kit.crop?.subscribe(refresh));
        trackCleanup(kit.mosaic?.subscribe(refresh));
        trackCleanup(kit.annotations?.subscribe(refresh));
        trackCleanup(kit.text?.subscribe(refresh));
        trackCleanup(kit.overlays?.onSelectionChange(refresh));
    }

    function getActiveToolMode() {
        const kit = getKit();
        if (!kit) return null;
        if (kit.crop?.isActive) return 'crop';
        if (kit.mosaic?.isActive) return 'mosaic';
        if (kit.text?.getEditingSession()) return 'text';
        if (kit.shape?.getSession()) return 'shape';
        if (kit.draw?.getSession()) return 'draw';
        return null;
    }

    function getScenePoint(canvas, event) {
        const point = event?.scenePoint || (event?.e ? canvas.getScenePoint(event.e) : null);
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
        return { x: point.x, y: point.y };
    }

    function getBaseImage() {
        return (
            getEditor()
                ?.getCanvas()
                ?.getObjects()
                .find((object) => object.editorObjectKind === 'baseImage') || null
        );
    }

    function toImagePixelPoint(scenePoint) {
        const image = getBaseImage();
        const fabricApi = window.fabric;
        if (!image || !fabricApi?.util?.invertTransform || !fabricApi?.util?.transformPoint) {
            return null;
        }
        const inverse = fabricApi.util.invertTransform(image.calcTransformMatrix());
        const local = fabricApi.util.transformPoint(
            new fabricApi.Point(scenePoint.x, scenePoint.y),
            inverse,
        );
        const width = Number(image.width) || 0;
        const height = Number(image.height) || 0;
        return {
            xPx: Math.max(0, Math.min(width - 1, local.x + width / 2)),
            yPx: Math.max(0, Math.min(height - 1, local.y + height / 2)),
        };
    }

    function shapeGeometryFromPoints(kind, start, end) {
        if (kind === 'rect') {
            return {
                kind,
                left: Math.min(start.x, end.x),
                top: Math.min(start.y, end.y),
                width: Math.max(2, Math.abs(end.x - start.x)),
                height: Math.max(2, Math.abs(end.y - start.y)),
            };
        }
        return {
            kind,
            start,
            end:
                Math.hypot(end.x - start.x, end.y - start.y) >= 2
                    ? end
                    : { x: start.x + 2, y: start.y },
        };
    }

    function queuePointerOperation(operation) {
        const run = async () => operation();
        demoState.pointer.queue = demoState.pointer.queue.then(run, run).catch((error) => {
            demoState.pointer.active = false;
            showMessage(error, 'error');
            updateDemoUi();
        });
    }

    function setCanvasToolInteraction(active) {
        const canvas = getEditor()?.getCanvas();
        if (!canvas) return;
        canvas.selection = false;
        canvas.skipTargetFind = active;
        canvas.defaultCursor = active ? 'crosshair' : 'default';
        if (active) canvas.discardActiveObject();
        canvas.requestRenderAll();
    }

    function registerCanvasPointerBridge(kit) {
        const canvas = kit.editor.getCanvas();
        if (!canvas) return;

        const onPointerDown = (event) => {
            const mode = getActiveToolMode();
            if (mode !== 'shape' && mode !== 'draw' && mode !== 'mosaic') return;
            const point = getScenePoint(canvas, event);
            if (!point) return;
            demoState.pointer.active = true;
            demoState.pointer.start = point;
            if (mode === 'draw') {
                queuePointerOperation(() => kit.draw.beginStroke(point));
            } else if (mode === 'mosaic') {
                const imagePoint = toImagePixelPoint(point);
                if (imagePoint) queuePointerOperation(() => kit.mosaic.beginStroke(imagePoint));
            }
        };
        const onPointerMove = (event) => {
            if (!demoState.pointer.active) return;
            const point = getScenePoint(canvas, event);
            const mode = getActiveToolMode();
            if (!point || (mode !== 'draw' && mode !== 'mosaic')) return;
            if (mode === 'draw') {
                queuePointerOperation(() => kit.draw.appendStroke(point));
            } else {
                const imagePoint = toImagePixelPoint(point);
                if (imagePoint) queuePointerOperation(() => kit.mosaic.appendStroke(imagePoint));
            }
        };
        const onPointerUp = (event) => {
            if (!demoState.pointer.active) return;
            demoState.pointer.active = false;
            const mode = getActiveToolMode();
            const point = getScenePoint(canvas, event) || demoState.pointer.start;
            if (mode === 'shape' && demoState.pointer.start && point) {
                const geometry = shapeGeometryFromPoints(
                    kit.shape.getSession()?.kind || 'rect',
                    demoState.pointer.start,
                    point,
                );
                queuePointerOperation(async () => {
                    await kit.shape.updatePreview(geometry);
                    await kit.shape.commit();
                    recordOperation('annotation-shape:commit');
                    setCanvasToolInteraction(false);
                    updateDemoUi();
                });
            } else if (mode === 'draw') {
                queuePointerOperation(async () => {
                    await kit.draw.endStroke();
                    recordOperation('annotation-draw:end-stroke');
                    updateDemoUi();
                });
            } else if (mode === 'mosaic') {
                queuePointerOperation(async () => {
                    await kit.mosaic.endStroke();
                    recordOperation('mosaic:end-stroke');
                    updateDemoUi();
                });
            }
            demoState.pointer.start = null;
        };

        canvas.on('mouse:down', onPointerDown);
        canvas.on('mouse:move', onPointerMove);
        canvas.on('mouse:up', onPointerUp);
        trackCleanup(() => {
            canvas.off('mouse:down', onPointerDown);
            canvas.off('mouse:move', onPointerMove);
            canvas.off('mouse:up', onPointerUp);
        });
    }

    async function initEditor(bindingOptions = readBindingOptionsFromControls()) {
        if (!demoRuntime?.createEditor) {
            throw new Error('ImageEditor v3 modular runtime could not be loaded.');
        }
        demoState.bindingOptions = { ...bindingOptions };
        syncBindingControls(demoState.bindingOptions);
        const options = createEditorOptions(bindingOptions);
        const kit = demoRuntime.createEditor(options.core, createPluginPlan(options));
        demoState.kit = kit;
        try {
            await kit.editor.init({
                canvas: 'canvas',
                canvasContainer: 'canvasContainer',
                imagePlaceholder: 'imagePlaceholder',
            });
            registerPluginObservers(kit);
            registerCanvasPointerBridge(kit);
            updateDemoUi();
        } catch (error) {
            demoState.kit = null;
            await kit.editor.disposeAsync().catch(() => undefined);
            throw error;
        }
    }

    async function disposeEditor() {
        const kit = getKit();
        demoState.kit = null;
        releaseCleanups();
        demoState.pointer.active = false;
        demoState.pointer.start = null;
        demoState.pointer.queue = Promise.resolve();
        if (kit) await kit.editor.disposeAsync();
    }

    async function applyBindingOptionsFromControls() {
        if (!isIntegratedEditorPage) return;

        const editor = getEditor();
        const nextOptions = readBindingOptionsFromControls();
        const activeToolMode = getActiveToolMode();
        if (!editor || isDemoBusy() || activeToolMode !== null) {
            syncBindingControls(demoState.bindingOptions);
            return;
        }
        if (haveSameBindingOptions(nextOptions, demoState.bindingOptions)) return;

        const hasImage = editor.isImageLoaded();
        const snapshot = hasImage ? editor.saveState() : null;
        demoState.isBusy = true;
        recordOperation('demo:recompose-plugin-plan');
        updateDemoUi();

        try {
            await disposeEditor();
            await initEditor(nextOptions);
            const nextEditor = getEditor();
            if (!nextEditor) throw new Error('ImageEditor could not be reinitialized.');
            setLayoutModeFromControl(false);
            if (snapshot) await nextEditor.loadFromState(snapshot);

            const maskBehavior = nextOptions.masksFollowTransform ? 'follow' : 'stay fixed';
            const annotationBehavior = nextOptions.annotationsFollowTransform
                ? 'follow'
                : 'stay fixed';
            showMessage(
                `Transform behavior updated: masks ${maskBehavior}; annotations ${annotationBehavior}.`,
                'success',
            );
        } catch (error) {
            showMessage(error, 'error');
        } finally {
            demoState.isBusy = false;
            updateDemoUi();
        }
    }

    function isDemoBusy() {
        return demoState.isBusy;
    }

    function setLayoutModeFromControl(shouldRecord = true) {
        const select = getOptionalElement('layoutModeSelect');
        const editor = getEditor();
        if (!editor || !select || !select.value) return;
        editor.setLayoutMode(select.value);
        if (shouldRecord) recordOperation('core:set-layout-mode');
    }

    function getPrimarySelection() {
        const kit = getKit();
        const selection = kit?.overlays?.getSelection() || null;
        const primaryId = selection?.primaryId || null;
        const object = primaryId ? kit?.overlays?.getByPersistentId(primaryId) || null : null;
        const classification = object ? kit?.overlays?.classify(object) || null : null;
        const mask = primaryId
            ? kit?.masks?.getAll().find((candidate) => candidate.maskUid === primaryId) || null
            : null;
        const annotation = primaryId ? kit?.annotations?.get(primaryId) || null : null;
        return { selection, primaryId, classification, mask, annotation };
    }

    function updateDemoUi() {
        const kit = getKit();
        const editor = kit?.editor || null;
        const hasImage = !!editor?.isImageLoaded();
        const transformState = kit?.transform?.getState() || null;
        const historyState = kit?.history?.getState() || null;
        const masks = kit?.masks?.getAll() || [];
        const annotations =
            kit?.annotations?.list({ includeHidden: true, includeLocked: true }) || [];
        const selected = getPrimarySelection();
        const mosaicConfig = kit?.mosaic?.getConfiguration() || null;
        const activeToolMode = getActiveToolMode();
        const busy = isDemoBusy();
        const canLoad = !!editor && !busy && activeToolMode === null;
        const canUseIdleImage = !!editor && hasImage && !busy && activeToolMode === null;
        const canUseImageFilters = canUseIdleImage;
        const canUseShapeConfig =
            !!editor && hasImage && (activeToolMode === null || activeToolMode === 'shape');
        const canUseDrawSubMode = !!editor && hasImage && activeToolMode === 'draw';
        const selectedAnnotation = selected.annotation;
        const drawSession = kit?.draw?.getSession() || null;
        const drawConfig = kit?.draw?.getConfiguration() || null;
        const drawSubMode = drawSession?.subMode || null;

        setText('statusImage', hasImage ? 'Loaded' : 'Empty');
        setText(
            'statusScale',
            transformState ? `${Math.round(transformState.scale * 100)}%` : '100%',
        );
        setText(
            'statusRotation',
            transformState ? `${Math.round(transformState.rotationDegrees)} deg` : '0 deg',
        );
        setText('statusFlipX', transformState?.flipX ? 'Yes' : 'No');
        setText('statusFlipY', transformState?.flipY ? 'Yes' : 'No');
        setText('statusTool', activeToolMode || 'None');
        setText('statusUndo', historyState?.canUndo ? 'Yes' : 'No');
        setText('statusRedo', historyState?.canRedo ? 'Yes' : 'No');
        setText('statusMasks', String(masks.length));
        setText('statusAnnotations', String(annotations.length));
        setText(
            'statusMaskBinding',
            demoState.bindingOptions.masksFollowTransform ? 'Follow' : 'Fixed',
        );
        setText(
            'statusAnnotationBinding',
            demoState.bindingOptions.annotationsFollowTransform ? 'Follow' : 'Fixed',
        );
        setText(
            'statusMosaic',
            mosaicConfig
                ? `${mosaicConfig.brushSizePx}px / ${mosaicConfig.pixelBlockSizePx}px`
                : '48px / 10px',
        );
        setText('statusSelection', describeSelection(selected));

        const canvasContainer = getOptionalElement('canvasContainer');
        const imagePlaceholder = getOptionalElement('imagePlaceholder');
        if (canvasContainer) canvasContainer.hidden = !hasImage;
        if (imagePlaceholder) imagePlaceholder.hidden = hasImage;
        if (transformState) {
            setControlValue('scalePercentageInput', Math.round(transformState.scale * 100));
        }

        setDisabled('loadSampleButton', !canLoad);
        setDisabled('imageInput', !canLoad);
        setDisabled('layoutModeSelect', !canLoad);
        setDisabled(
            'maskTransformBindingInput',
            !isIntegratedEditorPage || !editor || busy || activeToolMode !== null,
        );
        setDisabled(
            'annotationTransformBindingInput',
            !isIntegratedEditorPage || !editor || busy || activeToolMode !== null,
        );
        setDisabled('createMaskButton', !canUseIdleImage);
        setDisabled('createTextAnnotationButton', !canUseIdleImage);
        setImageFilterControlsDisabled(!canUseImageFilters);
        setDisabled('createShapeAnnotationButton', !canUseIdleImage);
        setDisabled('enterShapeModeButton', !canUseIdleImage);
        setDisabled('exitShapeModeButton', !(!!editor && activeToolMode === 'shape'));
        setDisabled('shapeKindSelect', !canUseShapeConfig);
        setDisabled('shapeStrokeInput', !canUseShapeConfig);
        setDisabled('shapeStrokeWidthInput', !canUseShapeConfig);
        setDisabled('shapeFillInput', !canUseShapeConfig);
        setDisabled('drawBrushSubModeButton', !canUseDrawSubMode);
        setDisabled('drawEraseSubModeButton', !canUseDrawSubMode);
        setDisabled('eraserBrushSizeInput', !canUseDrawSubMode);
        setDisabled('enterTextModeButton', !canUseIdleImage);
        setDisabled('exitTextModeButton', activeToolMode !== 'text' || busy);
        setDisabled('enterDrawModeButton', !canUseIdleImage);
        setDisabled('exitDrawModeButton', activeToolMode !== 'draw' || busy);
        setDisabled('enterCropModeButton', !canUseIdleImage);
        setDisabled('applyCropButton', activeToolMode !== 'crop' || busy);
        setDisabled('cancelCropButton', activeToolMode !== 'crop' || busy);
        setDisabled('cropAspectRatioSelect', !hasImage || busy);
        setDisabled('enterMosaicModeButton', !canUseIdleImage);
        setDisabled('exitMosaicModeButton', activeToolMode !== 'mosaic' || busy);
        setDisabled('mosaicBrushSizeInput', !hasImage || busy);
        setDisabled('mosaicBlockSizeInput', !hasImage || busy);
        setDisabled('createMaskButton', !canUseIdleImage);
        setDisabled('removeSelectedMaskButton', !selected.mask || busy);
        setDisabled('removeAllMasksButton', masks.length === 0 || busy);
        setDisabled('mergeMasksButton', masks.length === 0 || busy || activeToolMode !== null);
        setDisabled('removeSelectedAnnotationButton', !selectedAnnotation || busy);
        setDisabled('removeAllAnnotationsButton', annotations.length === 0 || busy);
        setDisabled(
            'mergeAnnotationsButton',
            annotations.length === 0 || busy || activeToolMode !== null,
        );
        setDisabled('toggleAnnotationHiddenButton', !selectedAnnotation || busy);
        setDisabled('toggleAnnotationLockedButton', !selectedAnnotation || busy);
        setDisabled('deleteSelectedObjectButton', !selected.primaryId || busy);
        for (const id of [
            'bringSelectedObjectForwardButton',
            'sendSelectedObjectBackwardButton',
            'bringSelectedObjectToFrontButton',
            'sendSelectedObjectToBackButton',
        ]) {
            setDisabled(id, !selected.primaryId || busy);
        }
        for (const id of [
            'zoomInButton',
            'zoomOutButton',
            'rotateLeftButton',
            'rotateRightButton',
            'flipHorizontalButton',
            'flipVerticalButton',
            'resetImageTransformButton',
            'scalePercentageInput',
            'rotateLeftDegreesInput',
            'rotateRightDegreesInput',
        ]) {
            setDisabled(id, !canUseIdleImage);
        }
        setDisabled('undoButton', busy || !historyState?.canUndo || activeToolMode !== null);
        setDisabled('redoButton', busy || !historyState?.canRedo || activeToolMode !== null);
        setDisabled('exportImageButton', !canUseIdleImage);
        setDisabled('downloadExportButton', !canUseIdleImage);
        if (drawConfig) setControlValue('eraserBrushSizeInput', drawConfig.eraser.radius);

        document.querySelectorAll('[data-mask-preset]').forEach((button) => {
            if ('disabled' in button) button.disabled = !canUseIdleImage;
        });

        getOptionalElement('drawBrushSubModeButton')?.classList.toggle(
            'primary',
            drawSubMode === 'brush',
        );
        getOptionalElement('drawEraseSubModeButton')?.classList.toggle(
            'primary',
            drawSubMode === 'erase',
        );
        setControlPressed('drawBrushSubModeButton', drawSubMode === 'brush');
        setControlPressed('drawEraseSubModeButton', drawSubMode === 'erase');

        setText(
            'annotationVisibilityState',
            selectedAnnotation
                ? selectedAnnotation.hidden
                    ? 'Hidden'
                    : 'Visible'
                : 'No selection',
        );
        setText(
            'annotationLockState',
            selectedAnnotation
                ? selectedAnnotation.locked
                    ? 'Locked'
                    : 'Unlocked'
                : 'No selection',
        );

        renderObjectList('maskList', masks, selected.selection?.ids || [], (mask) => ({
            id: mask.maskUid,
            label: mask.maskName,
            className: 'mask-item',
        }));
        renderObjectList(
            'annotationList',
            annotations,
            selected.selection?.ids || [],
            (annotation) => ({
                id: annotation.id,
                label: `${annotation.name} (${annotation.kind.replace('annotation:', '')})`,
                className: 'annotation-item',
            }),
        );
    }

    function describeSelection(selected) {
        if (!selected.primaryId) return 'None';
        if (selected.mask) return selected.mask.maskName;
        if (selected.annotation) {
            return `${selected.annotation.name} (${selected.annotation.kind.replace('annotation:', '')})`;
        }
        return selected.classification?.kind || selected.primaryId;
    }

    function renderObjectList(targetId, items, selectedIds, describe) {
        const target = getOptionalElement(targetId);
        const kit = getKit();
        if (!target || !kit) return;
        const selected = new Set(selectedIds);
        const elements = items.map((item) => {
            const descriptor = describe(item);
            const element = document.createElement('li');
            element.className = descriptor.className;
            element.classList.toggle('active', selected.has(descriptor.id));
            element.tabIndex = 0;
            element.setAttribute('role', 'button');
            element.setAttribute('aria-pressed', selected.has(descriptor.id) ? 'true' : 'false');
            element.textContent = descriptor.label;
            const select = () => kit.overlays.select([descriptor.id]);
            element.addEventListener('click', select);
            element.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                select();
            });
            return element;
        });
        target.replaceChildren(...elements);
    }

    function setImageFilterControlsDisabled(disabled) {
        imageFilterControlIds.forEach((id) => setDisabled(id, disabled));
    }

    async function runDemoAction(operation, action, successMessage) {
        if (isDemoBusy()) return undefined;
        demoState.isBusy = true;
        recordOperation(operation);
        clearMessage();
        updateDemoUi();
        try {
            const result = await action();
            if (successMessage) showMessage(successMessage, 'success');
            return result;
        } catch (error) {
            showMessage(error, 'error');
            return undefined;
        } finally {
            demoState.isBusy = false;
            updateDemoUi();
        }
    }

    function readImageFilterConfigFromControls() {
        return {
            brightness: readNumberControl('imageBrightnessInput', 0),
            contrast: readNumberControl('imageContrastInput', 0),
            saturation: readNumberControl('imageSaturationInput', 0),
            blur: readNumberControl('imageBlurInput', 0),
            sharpen: readNumberControl('imageSharpenInput', 0),
            grayscale: getOptionalElement('imageGrayscaleInput')?.checked === true,
            sepia: getOptionalElement('imageSepiaInput')?.checked === true,
            vintage: getOptionalElement('imageVintageInput')?.checked === true,
        };
    }

    function filterDefinitionsFromConfig(config) {
        const definitions = [];
        for (const type of ['brightness', 'contrast', 'saturation', 'blur', 'sharpen']) {
            if (config[type] !== 0) definitions.push({ type, value: config[type] });
        }
        for (const type of ['grayscale', 'sepia', 'vintage']) {
            if (config[type]) definitions.push({ type });
        }
        return definitions;
    }

    function filterConfigFromDefinitions(definitions) {
        const config = {
            brightness: 0,
            contrast: 0,
            saturation: 0,
            blur: 0,
            sharpen: 0,
            grayscale: false,
            sepia: false,
            vintage: false,
        };
        for (const definition of definitions || []) {
            if ('value' in definition) config[definition.type] = definition.value;
            else config[definition.type] = true;
        }
        return config;
    }

    function syncImageFilterControls(config) {
        if (!getOptionalElement('imageBrightnessInput')) return;
        const next = config || filterConfigFromDefinitions([]);
        setControlValue('imageBrightnessInput', next.brightness);
        setControlValue('imageContrastInput', next.contrast);
        setControlValue('imageSaturationInput', next.saturation);
        setControlValue('imageBlurInput', next.blur);
        setControlValue('imageSharpenInput', next.sharpen);
        setControlChecked('imageGrayscaleInput', next.grayscale);
        setControlChecked('imageSepiaInput', next.sepia);
        setControlChecked('imageVintageInput', next.vintage);
    }

    function previewImageFilters() {
        const kit = getKit();
        if (!kit?.editor.isImageLoaded() || isDemoBusy()) return;
        const sequence = ++demoState.filterPreviewSequence;
        recordOperation('filters:preview');
        void kit.filters
            .preview(filterDefinitionsFromConfig(readImageFilterConfigFromControls()))
            .then(() => {
                if (sequence === demoState.filterPreviewSequence) updateDemoUi();
            })
            .catch((error) => {
                if (sequence === demoState.filterPreviewSequence) showMessage(error, 'error');
            });
    }

    function commitImageFilters() {
        const kit = getKit();
        if (!kit?.editor.isImageLoaded() || isDemoBusy()) return;
        void runDemoAction(
            'filters:commit',
            () =>
                kit.filters.commit(
                    filterDefinitionsFromConfig(readImageFilterConfigFromControls()),
                ),
            'Image filters applied.',
        );
    }

    function resetImageFilterPreview() {
        const kit = getKit();
        if (!kit?.editor.isImageLoaded() || isDemoBusy()) return;
        void runDemoAction(
            'filters:cancel-preview',
            async () => {
                await kit.filters.cancelPreview();
                syncImageFilterControls(
                    filterConfigFromDefinitions(kit.filters.getState().filters),
                );
            },
            'Filter preview reset.',
        );
    }

    function clearImageFilters() {
        const kit = getKit();
        if (!kit?.editor.isImageLoaded() || isDemoBusy()) return;
        void runDemoAction(
            'filters:clear',
            async () => {
                await kit.filters.clear();
                syncImageFilterControls(filterConfigFromDefinitions([]));
            },
            'Image filters cleared.',
        );
    }

    function getImageBounds() {
        const bounds = getBaseImage()?.getBoundingRect();
        return bounds
            ? { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }
            : { left: 0, top: 0, width: 960, height: 620 };
    }

    function pointInImage(xRatio, yRatio) {
        const bounds = getImageBounds();
        return {
            x: bounds.left + bounds.width * xRatio,
            y: bounds.top + bounds.height * yRatio,
        };
    }

    async function loadDataUrl(dataUrl, successMessage, afterLoad) {
        const editor = getEditor();
        if (!editor || isDemoBusy()) return;
        await runDemoAction(
            'core:load-image',
            async () => {
                setLayoutModeFromControl(false);
                await editor.loadImage(dataUrl);
                syncImageFilterControls(filterConfigFromDefinitions([]));
                if (afterLoad) await afterLoad();
            },
            successMessage || 'Image loaded.',
        );
    }

    async function loadSample() {
        await loadDataUrl(
            createSampleDataUrl(pageName),
            isIntegratedEditorPage
                ? 'Sample loaded with two masks and two annotations.'
                : 'Sample image loaded.',
            isIntegratedEditorPage ? createIntegratedSampleOverlays : null,
        );
    }

    async function createIntegratedSampleOverlays() {
        const kit = getKit();
        if (!kit?.editor.isImageLoaded()) return;
        const bounds = getImageBounds();

        await kit.masks.create({
            ...maskShapeBase,
            styles: { ...maskShapeBase.styles },
            shape: 'rect',
            left: bounds.left + bounds.width * 0.13,
            top: bounds.top + bounds.height * 0.31,
            width: bounds.width * 0.25,
            height: bounds.height * 0.13,
            angle: -4,
        });
        await kit.masks.create({
            ...maskShapeBase,
            styles: { ...maskShapeBase.styles },
            shape: 'ellipse',
            left: bounds.left + bounds.width * 0.62,
            top: bounds.top + bounds.height * 0.52,
            width: bounds.width * 0.21,
            height: bounds.height * 0.15,
            angle: 9,
        });
        await kit.text.create({
            text: 'Readable text',
            left: bounds.left + bounds.width * 0.45,
            top: bounds.top + bounds.height * 0.18,
            width: 260,
            fontSize: 30,
            fill: '#b45309',
            backgroundColor: 'rgba(255,255,255,0.78)',
        });
        await kit.shape.create({
            geometry: {
                kind: 'arrow',
                start: pointInImage(0.24, 0.69),
                end: pointInImage(0.62, 0.57),
            },
            stroke: '#b45309',
            strokeWidth: 5,
            arrowHeadLength: 22,
        });
    }

    async function handleFileInputChange(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        try {
            const editor = getEditor();
            if (!editor) return;
            await runDemoAction(
                'core:load-image-file',
                async () => {
                    setLayoutModeFromControl(false);
                    await editor.loadImageFile(file);
                    syncImageFilterControls(filterConfigFromDefinitions([]));
                },
                `${file.name} loaded.`,
            );
        } finally {
            event.target.value = '';
        }
    }

    function createTextAnnotation() {
        const kit = getKit();
        if (!kit?.editor.isImageLoaded() || isDemoBusy()) return;
        void runDemoAction(
            'annotation-text:create',
            () => kit.text.create(readTextCreateOptions()),
            'Text annotation created.',
        );
    }

    function readTextCreateOptions() {
        const textInput = getOptionalElement('textValueInput');
        const colorInput = getOptionalElement('textColorInput');
        const sizeInput = getOptionalElement('textFontSizeInput');
        const fontSize = Number(sizeInput?.value || 32);
        const position = pointInImage(0.14, 0.16);
        return {
            text: textInput?.value || 'Review note',
            fill: colorInput?.value || '#b45309',
            fontSize: Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 32,
            left: position.x,
            top: position.y,
            width: 280,
        };
    }

    function enterTextMode() {
        const kit = getKit();
        if (!kit?.editor.isImageLoaded() || isDemoBusy()) return;
        void runDemoAction(
            'annotation-text:begin-editing',
            async () => {
                const id = await kit.text.create(readTextCreateOptions());
                await kit.text.beginEditing(id);
            },
            'Text editing active.',
        );
    }

    function exitTextMode() {
        const kit = getKit();
        if (!kit?.text.getEditingSession() || isDemoBusy()) return;
        void runDemoAction(
            'annotation-text:commit-editing',
            () => kit.text.commitEditing(),
            'Text editing committed.',
        );
    }

    function readShapeKind() {
        const value = getOptionalElement('shapeKindSelect')?.value;
        return value === 'line' || value === 'arrow' ? value : 'rect';
    }

    function hexToRgba(hex, alpha) {
        const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
        if (!match) return `rgba(245,158,11,${alpha})`;
        const red = parseInt(match[1], 16);
        const green = parseInt(match[2], 16);
        const blue = parseInt(match[3], 16);
        return `rgba(${red},${green},${blue},${alpha})`;
    }

    function readShapeStyleConfig() {
        const kind = readShapeKind();
        const strokeWidth = readNumberControl('shapeStrokeWidthInput', 4);
        const fillColor = getOptionalElement('shapeFillInput')?.value || '#f59e0b';
        return {
            stroke: getOptionalElement('shapeStrokeInput')?.value || '#b45309',
            strokeWidth: Math.max(1, strokeWidth),
            fill: kind === 'rect' ? hexToRgba(fillColor, 0.16) : 'rgba(0,0,0,0)',
            arrowHeadLength: 20,
        };
    }

    function buildShapeAnnotationConfig() {
        const style = readShapeStyleConfig();
        const kind = readShapeKind();
        if (kind === 'line') {
            return {
                ...style,
                geometry: {
                    kind,
                    start: pointInImage(0.18, 0.42),
                    end: pointInImage(0.66, 0.34),
                },
            };
        }
        if (kind === 'arrow') {
            return {
                ...style,
                geometry: {
                    kind,
                    start: pointInImage(0.2, 0.56),
                    end: pointInImage(0.7, 0.4),
                },
            };
        }
        const bounds = getImageBounds();
        return {
            ...style,
            geometry: {
                kind: 'rect',
                left: bounds.left + bounds.width * 0.22,
                top: bounds.top + bounds.height * 0.24,
                width: Math.min(210, bounds.width * 0.3),
                height: Math.min(120, bounds.height * 0.24),
            },
        };
    }

    function syncShapeConfigFromControls() {
        const kit = getKit();
        if (!kit?.editor.isImageLoaded()) return;
        const activeToolMode = getActiveToolMode();
        if (activeToolMode !== null && activeToolMode !== 'shape') return;
        void kit.shape
            .configure(readShapeStyleConfig())
            .catch((error) => showMessage(error, 'error'));
    }

    function createShapeAnnotation() {
        const kit = getKit();
        if (!kit?.editor.isImageLoaded() || isDemoBusy()) return;
        void runDemoAction(
            'annotation-shape:create',
            () => kit.shape.create(buildShapeAnnotationConfig()),
            'Shape annotation created.',
        );
    }

    function enterShapeMode() {
        const kit = getKit();
        if (!kit?.editor.isImageLoaded() || isDemoBusy()) return;
        void runDemoAction(
            'annotation-shape:enter',
            async () => {
                await kit.shape.enter({ kind: readShapeKind(), ...readShapeStyleConfig() });
                setCanvasToolInteraction(true);
            },
            'Shape mode active. Drag on the canvas to create a shape.',
        );
    }

    function exitShapeMode() {
        const kit = getKit();
        if (!kit?.shape.getSession() || isDemoBusy()) return;
        void runDemoAction(
            'annotation-shape:cancel',
            async () => {
                await kit.shape.cancel();
                setCanvasToolInteraction(false);
            },
            'Shape mode exited.',
        );
    }

    function enterDrawMode() {
        const kit = getKit();
        if (!kit?.editor.isImageLoaded() || isDemoBusy()) return;
        void runDemoAction(
            'annotation-draw:enter',
            async () => {
                await kit.draw.configureBrush({
                    color: getOptionalElement('drawColorInput')?.value || '#b45309',
                    width: Math.max(1, readNumberControl('drawBrushSizeInput', 8)),
                });
                await kit.draw.configureEraser({
                    radius: Math.max(1, readNumberControl('eraserBrushSizeInput', 18)),
                });
                await kit.draw.enter({ subMode: 'brush' });
                setCanvasToolInteraction(true);
            },
            'Draw mode active. Drag on the canvas to draw.',
        );
    }

    function exitDrawMode() {
        const kit = getKit();
        if (!kit?.draw.getSession() || isDemoBusy()) return;
        void runDemoAction(
            'annotation-draw:exit',
            async () => {
                await kit.draw.exit();
                setCanvasToolInteraction(false);
            },
            'Draw mode exited.',
        );
    }

    function setDrawSubMode(mode) {
        const kit = getKit();
        if (!kit?.draw.getSession() || isDemoBusy()) return;
        void runDemoAction(
            'annotation-draw:set-sub-mode',
            () => kit.draw.setSubMode(mode),
            mode === 'erase' ? 'Draw eraser active.' : 'Draw brush active.',
        );
    }

    function updateDrawBrushFromControls() {
        const kit = getKit();
        if (!kit?.editor.isImageLoaded()) return;
        void kit.draw
            .configureBrush({
                color: getOptionalElement('drawColorInput')?.value || '#b45309',
                width: Math.max(1, readNumberControl('drawBrushSizeInput', 8)),
            })
            .catch((error) => showMessage(error, 'error'));
    }

    function updateEraserConfigFromControls() {
        const kit = getKit();
        if (!kit?.editor.isImageLoaded()) return;
        const activeToolMode = getActiveToolMode();
        if (activeToolMode !== null && activeToolMode !== 'draw') return;
        void kit.draw
            .configureEraser({
                radius: Math.max(1, readNumberControl('eraserBrushSizeInput', 18)),
            })
            .catch((error) => showMessage(error, 'error'));
    }

    function getSelectedOrFirstAnnotation() {
        const kit = getKit();
        if (!kit) return null;
        const primary = kit.overlays.getSelection().primaryId;
        return (
            (primary ? kit.annotations.get(primary) : null) ||
            kit.annotations.list({ includeHidden: true, includeLocked: true })[0] ||
            null
        );
    }

    function toggleAnnotationFlag(flag, trueMessage, falseMessage) {
        const kit = getKit();
        const annotation = getSelectedOrFirstAnnotation();
        if (!kit || !annotation || isDemoBusy()) return;
        const nextValue = !annotation[flag];
        void runDemoAction(
            'annotation:update',
            () => kit.annotations.update(annotation.id, { [flag]: nextValue }),
            nextValue ? trueMessage : falseMessage,
        );
    }

    function toggleAnnotationHidden() {
        toggleAnnotationFlag('hidden', 'Annotation hidden.', 'Annotation shown.');
    }

    function toggleAnnotationLocked() {
        toggleAnnotationFlag('locked', 'Annotation locked.', 'Annotation unlocked.');
    }

    function getMaskShapeConfig(shape) {
        return {
            ...maskShapeBase,
            styles: { ...maskShapeBase.styles },
            ...(maskShapeConfigs[shape] || maskShapeConfigs.rect),
        };
    }

    function createMask(shape) {
        const kit = getKit();
        if (!kit?.editor.isImageLoaded() || isDemoBusy()) return;
        const select = getOptionalElement('maskShapeSelect');
        const nextShape = shape || select?.value || 'rect';
        void runDemoAction(
            'mask:create',
            () => kit.masks.create(getMaskShapeConfig(nextShape)),
            `${nextShape} mask created.`,
        );
    }

    function createPresetMask(preset) {
        const kit = getKit();
        if (!kit?.editor.isImageLoaded() || isDemoBusy()) return;
        void runDemoAction(
            'mask:create',
            () => kit.masks.create(privacyMaskPresets[preset] || privacyMaskPresets.identity),
            'Redaction mask created.',
        );
    }

    function getExportOptions() {
        const formatSelect = getOptionalElement('exportFormatSelect');
        const qualityInput = getOptionalElement('exportQualityInput');
        const quality = Number(qualityInput?.value || 0.92);
        const format = formatSelect?.value || 'png';
        const excludeKinds = [];
        if (getOptionalElement('exportMasksInput')?.checked === false) {
            excludeKinds.push('mask:object');
        }
        if (getOptionalElement('exportAnnotationsInput')?.checked === false) {
            excludeKinds.push(...annotationKinds);
        }
        return {
            area: 'image',
            format,
            quality: Number.isFinite(quality) ? quality : 0.92,
            fileName: `image-editor-${pageName}.${format === 'jpeg' ? 'jpg' : format}`,
            ...(excludeKinds.length > 0
                ? {
                      contributors: {
                          'foundation:overlay': { excludeKinds },
                      },
                  }
                : {}),
        };
    }

    function exportImage() {
        const editor = getEditor();
        if (!editor || !editor.isImageLoaded() || isDemoBusy()) return;
        void runDemoAction(
            'core:export',
            async () => {
                const options = getExportOptions();
                const dataUrl = await editor.exportImageBase64(options);
                const preview = getOptionalElement('exportPreview');
                const link = getOptionalElement('exportDownloadLink');
                if (preview) preview.src = dataUrl;
                if (link) {
                    link.href = dataUrl;
                    link.download = options.fileName;
                }
                setText('exportSummary', summarizeDataUrl(dataUrl));
            },
            'Export completed.',
        );
    }

    function downloadExport() {
        const editor = getEditor();
        if (!editor || !editor.isImageLoaded() || isDemoBusy()) return;
        void runDemoAction(
            'core:export-file',
            async () => {
                const file = await editor.exportImageFile(getExportOptions());
                const url = URL.createObjectURL(file);
                const link = document.createElement('a');
                link.href = url;
                link.download = file.name;
                link.hidden = true;
                document.body.appendChild(link);
                link.click();
                link.remove();
                setTimeout(() => URL.revokeObjectURL(url), 0);
            },
            'Download started.',
        );
    }

    function summarizeDataUrl(dataUrl) {
        const match = /^data:(image\/[^;]+);base64,(.*)$/i.exec(dataUrl);
        if (!match) return 'Exported image ready.';
        const bytes = estimateBase64Bytes(match[2]);
        return `${match[1]} - ${formatBytes(bytes)}`;
    }

    function estimateBase64Bytes(payload) {
        const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
        return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
    }

    function formatBytes(bytes) {
        if (!Number.isFinite(bytes)) return 'unknown size';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    function scaleImageFromControl() {
        const kit = getKit();
        if (!kit?.editor.isImageLoaded() || isDemoBusy()) return;
        const scale = Math.max(10, Math.min(500, readNumberControl('scalePercentageInput', 100)));
        void runDemoAction('transform:scale', () => kit.transform.scale(scale / 100));
    }

    function zoomImage(direction) {
        const kit = getKit();
        if (!kit?.editor.isImageLoaded() || isDemoBusy()) return;
        void runDemoAction(direction > 0 ? 'transform:zoom-in' : 'transform:zoom-out', () =>
            direction > 0 ? kit.transform.zoomIn() : kit.transform.zoomOut(),
        );
    }

    function rotateImage(direction) {
        const kit = getKit();
        if (!kit?.editor.isImageLoaded() || isDemoBusy()) return;
        const inputId = direction < 0 ? 'rotateLeftDegreesInput' : 'rotateRightDegreesInput';
        const delta = Math.max(1, Math.abs(readNumberControl(inputId, 90))) * direction;
        const target = kit.transform.getState().rotationDegrees + delta;
        void runDemoAction('transform:rotate', () => kit.transform.rotate(target));
    }

    function flipImage(axis) {
        const kit = getKit();
        if (!kit?.editor.isImageLoaded() || isDemoBusy()) return;
        void runDemoAction(
            axis === 'horizontal' ? 'transform:flip-horizontal' : 'transform:flip-vertical',
            () =>
                axis === 'horizontal'
                    ? kit.transform.flipHorizontal()
                    : kit.transform.flipVertical(),
        );
    }

    function resetImageTransform() {
        const kit = getKit();
        if (!kit?.editor.isImageLoaded() || isDemoBusy()) return;
        void runDemoAction('transform:reset', () => kit.transform.resetImageTransform());
    }

    function changeHistory(direction) {
        const kit = getKit();
        if (!kit || isDemoBusy() || getActiveToolMode() !== null) return;
        void runDemoAction(direction < 0 ? 'history:undo' : 'history:redo', () =>
            direction < 0 ? kit.history.undo() : kit.history.redo(),
        );
    }

    function enterCropMode() {
        const kit = getKit();
        if (!kit?.editor.isImageLoaded() || isDemoBusy()) return;
        const aspectRatio = getOptionalElement('cropAspectRatioSelect')?.value || 'free';
        void runDemoAction(
            'crop:enter',
            () => kit.crop.enter({ aspectRatio }),
            'Crop preview active.',
        );
    }

    function updateCropAspectRatio() {
        const kit = getKit();
        if (!kit?.crop.isActive || isDemoBusy()) return;
        const aspectRatio = getOptionalElement('cropAspectRatioSelect')?.value || 'free';
        void runDemoAction('crop:set-aspect-ratio', () => kit.crop.setAspectRatio(aspectRatio));
    }

    function applyCrop() {
        const kit = getKit();
        if (!kit?.crop.isActive || isDemoBusy()) return;
        void runDemoAction('crop:apply', () => kit.crop.apply(), 'Crop applied.');
    }

    function cancelCrop() {
        const kit = getKit();
        if (!kit?.crop.isActive || isDemoBusy()) return;
        void runDemoAction('crop:cancel', () => kit.crop.cancel(), 'Crop cancelled.');
    }

    function readMosaicConfiguration() {
        return {
            brushSizePx: Math.max(1, readNumberControl('mosaicBrushSizeInput', 48)),
            pixelBlockSizePx: Math.max(
                1,
                Math.round(readNumberControl('mosaicBlockSizeInput', 10)),
            ),
        };
    }

    function updateMosaicConfiguration() {
        const kit = getKit();
        if (!kit?.editor.isImageLoaded() || isDemoBusy()) return;
        void kit.mosaic
            .configure(readMosaicConfiguration())
            .then(updateDemoUi)
            .catch((error) => showMessage(error, 'error'));
    }

    function enterMosaicMode() {
        const kit = getKit();
        if (!kit?.editor.isImageLoaded() || isDemoBusy()) return;
        void runDemoAction(
            'mosaic:enter',
            async () => {
                await kit.mosaic.configure(readMosaicConfiguration());
                await kit.mosaic.enter();
                setCanvasToolInteraction(true);
            },
            'Mosaic mode active. Drag on the canvas, then exit to commit.',
        );
    }

    function exitMosaicMode() {
        const kit = getKit();
        if (!kit?.mosaic.isActive || isDemoBusy()) return;
        void runDemoAction(
            'mosaic:finish',
            async () => {
                await demoState.pointer.queue;
                const session = kit.mosaic.getSession();
                if (session?.strokeCount) await kit.mosaic.commit();
                else await kit.mosaic.cancel();
                setCanvasToolInteraction(false);
            },
            'Mosaic mode exited.',
        );
    }

    function removeSelectedMask() {
        const kit = getKit();
        if (!kit || isDemoBusy()) return;
        void runDemoAction('mask:remove', () => kit.masks.removeSelected(), 'Mask removed.');
    }

    function removeAllMasks() {
        const kit = getKit();
        if (!kit || isDemoBusy()) return;
        void runDemoAction('mask:remove-all', () => kit.masks.removeAll(), 'All masks removed.');
    }

    function removeSelectedAnnotations() {
        const kit = getKit();
        if (!kit || isDemoBusy()) return;
        const ids = kit.overlays
            .getSelection()
            .ids.filter((id) => kit.annotations.get(id) !== null);
        if (ids.length === 0) return;
        void runDemoAction(
            'annotation:remove',
            async () => {
                for (const id of ids) await kit.annotations.remove(id);
            },
            'Annotation removed.',
        );
    }

    function removeAllAnnotations() {
        const kit = getKit();
        if (!kit || isDemoBusy()) return;
        void runDemoAction(
            'annotation:remove-all',
            () => kit.annotations.removeAll(),
            'All annotations removed.',
        );
    }

    function changeSelectedLayer(action) {
        const kit = getKit();
        const id = kit?.overlays.getSelection().primaryId;
        if (!kit || !id || isDemoBusy()) return;
        const methods = {
            forward: 'bringForward',
            backward: 'sendBackward',
            front: 'bringToFront',
            back: 'sendToBack',
        };
        const method = methods[action];
        void runDemoAction(`overlay:${method}`, () => kit.overlays[method](id));
    }

    function deleteSelectedObject() {
        const kit = getKit();
        const selected = getPrimarySelection();
        if (!kit || !selected.primaryId || isDemoBusy()) return;
        void runDemoAction(
            'overlay:delete-selected',
            () =>
                selected.mask
                    ? kit.masks.remove(selected.primaryId)
                    : kit.annotations.remove(selected.primaryId),
            'Selected overlay removed.',
        );
    }

    function flattenMasks() {
        const kit = getKit();
        if (!kit || isDemoBusy()) return;
        void runDemoAction(
            'mask:flatten',
            () => kit.masks.flatten(),
            'Masks baked into the image.',
        );
    }

    function flattenAnnotations() {
        const kit = getKit();
        if (!kit || isDemoBusy()) return;
        void runDemoAction(
            'annotation:flatten',
            () => kit.annotations.flatten(),
            'Annotations baked into the image.',
        );
    }

    function bindControls() {
        [
            ['loadSampleButton', 'click', loadSample],
            ['imageInput', 'change', handleFileInputChange],
            ['layoutModeSelect', 'change', setLayoutModeFromControl],
            ['scalePercentageInput', 'change', scaleImageFromControl],
            ['zoomInButton', 'click', () => zoomImage(1)],
            ['zoomOutButton', 'click', () => zoomImage(-1)],
            ['rotateLeftButton', 'click', () => rotateImage(-1)],
            ['rotateRightButton', 'click', () => rotateImage(1)],
            ['flipHorizontalButton', 'click', () => flipImage('horizontal')],
            ['flipVerticalButton', 'click', () => flipImage('vertical')],
            ['resetImageTransformButton', 'click', resetImageTransform],
            ['undoButton', 'click', () => changeHistory(-1)],
            ['redoButton', 'click', () => changeHistory(1)],
            ['createTextAnnotationButton', 'click', createTextAnnotation],
            ['enterTextModeButton', 'click', enterTextMode],
            ['exitTextModeButton', 'click', exitTextMode],
            ['applyImageFiltersButton', 'click', commitImageFilters],
            ['resetImageFiltersButton', 'click', resetImageFilterPreview],
            ['clearImageFiltersButton', 'click', clearImageFilters],
            ['enterCropModeButton', 'click', enterCropMode],
            ['applyCropButton', 'click', applyCrop],
            ['cancelCropButton', 'click', cancelCrop],
            ['cropAspectRatioSelect', 'change', updateCropAspectRatio],
            ['createShapeAnnotationButton', 'click', createShapeAnnotation],
            ['enterShapeModeButton', 'click', enterShapeMode],
            ['exitShapeModeButton', 'click', exitShapeMode],
            ['enterDrawModeButton', 'click', enterDrawMode],
            ['exitDrawModeButton', 'click', exitDrawMode],
            ['drawBrushSubModeButton', 'click', () => setDrawSubMode('brush')],
            ['drawEraseSubModeButton', 'click', () => setDrawSubMode('erase')],
            ['enterMosaicModeButton', 'click', enterMosaicMode],
            ['exitMosaicModeButton', 'click', exitMosaicMode],
            ['removeSelectedMaskButton', 'click', removeSelectedMask],
            ['removeAllMasksButton', 'click', removeAllMasks],
            ['mergeMasksButton', 'click', flattenMasks],
            ['removeSelectedAnnotationButton', 'click', removeSelectedAnnotations],
            ['removeAllAnnotationsButton', 'click', removeAllAnnotations],
            ['mergeAnnotationsButton', 'click', flattenAnnotations],
            ['toggleAnnotationHiddenButton', 'click', toggleAnnotationHidden],
            ['toggleAnnotationLockedButton', 'click', toggleAnnotationLocked],
            ['bringSelectedObjectForwardButton', 'click', () => changeSelectedLayer('forward')],
            ['sendSelectedObjectBackwardButton', 'click', () => changeSelectedLayer('backward')],
            ['bringSelectedObjectToFrontButton', 'click', () => changeSelectedLayer('front')],
            ['sendSelectedObjectToBackButton', 'click', () => changeSelectedLayer('back')],
            ['deleteSelectedObjectButton', 'click', deleteSelectedObject],
            ['exportImageButton', 'click', exportImage],
            ['downloadExportButton', 'click', downloadExport],
            ['maskTransformBindingInput', 'change', applyBindingOptionsFromControls],
            ['annotationTransformBindingInput', 'change', applyBindingOptionsFromControls],
        ].forEach(([id, eventName, handler]) => {
            getOptionalElement(id)?.addEventListener(eventName, handler);
        });

        [
            'imageBrightnessInput',
            'imageContrastInput',
            'imageSaturationInput',
            'imageBlurInput',
            'imageSharpenInput',
        ].forEach((id) => {
            getOptionalElement(id)?.addEventListener('input', previewImageFilters);
        });
        ['imageGrayscaleInput', 'imageSepiaInput', 'imageVintageInput'].forEach((id) => {
            getOptionalElement(id)?.addEventListener('change', previewImageFilters);
        });
        ['shapeKindSelect', 'shapeStrokeInput', 'shapeStrokeWidthInput', 'shapeFillInput'].forEach(
            (id) => {
                const eventName = id === 'shapeKindSelect' ? 'change' : 'input';
                getOptionalElement(id)?.addEventListener(eventName, syncShapeConfigFromControls);
            },
        );
        getOptionalElement('eraserBrushSizeInput')?.addEventListener(
            'input',
            updateEraserConfigFromControls,
        );
        for (const id of ['drawColorInput', 'drawBrushSizeInput']) {
            getOptionalElement(id)?.addEventListener('input', updateDrawBrushFromControls);
        }
        for (const id of ['mosaicBrushSizeInput', 'mosaicBlockSizeInput']) {
            getOptionalElement(id)?.addEventListener('input', updateMosaicConfiguration);
        }

        getOptionalElement('createMaskButton')?.addEventListener('click', () => createMask());
        document.querySelectorAll('[data-mask-preset]').forEach((button) => {
            button.addEventListener('click', () => createPresetMask(button.dataset.maskPreset));
        });
    }

    function createSampleDataUrl(kind) {
        const { canvas, context } = demoRuntime.createCanvas(960, 620);
        if (kind === 'annotation') drawAnnotationSample(context);
        else if (kind === 'mask-mosaic') drawPrivacySample(context);
        else if (kind === 'integrated-editor') drawIntegratedSample(context);
        else drawBasicSample(context);
        return canvas.toDataURL('image/png');
    }

    function drawBasicSample(context) {
        fillBackground(context, '#eef4ff');
        demoRuntime.drawPanel(context, 64, 54, 832, 512, '#ffffff');
        context.fillStyle = '#dbeafe';
        context.fillRect(96, 96, 768, 250);
        context.fillStyle = '#2563eb';
        context.fillRect(126, 126, 200, 170);
        context.fillStyle = '#0f766e';
        context.beginPath();
        context.arc(518, 206, 88, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#f59e0b';
        context.fillRect(670, 132, 142, 142);
        context.fillStyle = '#111827';
        context.font = '700 34px Arial';
        context.fillText('Product workspace', 108, 414);
        context.font = '20px Arial';
        context.fillStyle = '#475569';
        context.fillText('Compose only the v3 plugins this workflow needs.', 108, 454);
        drawChartBars(context, 108, 486);
    }

    function drawAnnotationSample(context) {
        fillBackground(context, '#f8fafc');
        demoRuntime.drawPanel(context, 72, 62, 816, 496, '#ffffff');
        context.fillStyle = '#0f172a';
        context.font = '700 30px Arial';
        context.fillText('Quarterly Review Screenshot', 112, 128);
        context.font = '18px Arial';
        context.fillStyle = '#64748b';
        context.fillText(
            'Use text notes, shapes, freehand drawing, layer ordering, lock, and visibility.',
            112,
            164,
        );
        demoRuntime.drawPanel(context, 112, 204, 330, 246, '#eff6ff');
        demoRuntime.drawPanel(context, 480, 204, 296, 246, '#f0fdfa');
        context.fillStyle = '#2563eb';
        context.fillRect(140, 350, 54, 64);
        context.fillRect(214, 306, 54, 108);
        context.fillRect(288, 260, 54, 154);
        context.fillRect(362, 330, 54, 84);
        context.strokeStyle = '#0f766e';
        context.lineWidth = 6;
        context.beginPath();
        context.moveTo(520, 388);
        context.bezierCurveTo(570, 278, 658, 326, 728, 256);
        context.stroke();
        context.fillStyle = '#0f172a';
        context.font = '700 18px Arial';
        context.fillText('Revenue', 140, 246);
        context.fillText('Activation', 520, 246);
    }

    function drawPrivacySample(context) {
        fillBackground(context, '#edf2f7');
        demoRuntime.drawPanel(context, 74, 58, 812, 502, '#ffffff');
        context.fillStyle = '#0f172a';
        context.font = '700 32px Arial';
        context.fillText('Sample Identity Document', 114, 126);
        context.fillStyle = '#64748b';
        context.font = '18px Arial';
        context.fillText('All information is synthetic and safe for redaction demos.', 114, 162);
        demoRuntime.drawPanel(context, 114, 204, 520, 270, '#f8fafc');
        demoRuntime.drawPanel(context, 674, 204, 144, 188, '#dbeafe');
        context.fillStyle = '#1d4ed8';
        context.beginPath();
        context.arc(746, 270, 42, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#93c5fd';
        context.fillRect(708, 320, 76, 52);
        drawDocumentLine(context, 'Name', 'Alex Morgan', 148, 258);
        drawDocumentLine(context, 'Document ID', 'ID-42-0198-7742', 148, 316);
        drawDocumentLine(context, 'Address', '100 Sample Street, Demo City', 148, 374);
        drawDocumentLine(context, 'Issued', '2026-07-02', 148, 432);
        context.fillStyle = '#0f172a';
        context.font = '700 18px Arial';
        context.fillText('Receipt detail', 674, 436);
        context.font = '16px Arial';
        context.fillStyle = '#475569';
        context.fillText('Card: 4242 4242 4242 4242', 674, 466);
        context.fillText('Email: alex@example.test', 674, 492);
    }

    function drawIntegratedSample(context) {
        fillBackground(context, '#eef4ff');
        demoRuntime.drawPanel(context, 58, 48, 844, 524, '#ffffff');

        context.fillStyle = '#0f172a';
        context.font = '700 30px Arial';
        context.fillText('Integrated Editor Test Board', 98, 112);
        context.fillStyle = '#64748b';
        context.font = '17px Arial';
        context.fillText(
            'Exercise transforms, masks, annotations, layers, history, and export together.',
            98,
            146,
        );

        context.strokeStyle = '#dbe5f4';
        context.lineWidth = 1;
        for (let x = 98; x <= 862; x += 64) {
            context.beginPath();
            context.moveTo(x, 184);
            context.lineTo(x, 520);
            context.stroke();
        }
        for (let y = 184; y <= 520; y += 56) {
            context.beginPath();
            context.moveTo(98, y);
            context.lineTo(862, y);
            context.stroke();
        }

        demoRuntime.drawPanel(context, 126, 224, 238, 102, '#dbeafe', {
            stroke: '#2563eb',
            radius: 10,
        });
        demoRuntime.drawPanel(context, 422, 206, 266, 112, '#fffbeb', {
            stroke: '#f59e0b',
            radius: 10,
        });
        demoRuntime.drawPanel(context, 606, 354, 204, 112, '#ccfbf1', {
            stroke: '#0f766e',
            radius: 10,
        });

        context.fillStyle = '#1d4ed8';
        context.font = '700 18px Arial';
        context.fillText('MASK TARGET A', 154, 280);
        context.fillStyle = '#b45309';
        context.fillText('TEXT / SHAPE TARGET', 450, 266);
        context.fillStyle = '#0f766e';
        context.fillText('MASK TARGET B', 632, 416);

        context.fillStyle = '#475569';
        context.font = '15px Arial';
        context.fillText(
            'Use the grid and asymmetric cards to spot drift or lost reflection.',
            110,
            542,
        );
    }

    function fillBackground(context, color) {
        context.fillStyle = color;
        context.fillRect(0, 0, 960, 620);
    }

    function drawChartBars(context, x, y) {
        const values = [92, 128, 76, 154, 118, 168];
        values.forEach((value, index) => {
            context.fillStyle = index % 2 === 0 ? '#2563eb' : '#0f766e';
            context.fillRect(x + index * 44, y + (170 - value) / 3, 26, value / 3);
        });
    }

    function drawDocumentLine(context, label, value, x, y) {
        context.fillStyle = '#64748b';
        context.font = '14px Arial';
        context.fillText(label.toUpperCase(), x, y);
        context.fillStyle = '#0f172a';
        context.font = '700 22px Arial';
        context.fillText(value, x, y + 30);
        context.strokeStyle = '#e2e8f0';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(x, y + 44);
        context.lineTo(x + 430, y + 44);
        context.stroke();
    }

    async function init() {
        try {
            getRequiredElement('canvas');
            bindControls();
            syncImageFilterControls(filterConfigFromDefinitions([]));
            await initEditor();
        } catch (error) {
            showMessage(error, 'error');
            console.error(error);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        void init();
    }
    window.addEventListener('pagehide', () => {
        void disposeEditor().catch((error) =>
            console.warn('[ImageEditor demo] Disposal failed.', error),
        );
    });
})();
