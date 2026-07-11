(function () {
    'use strict';

    const pageName = document.body.dataset.demoPage || 'basic';
    const isTransformBindingPage = pageName === 'transform-binding';
    const demoRuntime = window.__imageEditorDemoRuntime;
    const editorTargetIds = [
        'scalePercentageInput',
        'zoomInButton',
        'zoomOutButton',
        'rotateLeftButton',
        'rotateRightButton',
        'rotateLeftDegreesInput',
        'rotateRightDegreesInput',
        'flipHorizontalButton',
        'flipVerticalButton',
        'resetImageTransformButton',
        'undoButton',
        'redoButton',
        'enterCropModeButton',
        'cropAspectRatioSelect',
        'applyCropButton',
        'cancelCropButton',
        'enterTextModeButton',
        'exitTextModeButton',
        'textColorInput',
        'textFontSizeInput',
        'enterDrawModeButton',
        'exitDrawModeButton',
        'drawColorInput',
        'drawBrushSizeInput',
        'removeSelectedAnnotationButton',
        'removeAllAnnotationsButton',
        'deleteSelectedObjectButton',
        'bringSelectedObjectForwardButton',
        'sendSelectedObjectBackwardButton',
        'bringSelectedObjectToFrontButton',
        'sendSelectedObjectToBackButton',
        'enterMosaicModeButton',
        'exitMosaicModeButton',
        'mosaicBrushSizeInput',
        'mosaicBlockSizeInput',
        'removeSelectedMaskButton',
        'removeAllMasksButton',
        'mergeMasksButton',
        'mergeAnnotationsButton',
        'maskList',
        'annotationList',
    ];
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
        editor: null,
        isLoading: false,
        lastOperation: null,
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

    function recordOperation(context) {
        demoState.lastOperation = context && context.operation ? context.operation : null;
        setText('statusLastOperation', demoState.lastOperation || 'None');
    }

    function initEditor() {
        const ImageEditorCtor = demoRuntime?.getImageEditorConstructor();
        if (!ImageEditorCtor) {
            showMessage('ImageEditor could not be loaded.', 'error');
            return;
        }

        demoState.editor = new ImageEditorCtor({
            backgroundColor: 'transparent',
            canvasWidth: 960,
            canvasHeight: 620,
            defaultLayoutMode: 'fit',
            downsampleOnLoad: true,
            animationDuration: 120,
            showPlaceholder: true,
            maskRotatable: true,
            maskLabelOnSelect: true,
            maskName: 'redaction',
            textAnnotationName: 'note',
            drawAnnotationName: 'stroke',
            shapeAnnotationName: 'shape',
            maskListOrder: 'front-to-back',
            annotationListOrder: 'front-to-back',
            bindMasksToImageTransform: isTransformBindingPage,
            bindAnnotationsToImageTransform: isTransformBindingPage,
            textAnnotationFlipBehavior: 'preserve-readable',
            exportAreaByDefault: 'image',
            mergeMasksByDefault: true,
            mergeAnnotationsByDefault: true,
            defaultDownloadFileName: `image-editor-${pageName}`,
            defaultMaskConfig: {
                color: 'rgba(15, 23, 42, 0.82)',
                alpha: 0.82,
                styles: {
                    stroke: '#ffffff',
                    strokeWidth: 1,
                },
            },
            defaultTextConfig: {
                text: 'Review note',
                left: '14%',
                top: '16%',
                width: 260,
                fontSize: 32,
                fill: '#b45309',
                backgroundColor: 'rgba(255,255,255,0)',
                enterEditing: false,
            },
            defaultDrawConfig: {
                color: '#b45309',
                brushSize: 8,
                opacity: 0.92,
            },
            defaultEraserConfig: {
                brushSize: 18,
                previewStroke: '#7c2d12',
                previewFill: 'rgba(255,255,255,0.35)',
            },
            defaultShapeConfig: {
                shape: 'rect',
                stroke: '#b45309',
                strokeWidth: 4,
                fill: 'rgba(245,158,11,0.16)',
                arrowHeadLength: 20,
            },
            defaultMosaicConfig: {
                brushSize: 48,
                blockSize: 10,
                previewStroke: '#0f766e',
                previewStrokeWidth: 2,
                outputFileType: 'png',
            },
            crop: {
                aspectRatio: 'free',
                padding: 18,
                minWidth: 60,
                minHeight: 60,
                exportFileType: 'png',
            },
            onImageChanged(state, context) {
                recordOperation(context);
                updateDemoUi(state);
            },
            onBusyChange(isBusy, context) {
                void isBusy;
                recordOperation(context);
                updateDemoUi();
            },
            onMasksChanged(masks, context) {
                void masks;
                recordOperation(context);
                updateDemoUi();
            },
            onAnnotationsChanged(annotations, context) {
                void annotations;
                recordOperation(context);
                updateDemoUi();
            },
            onSelectionChange(selection, context) {
                void selection;
                recordOperation(context);
                updateDemoUi();
            },
            onToolModeChange(activeToolMode, previousToolMode, context) {
                void activeToolMode;
                void previousToolMode;
                recordOperation(context);
                updateDemoUi();
            },
            onHistoryChange(history, context) {
                void history;
                recordOperation(context);
                updateDemoUi();
            },
            onError(error, message) {
                showMessage(message || error || 'Image editor operation failed.', 'error');
            },
            onWarning(error, message) {
                void error;
                showMessage(message || 'Image editor warning.', 'error');
            },
        });

        demoState.editor.init({
            canvas: 'canvas',
            canvasContainer: 'canvasContainer',
            imagePlaceholder: 'imagePlaceholder',
            ...Object.fromEntries(
                editorTargetIds.map((id) => [id, getOptionalElement(id) ? id : null]),
            ),
            createMaskButton: null,
            createShapeAnnotationButton: null,
            downloadImageButton: null,
            imageInput: null,
            uploadArea: null,
        });

        updateDemoUi();
    }

    function isDemoBusy() {
        return demoState.isLoading || !!demoState.editor?.isBusy();
    }

    function setLayoutModeFromControl() {
        const select = getOptionalElement('layoutModeSelect');
        if (!demoState.editor || !select || !select.value) return;
        demoState.editor.setLayoutMode(select.value);
    }

    function updateDemoUi(state) {
        const editor = demoState.editor;
        const nextState = state || editor?.getEditorState() || null;
        const selection = editor?.getSelection() || null;
        const mosaicConfig = editor?.getMosaicConfig?.() || null;
        const hasImage = !!nextState?.hasImage;
        const activeToolMode = nextState?.activeToolMode || null;
        const busy = isDemoBusy();
        const canLoad = !!editor && !busy && activeToolMode === null;
        const canUseIdleImage = !!editor && hasImage && !busy && activeToolMode === null;
        const canUseImageFilters = canUseIdleImage;
        const canUseShapeConfig =
            !!editor && hasImage && (activeToolMode === null || activeToolMode === 'shape');
        const canUseDrawSubMode = !!editor && hasImage && activeToolMode === 'draw';
        const selectedAnnotation = selection?.selectedAnnotation || null;
        const drawSubMode = editor?.getDrawSubMode?.() || null;
        const eraserConfig = editor?.getEraserConfig?.() || null;

        setText('statusImage', hasImage ? 'Loaded' : 'Empty');
        setText(
            'statusScale',
            nextState ? `${Math.round((nextState.currentScale || 1) * 100)}%` : '100%',
        );
        setText(
            'statusRotation',
            nextState ? `${Math.round(nextState.currentRotation || 0)} deg` : '0 deg',
        );
        setText('statusFlipX', nextState?.isFlippedHorizontally ? 'Yes' : 'No');
        setText('statusFlipY', nextState?.isFlippedVertically ? 'Yes' : 'No');
        setText('statusTool', activeToolMode || 'None');
        setText('statusUndo', nextState?.canUndo ? 'Yes' : 'No');
        setText('statusRedo', nextState?.canRedo ? 'Yes' : 'No');
        setText('statusMasks', String(nextState?.maskCount || 0));
        setText('statusAnnotations', String(nextState?.annotationCount || 0));
        setText(
            'statusMosaic',
            mosaicConfig
                ? `${mosaicConfig.brushSize}px / ${mosaicConfig.blockSize}px`
                : '48px / 10px',
        );
        setText('statusSelection', describeSelection(selection));

        setDisabled('loadSampleButton', !canLoad);
        setDisabled('imageInput', !canLoad);
        setDisabled('layoutModeSelect', !canLoad);
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
        setDisabled('toggleAnnotationHiddenButton', !selectedAnnotation || busy);
        setDisabled('toggleAnnotationLockedButton', !selectedAnnotation || busy);
        setDisabled('exportImageButton', !canUseIdleImage);
        setDisabled('downloadExportButton', !canUseIdleImage);
        syncImageFilterControls(editor?.getImageFilterConfig?.() || null);
        if (eraserConfig) setControlValue('eraserBrushSizeInput', eraserConfig.brushSize);

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

        setText(
            'annotationVisibilityState',
            selectedAnnotation
                ? selectedAnnotation.annotationHidden
                    ? 'Hidden'
                    : 'Visible'
                : 'No selection',
        );
        setText(
            'annotationLockState',
            selectedAnnotation
                ? selectedAnnotation.annotationLocked
                    ? 'Locked'
                    : 'Unlocked'
                : 'No selection',
        );
    }

    function describeSelection(selection) {
        if (!selection || !selection.selectedObjectKind) return 'None';
        if (selection.selectedMask) return `Mask ${selection.selectedMask.maskId}`;
        if (selection.selectedAnnotation) {
            return `${selection.selectedAnnotation.annotationName} (${selection.selectedAnnotation.annotationType})`;
        }
        return selection.selectedObjectKind;
    }

    function setImageFilterControlsDisabled(disabled) {
        imageFilterControlIds.forEach((id) => setDisabled(id, disabled));
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

    function syncImageFilterControls(config) {
        if (!config || !getOptionalElement('imageBrightnessInput')) return;
        setControlValue('imageBrightnessInput', config.brightness);
        setControlValue('imageContrastInput', config.contrast);
        setControlValue('imageSaturationInput', config.saturation);
        setControlValue('imageBlurInput', config.blur);
        setControlValue('imageSharpenInput', config.sharpen);
        setControlChecked('imageGrayscaleInput', config.grayscale);
        setControlChecked('imageSepiaInput', config.sepia);
        setControlChecked('imageVintageInput', config.vintage);
    }

    function previewImageFilters() {
        const editor = demoState.editor;
        if (!editor || !editor.isImageLoaded() || isDemoBusy()) return;
        editor.setImageFilterConfig(readImageFilterConfigFromControls());
        updateDemoUi();
    }

    function commitImageFilters() {
        const editor = demoState.editor;
        if (!editor || !editor.isImageLoaded() || isDemoBusy()) return;
        editor.commitImageFilters();
        showMessage('Image filters applied.', 'success');
        updateDemoUi();
    }

    function resetImageFilterPreview() {
        const editor = demoState.editor;
        if (!editor || !editor.isImageLoaded() || isDemoBusy()) return;
        editor.resetImageFilterConfig();
        syncImageFilterControls(editor.getImageFilterConfig());
        showMessage('Filter preview reset.', 'success');
        updateDemoUi();
    }

    function clearImageFilters() {
        const editor = demoState.editor;
        if (!editor || !editor.isImageLoaded() || isDemoBusy()) return;
        editor.clearImageFilters();
        syncImageFilterControls(editor.getImageFilterConfig());
        showMessage('Image filters cleared.', 'success');
        updateDemoUi();
    }

    function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                if (typeof reader.result === 'string') resolve(reader.result);
                else reject(new Error('The selected file could not be read.'));
            };
            reader.onerror = () =>
                reject(reader.error || new Error('The selected file could not be read.'));
            reader.readAsDataURL(file);
        });
    }

    async function loadDataUrl(dataUrl, successMessage) {
        if (!demoState.editor || isDemoBusy()) return;
        clearMessage();
        setLayoutModeFromControl();
        demoState.isLoading = true;
        updateDemoUi();
        try {
            await demoState.editor.loadImage(dataUrl);
            if (demoState.editor.isImageLoaded()) {
                showMessage(successMessage || 'Image loaded.', 'success');
            } else {
                showMessage('Unsupported image format. Use PNG, JPEG, or WebP.', 'error');
            }
        } catch (error) {
            showMessage(error, 'error');
        } finally {
            demoState.isLoading = false;
            updateDemoUi();
        }
    }

    async function loadSample() {
        await loadDataUrl(createSampleDataUrl(pageName), 'Sample image loaded.');
        if (isTransformBindingPage && demoState.editor?.isImageLoaded()) {
            createTransformBindingSampleOverlays();
        }
    }

    function createTransformBindingSampleOverlays() {
        const editor = demoState.editor;
        if (!editor || !editor.isImageLoaded()) return;

        editor.createMask({
            ...maskShapeBase,
            styles: { ...maskShapeBase.styles },
            shape: 'rect',
            left: '13%',
            top: '31%',
            width: '25%',
            height: '13%',
            angle: -4,
        });
        editor.createMask({
            ...maskShapeBase,
            styles: { ...maskShapeBase.styles },
            shape: 'ellipse',
            left: '62%',
            top: '52%',
            width: '21%',
            height: '15%',
            angle: 9,
        });
        editor.createTextAnnotation({
            text: 'Readable text',
            left: '45%',
            top: '18%',
            width: 260,
            fontSize: 30,
            fill: '#b45309',
            backgroundColor: 'rgba(255,255,255,0.78)',
            enterEditing: false,
        });
        editor.createShapeAnnotation({
            shape: 'arrow',
            x1: '24%',
            y1: '69%',
            x2: '62%',
            y2: '57%',
            stroke: '#b45309',
            strokeWidth: 5,
            arrowHeadLength: 22,
        });
        showMessage('Sample loaded with two masks and two annotations.', 'success');
        updateDemoUi();
    }

    async function handleFileInputChange(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        try {
            await loadDataUrl(await readFileAsDataUrl(file), `${file.name} loaded.`);
        } finally {
            event.target.value = '';
        }
    }

    function createTextAnnotation() {
        const editor = demoState.editor;
        if (!editor || !editor.isImageLoaded() || isDemoBusy()) return;
        const textInput = getOptionalElement('textValueInput');
        const colorInput = getOptionalElement('textColorInput');
        const sizeInput = getOptionalElement('textFontSizeInput');
        const fontSize = Number(sizeInput?.value || 32);

        editor.createTextAnnotation({
            text: textInput?.value || 'Review note',
            fill: colorInput?.value || '#b45309',
            fontSize: Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 32,
            left: '14%',
            top: '16%',
            width: 280,
            enterEditing: false,
        });
        showMessage('Text annotation created.', 'success');
        updateDemoUi();
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
            shape: kind,
            stroke: getOptionalElement('shapeStrokeInput')?.value || '#b45309',
            strokeWidth: Math.max(1, strokeWidth),
            fill: kind === 'rect' ? hexToRgba(fillColor, 0.16) : 'rgba(0,0,0,0)',
            arrowHeadLength: 20,
        };
    }

    function buildShapeAnnotationConfig() {
        const style = readShapeStyleConfig();
        if (style.shape === 'line') {
            return {
                ...style,
                x1: '18%',
                y1: '42%',
                x2: '66%',
                y2: '34%',
            };
        }
        if (style.shape === 'arrow') {
            return {
                ...style,
                x1: '20%',
                y1: '56%',
                x2: '70%',
                y2: '40%',
            };
        }
        return {
            ...style,
            left: '22%',
            top: '24%',
            width: 210,
            height: 120,
        };
    }

    function syncShapeConfigFromControls() {
        const editor = demoState.editor;
        if (!editor || !editor.isImageLoaded()) return;
        const activeToolMode = editor.getActiveToolMode?.() || null;
        if (activeToolMode !== null && activeToolMode !== 'shape') return;
        editor.setShapeConfig(readShapeStyleConfig());
        updateDemoUi();
    }

    function createShapeAnnotation() {
        const editor = demoState.editor;
        if (!editor || !editor.isImageLoaded() || isDemoBusy()) return;
        syncShapeConfigFromControls();
        const shape = editor.createShapeAnnotation(buildShapeAnnotationConfig());
        if (shape) showMessage('Shape annotation created.', 'success');
        updateDemoUi();
    }

    function enterShapeMode() {
        const editor = demoState.editor;
        if (!editor || !editor.isImageLoaded() || isDemoBusy()) return;
        syncShapeConfigFromControls();
        editor.enterShapeMode(readShapeKind());
        showMessage('Shape mode active.', 'success');
        updateDemoUi();
    }

    function exitShapeMode() {
        const editor = demoState.editor;
        if (!editor || editor.getActiveToolMode?.() !== 'shape') return;
        editor.exitShapeMode();
        showMessage('Shape mode exited.', 'success');
        updateDemoUi();
    }

    function setDrawSubMode(mode) {
        const editor = demoState.editor;
        if (!editor || editor.getActiveToolMode?.() !== 'draw') return;
        editor.setDrawSubMode(mode);
        showMessage(mode === 'erase' ? 'Draw eraser active.' : 'Draw brush active.', 'success');
        updateDemoUi();
    }

    function updateEraserConfigFromControls() {
        const editor = demoState.editor;
        if (!editor || !editor.isImageLoaded()) return;
        const activeToolMode = editor.getActiveToolMode?.() || null;
        if (activeToolMode !== null && activeToolMode !== 'draw') return;
        editor.setEraserConfig({
            brushSize: Math.max(1, readNumberControl('eraserBrushSizeInput', 18)),
        });
        updateDemoUi();
    }

    function getSelectedOrFirstAnnotation() {
        const editor = demoState.editor;
        if (!editor) return null;
        const selected = editor.getSelection().selectedAnnotation;
        return selected || editor.getAnnotations()[0] || null;
    }

    function toggleAnnotationFlag(flag, trueMessage, falseMessage) {
        const editor = demoState.editor;
        const annotation = getSelectedOrFirstAnnotation();
        if (!editor || !annotation || isDemoBusy()) return;
        editor.updateAnnotation(annotation.annotationId, {
            [flag]: !annotation[flag],
        });
        showMessage(annotation[flag] ? trueMessage : falseMessage, 'success');
        updateDemoUi();
    }

    function toggleAnnotationHidden() {
        toggleAnnotationFlag('annotationHidden', 'Annotation hidden.', 'Annotation shown.');
    }

    function toggleAnnotationLocked() {
        toggleAnnotationFlag('annotationLocked', 'Annotation locked.', 'Annotation unlocked.');
    }

    function getMaskShapeConfig(shape) {
        return {
            ...maskShapeBase,
            styles: { ...maskShapeBase.styles },
            ...(maskShapeConfigs[shape] || maskShapeConfigs.rect),
        };
    }

    function createMask(shape) {
        const editor = demoState.editor;
        if (!editor || !editor.isImageLoaded() || isDemoBusy()) return;
        const select = getOptionalElement('maskShapeSelect');
        const nextShape = shape || select?.value || 'rect';
        editor.createMask(getMaskShapeConfig(nextShape));
        showMessage(`${nextShape} mask created.`, 'success');
        updateDemoUi();
    }

    function createPresetMask(preset) {
        const editor = demoState.editor;
        if (!editor || !editor.isImageLoaded() || isDemoBusy()) return;
        editor.createMask(privacyMaskPresets[preset] || privacyMaskPresets.identity);
        showMessage('Redaction mask created.', 'success');
        updateDemoUi();
    }

    function getExportOptions() {
        const formatSelect = getOptionalElement('exportFormatSelect');
        const qualityInput = getOptionalElement('exportQualityInput');
        const quality = Number(qualityInput?.value || 0.92);
        return {
            fileType: formatSelect?.value || 'png',
            quality: Number.isFinite(quality) ? quality : 0.92,
            mergeMasks: getOptionalElement('exportMasksInput')?.checked !== false,
            mergeAnnotations: getOptionalElement('exportAnnotationsInput')?.checked !== false,
            fileName: `image-editor-${pageName}`,
        };
    }

    async function exportImage() {
        const editor = demoState.editor;
        if (!editor || !editor.isImageLoaded() || isDemoBusy()) return;
        clearMessage();
        try {
            const options = getExportOptions();
            const dataUrl = await editor.exportImageBase64(options);
            const preview = getOptionalElement('exportPreview');
            const link = getOptionalElement('exportDownloadLink');
            if (preview) preview.src = dataUrl;
            if (link) {
                link.href = dataUrl;
                link.download = `image-editor-${pageName}.${options.fileType === 'jpeg' ? 'jpg' : options.fileType}`;
            }
            setText('exportSummary', summarizeDataUrl(dataUrl));
            showMessage('Export completed.', 'success');
        } catch (error) {
            showMessage(error, 'error');
        } finally {
            updateDemoUi();
        }
    }

    async function downloadExport() {
        const editor = demoState.editor;
        if (!editor || !editor.isImageLoaded() || isDemoBusy()) return;
        try {
            await editor.downloadImage(getExportOptions());
            showMessage('Download started.', 'success');
        } catch (error) {
            showMessage(error, 'error');
        }
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

    function bindControls() {
        [
            ['loadSampleButton', 'click', loadSample],
            ['imageInput', 'change', handleFileInputChange],
            ['layoutModeSelect', 'change', setLayoutModeFromControl],
            ['createTextAnnotationButton', 'click', createTextAnnotation],
            ['applyImageFiltersButton', 'click', commitImageFilters],
            ['resetImageFiltersButton', 'click', resetImageFilterPreview],
            ['clearImageFiltersButton', 'click', clearImageFilters],
            ['createShapeAnnotationButton', 'click', createShapeAnnotation],
            ['enterShapeModeButton', 'click', enterShapeMode],
            ['exitShapeModeButton', 'click', exitShapeMode],
            ['drawBrushSubModeButton', 'click', () => setDrawSubMode('brush')],
            ['drawEraseSubModeButton', 'click', () => setDrawSubMode('erase')],
            ['toggleAnnotationHiddenButton', 'click', toggleAnnotationHidden],
            ['toggleAnnotationLockedButton', 'click', toggleAnnotationLocked],
            ['exportImageButton', 'click', exportImage],
            ['downloadExportButton', 'click', downloadExport],
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

        getOptionalElement('createMaskButton')?.addEventListener('click', () => createMask());
        document.querySelectorAll('[data-mask-preset]').forEach((button) => {
            button.addEventListener('click', () => createPresetMask(button.dataset.maskPreset));
        });
    }

    function createSampleDataUrl(kind) {
        const { canvas, context } = demoRuntime.createCanvas(960, 620);
        if (kind === 'annotation') drawAnnotationSample(context);
        else if (kind === 'mask-mosaic') drawPrivacySample(context);
        else if (kind === 'transform-binding') drawTransformBindingSample(context);
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
        context.fillText('Upload, transform, crop, and export from one public API.', 108, 454);
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

    function drawTransformBindingSample(context) {
        fillBackground(context, '#eef4ff');
        demoRuntime.drawPanel(context, 58, 48, 844, 524, '#ffffff');

        context.fillStyle = '#0f172a';
        context.font = '700 30px Arial';
        context.fillText('Overlay Transform Binding Test Board', 98, 112);
        context.fillStyle = '#64748b';
        context.font = '17px Arial';
        context.fillText(
            'Scale, rotate, flip, and reset while overlays stay on image content.',
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

    function init() {
        try {
            getRequiredElement('canvas');
            bindControls();
            initEditor();
        } catch (error) {
            showMessage(error, 'error');
            console.error(error);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
