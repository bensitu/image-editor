let editor = null;
// Demo-local busy flag covering operations the demo itself drives
// (image loads). The editor manages its own toolbar disabled-state during
// animations and crop sessions through the IDs passed to `init`.
let messagePanel = null;
let demoMessage = null;
let demoLoading = false;

const defaultLanguage = 'en';
const supportedLanguages = ['en', 'zh', 'ja', 'ko', 'fr', 'es'];
const translations = {
    en: {
        appSubtitle: 'Canvas mask, crop, transform, and export demo',
        fitMode: 'Fit',
        coverMode: 'Cover',
        expandMode: 'Expand',
        dropImage: 'Drop image here',
        selectImageHint: 'or click to select JPG, PNG, or WEBP',
        base64Input: 'Base64 input',
        base64Placeholder: 'Paste data:image/jpeg;base64,...',
        loadImage: 'Load',
        resetTransform: 'Reset',
        undo: 'Undo',
        redo: 'Redo',
        createMask: 'Create Mask',
        removeMask: 'Remove',
        removeAllMasks: 'Remove All',
        crop: 'Crop',
        apply: 'Apply',
        cancel: 'Cancel',
        mergeMasks: 'Merge',
        download: 'Download',
        consoleBase64: 'Console Base64',
        maskList: 'Mask list',
        noImageLoaded: 'No image loaded',
        darkMode: 'Dark mode',
        legacyDemo: 'Legacy v1 demo',
        maskShapeRect: 'Rect',
        maskShapeCircle: 'Circle',
        maskShapeEllipse: 'Ellipse',
        maskShapePolygon: 'Polygon',
        defaultErrorMessage: 'Image processing failed',
        errorFileRead: 'Image file could not be read',
        errorEditorNotInitialized: 'Editor is not initialized',
    },
    zh: {
        appSubtitle: '画布遮罩、裁剪、变换与导出演示',
        fitMode: '适应',
        coverMode: '覆盖',
        expandMode: '扩展',
        dropImage: '拖放图片到这里',
        selectImageHint: '或点击选择 JPG、PNG 或 WEBP',
        base64Input: 'Base64 输入',
        base64Placeholder: '粘贴 data:image/jpeg;base64,...',
        loadImage: '加载',
        resetTransform: '重置',
        undo: '撤销',
        redo: '重做',
        createMask: '创建遮罩',
        removeMask: '移除',
        removeAllMasks: '全部移除',
        crop: '裁剪',
        apply: '应用',
        cancel: '取消',
        mergeMasks: '合并',
        download: '下载',
        consoleBase64: '输出 Base64',
        maskList: '遮罩列表',
        noImageLoaded: '尚未加载图片',
        darkMode: '深色模式',
        legacyDemo: '旧版 v1 演示',
        maskShapeRect: '矩形',
        maskShapeCircle: '圆形',
        maskShapeEllipse: '椭圆',
        maskShapePolygon: '多边形',
        defaultErrorMessage: '图像处理失败',
        errorFileRead: '无法读取图片文件',
        errorEditorNotInitialized: '编辑器未初始化',
    },
    ja: {
        appSubtitle: 'キャンバスマスク、切り抜き、変形、書き出しデモ',
        fitMode: 'フィット',
        coverMode: 'カバー',
        expandMode: '拡張',
        dropImage: '画像をここにドロップ',
        selectImageHint: 'またはクリックして JPG、PNG、WEBP を選択',
        base64Input: 'Base64 入力',
        base64Placeholder: 'data:image/jpeg;base64,... を貼り付け',
        loadImage: '読み込み',
        resetTransform: 'リセット',
        undo: '元に戻す',
        redo: 'やり直す',
        createMask: 'マスク作成',
        removeMask: '削除',
        removeAllMasks: 'すべて削除',
        crop: '切り抜き',
        apply: '適用',
        cancel: 'キャンセル',
        mergeMasks: '結合',
        download: 'ダウンロード',
        consoleBase64: 'Base64 出力',
        maskList: 'マスクリスト',
        noImageLoaded: '画像が読み込まれていません',
        darkMode: 'ダークモード',
        legacyDemo: '旧 v1 デモ',
        maskShapeRect: '長方形',
        maskShapeCircle: '円',
        maskShapeEllipse: '楕円',
        maskShapePolygon: '多角形',
        defaultErrorMessage: '画像処理に失敗しました',
        errorFileRead: '画像ファイルを読み込めませんでした',
        errorEditorNotInitialized: 'エディタが初期化されていません',
    },
    ko: {
        appSubtitle: '캔버스 마스크, 자르기, 변형, 내보내기 데모',
        fitMode: '맞춤',
        coverMode: '채우기',
        expandMode: '확장',
        dropImage: '여기에 이미지 놓기',
        selectImageHint: '또는 클릭하여 JPG, PNG, WEBP 선택',
        base64Input: 'Base64 입력',
        base64Placeholder: 'data:image/jpeg;base64,... 붙여넣기',
        loadImage: '불러오기',
        resetTransform: '초기화',
        undo: '실행 취소',
        redo: '다시 실행',
        createMask: '마스크 생성',
        removeMask: '삭제',
        removeAllMasks: '전체 삭제',
        crop: '자르기',
        apply: '적용',
        cancel: '취소',
        mergeMasks: '병합',
        download: '다운로드',
        consoleBase64: 'Base64 출력',
        maskList: '마스크 목록',
        noImageLoaded: '이미지가 없습니다',
        darkMode: '다크 모드',
        legacyDemo: '이전 v1 데모',
        maskShapeRect: '사각형',
        maskShapeCircle: '원',
        maskShapeEllipse: '타원',
        maskShapePolygon: '다각형',
        defaultErrorMessage: '이미지 처리에 실패했습니다',
        errorFileRead: '이미지 파일을 읽을 수 없습니다',
        errorEditorNotInitialized: '에디터가 초기화되지 않았습니다',
    },
    fr: {
        appSubtitle: 'Démo de masques, recadrage, transformation et export canvas',
        fitMode: 'Ajuster',
        coverMode: 'Couvrir',
        expandMode: 'Étendre',
        dropImage: 'Déposez une image ici',
        selectImageHint: 'ou cliquez pour choisir JPG, PNG ou WEBP',
        base64Input: 'Entrée Base64',
        base64Placeholder: 'Collez data:image/jpeg;base64,...',
        loadImage: 'Charger',
        resetTransform: 'Réinitialiser',
        undo: 'Annuler',
        redo: 'Rétablir',
        createMask: 'Créer un masque',
        removeMask: 'Supprimer',
        removeAllMasks: 'Tout supprimer',
        crop: 'Recadrer',
        apply: 'Appliquer',
        cancel: 'Annuler',
        mergeMasks: 'Fusionner',
        download: 'Télécharger',
        consoleBase64: 'Afficher Base64',
        maskList: 'Liste des masques',
        noImageLoaded: 'Aucune image chargée',
        darkMode: 'Mode sombre',
        legacyDemo: 'Démo v1 historique',
        maskShapeRect: 'Rectangle',
        maskShapeCircle: 'Cercle',
        maskShapeEllipse: 'Ellipse',
        maskShapePolygon: 'Polygone',
        defaultErrorMessage: "Échec du traitement de l'image",
        errorFileRead: "Le fichier image n'a pas pu être lu",
        errorEditorNotInitialized: "L'éditeur n'est pas initialisé",
    },
    es: {
        appSubtitle: 'Demo de máscaras, recorte, transformación y exportación en canvas',
        fitMode: 'Ajustar',
        coverMode: 'Cubrir',
        expandMode: 'Expandir',
        dropImage: 'Suelta una imagen aquí',
        selectImageHint: 'o haz clic para elegir JPG, PNG o WEBP',
        base64Input: 'Entrada Base64',
        base64Placeholder: 'Pega data:image/jpeg;base64,...',
        loadImage: 'Cargar',
        resetTransform: 'Restablecer',
        undo: 'Deshacer',
        redo: 'Rehacer',
        createMask: 'Crear máscara',
        removeMask: 'Eliminar',
        removeAllMasks: 'Eliminar todo',
        crop: 'Recortar',
        apply: 'Aplicar',
        cancel: 'Cancelar',
        mergeMasks: 'Fusionar',
        download: 'Descargar',
        consoleBase64: 'Mostrar Base64',
        maskList: 'Lista de máscaras',
        noImageLoaded: 'No hay imagen cargada',
        darkMode: 'Modo oscuro',
        legacyDemo: 'Demo v1 anterior',
        maskShapeRect: 'Rectángulo',
        maskShapeCircle: 'Círculo',
        maskShapeEllipse: 'Elipse',
        maskShapePolygon: 'Polígono',
        defaultErrorMessage: 'Error al procesar la imagen',
        errorFileRead: 'No se pudo leer el archivo de imagen',
        errorEditorNotInitialized: 'El editor no está inicializado',
    },
};

const maskShapeConfigs = {
    rect: { shape: 'rect' },
    circle: { shape: 'circle' },
    ellipse: { shape: 'ellipse' },
    polygon: {
        shape: 'polygon',
        points: [
            [0, 0],
            [80, 0],
            [40, 64],
        ],
    },
};

function getOptionalElement(id) {
    return document.getElementById(id);
}

function getMessage(error) {
    let msg = '';
    if (typeof error === 'string') {
        msg = error;
    } else if (error && typeof error.message === 'string') {
        msg = error.message;
    }
    return msg || getCurrentTranslations('defaultErrorMessage');
}

function getMessageElements() {
    if (!messagePanel) messagePanel = document.getElementById('messagePanel');
    if (!demoMessage) demoMessage = document.getElementById('demoMessage');
    return { panel: messagePanel, message: demoMessage };
}

function showMessage(error) {
    const { panel, message } = getMessageElements();
    if (!panel || !message) {
        console.warn('Message panel elements not found');
        return;
    }
    const text = getMessage(error);
    message.textContent = text;
    message.hidden = false;
    panel.hidden = false;
}

function clearMessage() {
    const { panel, message } = getMessageElements();
    if (!panel || !message) return;
    message.textContent = '';
    message.hidden = true;
    panel.hidden = true;
}

function getStoredValue(key) {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

function setStoredValue(key, value) {
    try {
        window.localStorage.setItem(key, value);
    } catch {
        return null;
    }
}

function getInitialLanguage() {
    const storedLanguage = getStoredValue('imageEditorDemoLanguage');
    if (supportedLanguages.includes(storedLanguage)) return storedLanguage;

    const browserLanguage = (navigator.language || '').slice(0, 2);
    return supportedLanguages.includes(browserLanguage) ? browserLanguage : defaultLanguage;
}

function getSystemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
}

function getInitialTheme() {
    const storedTheme = getStoredValue('imageEditorDemoTheme');
    return storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : getSystemTheme();
}

function applyLanguage(language) {
    const nextLanguage = supportedLanguages.includes(language) ? language : defaultLanguage;
    const languageTranslations = translations[nextLanguage];
    document.documentElement.lang = nextLanguage;

    document.querySelectorAll('[data-i18n]').forEach(function (element) {
        const translationKey = element.dataset.i18n;
        if (languageTranslations[translationKey]) {
            element.textContent = languageTranslations[translationKey];
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (element) {
        const translationKey = element.dataset.i18nPlaceholder;
        if (languageTranslations[translationKey]) {
            element.setAttribute('placeholder', languageTranslations[translationKey]);
        }
    });

    const darkModeToggleElement = getOptionalElement('darkModeToggle');
    if (darkModeToggleElement) {
        darkModeToggleElement.setAttribute('aria-label', languageTranslations.darkMode);
        darkModeToggleElement
            .closest('.theme-switch')
            ?.setAttribute('title', languageTranslations.darkMode);
    }

    document.querySelectorAll('.language-button').forEach(function (buttonElement) {
        buttonElement.classList.toggle('active', buttonElement.dataset.language === nextLanguage);
    });

    setStoredValue('imageEditorDemoLanguage', nextLanguage);
}

function getCurrentTranslations(key) {
    const lang = document.documentElement.lang || defaultLanguage;
    const trans = translations[lang] || translations[defaultLanguage];
    return trans[key] || translations[defaultLanguage][key] || key;
}

function applyTheme(isDarkMode, shouldPersist = true) {
    const theme = isDarkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-bs-theme', theme);
    if (shouldPersist) {
        setStoredValue('imageEditorDemoTheme', theme);
    }
}

function initEditor() {
    // The UMD bundle exposes the constructor on `globalThis.ImageEditor`
    // (Rollup `name: 'ImageEditor'`, `exports: 'named'`). Depending on the
    // host environment, the global may be the bare constructor or a
    // namespace object that re-exports it as `.ImageEditor`.
    const ImageEditorCtor =
        (window.ImageEditor && window.ImageEditor.ImageEditor) ||
        window.ImageEditor ||
        (typeof ImageEditor !== 'undefined' ? ImageEditor : null);
    if (!ImageEditorCtor) {
        console.error(
            'ImageEditor constructor not found. Make sure the UMD bundle is loaded before this script.',
        );
        return;
    }

    // UMD form: when `globalThis.fabric` is present (loaded via the
    // documented `<script>` tag) the constructor reads it automatically.
    editor = new ImageEditorCtor({
        backgroundColor: 'transparent',
        expandCanvasToImage: false,
        fitImageToCanvas: true,
        coverImageToCanvas: false,
        downsampleOnLoad: true,
        initialImageBase64: null,
        maskRotatable: true,
        maskLabelOnSelect: true,
        animationDuration: 100,
        maskLabelOffset: 5,
        showPlaceholder: true,
        exportImageAreaByDefault: true,
    });
    editor.init({
        canvas: 'canvas',
        imagePlaceholder: 'imagePlaceholder',
        scalePercentageInput: 'scalePercentageInput',
        rotateLeftButton: 'rotateLeftButton',
        rotateRightButton: 'rotateRightButton',
        rotateLeftDegreesInput: 'leftValue',
        rotateRightDegreesInput: 'rightValue',
        createMaskButton: null,
        removeSelectedMaskButton: 'removeSelectedMaskButton',
        removeAllMasksButton: 'removeAllMasksButton',
        mergeMasksButton: 'mergeMasksButton',
        downloadImageButton: 'downloadImageButton',
        maskList: 'maskList',
        enterCropModeButton: 'enterCropModeButton',
        applyCropButton: 'applyCropButton',
        cancelCropButton: 'cancelCropButton',
        resetImageTransformButton: 'resetImageTransformButton',
        canvasContainer: null,
        imageInput: null,
        uploadArea: null,
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEditor);
} else {
    initEditor();
}

function setOptions() {
    if (!editor) return;
    const fitImageRadio = getOptionalElement('fitImage');
    const coverCanvasRadio = getOptionalElement('coverCanvas');
    const expandCanvasRadio = getOptionalElement('expandCanvas');
    if (fitImageRadio?.checked || (!coverCanvasRadio?.checked && !expandCanvasRadio?.checked)) {
        editor.options.fitImageToCanvas = true;
        editor.options.coverImageToCanvas = false;
        editor.options.expandCanvasToImage = false;
    } else if (coverCanvasRadio?.checked) {
        editor.options.fitImageToCanvas = false;
        editor.options.coverImageToCanvas = true;
        editor.options.expandCanvasToImage = false;
    } else {
        editor.options.fitImageToCanvas = false;
        editor.options.coverImageToCanvas = false;
        editor.options.expandCanvasToImage = true;
    }
}

function isEditorReady() {
    return !!editor && typeof editor.isImageLoaded === 'function';
}

function isEditorBusy() {
    if (!editor) return false;
    if (demoLoading) return false;
    if (typeof editor.isBusy === 'function') return editor.isBusy();
    return !!editor.isAnimating;
}

function canLoadImage() {
    return !!editor && !isEditorBusy();
}

function updateDemoControls() {
    const hasLoadedImage = isEditorReady() && editor.isImageLoaded();
    const isBusy = isEditorBusy();
    const addMaskButtonElement = getOptionalElement('createMaskButton');
    const maskShapeSelectElement = getOptionalElement('maskShapeSelect');
    const loadButtonElement = getOptionalElement('loadButton');

    if (addMaskButtonElement) addMaskButtonElement.disabled = !hasLoadedImage || isBusy;
    if (maskShapeSelectElement) maskShapeSelectElement.disabled = isBusy;
    if (loadButtonElement) loadButtonElement.disabled = isBusy;
    if (imageInputElement) imageInputElement.disabled = isBusy;
    if (uploadAreaElement) {
        uploadAreaElement.classList.toggle('disabled', isBusy);
        uploadAreaElement.setAttribute('aria-disabled', isBusy ? 'true' : 'false');
    }
}

function scheduleDemoControlUpdate() {
    const animationDuration = Number(editor?.options?.animationDuration);
    const settledDelay =
        Number.isFinite(animationDuration) && animationDuration >= 0 ? animationDuration + 50 : 350;
    window.setTimeout(updateDemoControls, 0);
    window.setTimeout(updateDemoControls, settledDelay);
}

function getSelectedMaskConfig() {
    const selectedShape = getOptionalElement('maskShapeSelect')?.value || 'rect';
    return { ...(maskShapeConfigs[selectedShape] || maskShapeConfigs.rect) };
}

function handleAddMaskButtonClick() {
    if (!editor || !editor.isImageLoaded() || isEditorBusy()) return;
    editor.createMask(getSelectedMaskConfig());
    updateDemoControls();
}

function loadFile(file) {
    if (!file || !canLoadImage()) return Promise.resolve();

    clearMessage();
    setOptions();
    demoLoading = true;
    updateDemoControls();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (loadEvent) {
            const imageBase64 = loadEvent.target.result;
            editor.loadImage(imageBase64).then(resolve).catch(reject);
        };
        reader.onerror = () => reject(new Error(getCurrentTranslations('errorFileRead')));
        reader.readAsDataURL(file);
    })
        .catch(function (error) {
            showMessage(error);
            console.error(error);
        })
        .finally(function () {
            demoLoading = false;
            updateDemoControls();
        });
}

function handleLoadButtonClick() {
    if (!canLoadImage()) return;

    clearMessage();
    setOptions();
    const imageBase64 = getOptionalElement('base64Input')?.value || '';
    demoLoading = true;
    updateDemoControls();
    editor
        .loadImage(imageBase64)
        .then(function () {
            const base64Input = getOptionalElement('base64Input');
            if (base64Input) base64Input.value = '';
        })
        .catch(function (error) {
            showMessage(error);
            console.error(error);
        })
        .finally(function () {
            demoLoading = false;
            updateDemoControls();
        });
}

function handleImageInputChange(event) {
    loadFile(event.target.files[0]).finally(function () {
        event.target.value = '';
    });
}

function handleUploadAreaClick() {
    if (!canLoadImage()) return;

    imageInputElement?.click();
}

function handleUploadAreaDrop(event) {
    event.preventDefault();
    uploadAreaElement?.classList.remove('dragover');
    if (!canLoadImage()) return;

    loadFile(event.dataTransfer?.files?.[0]);
}

function handleUploadAreaDragOver(event) {
    event.preventDefault();
    if (!canLoadImage()) return;

    uploadAreaElement?.classList.add('dragover');
}

function handleUploadAreaDragLeave(event) {
    if (event.relatedTarget && uploadAreaElement?.contains(event.relatedTarget)) return;
    uploadAreaElement?.classList.remove('dragover');
}

const loadButtonElement = getOptionalElement('loadButton');
if (loadButtonElement) {
    loadButtonElement.addEventListener('click', handleLoadButtonClick);
}

const addMaskButtonElement = getOptionalElement('createMaskButton');
if (addMaskButtonElement) {
    addMaskButtonElement.addEventListener('click', handleAddMaskButtonClick);
}

['enterCropModeButton', 'applyCropButton', 'cancelCropButton'].forEach(function (buttonId) {
    getOptionalElement(buttonId)?.addEventListener('click', scheduleDemoControlUpdate);
});

const imageInputElement = getOptionalElement('imageInput');
if (imageInputElement) {
    imageInputElement.addEventListener('change', handleImageInputChange);
}

const uploadAreaElement = getOptionalElement('uploadArea');
if (uploadAreaElement) {
    uploadAreaElement.addEventListener('click', handleUploadAreaClick);
    uploadAreaElement.addEventListener('drop', handleUploadAreaDrop);
    uploadAreaElement.addEventListener('dragover', handleUploadAreaDragOver);
    uploadAreaElement.addEventListener('dragleave', handleUploadAreaDragLeave);
}

document.querySelectorAll('.language-button').forEach(function (buttonElement) {
    buttonElement.addEventListener('click', function () {
        applyLanguage(buttonElement.dataset.language);
    });
});

const darkModeToggleElement = getOptionalElement('darkModeToggle');
if (darkModeToggleElement) {
    const storedTheme = getStoredValue('imageEditorDemoTheme');
    const isDarkModeEnabled = getInitialTheme() === 'dark';
    darkModeToggleElement.checked = isDarkModeEnabled;
    applyTheme(isDarkModeEnabled, !!storedTheme);
    darkModeToggleElement.addEventListener('change', function (event) {
        applyTheme(event.target.checked);
    });
}

applyLanguage(getInitialLanguage());
updateDemoControls();

if (window.matchMedia) {
    const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    systemThemeQuery.addEventListener('change', function (event) {
        if (getStoredValue('imageEditorDemoTheme')) return;

        const shouldUseDarkMode = event.matches;
        if (darkModeToggleElement) darkModeToggleElement.checked = shouldUseDarkMode;
        applyTheme(shouldUseDarkMode, false);
    });
}

async function getBase64Action() {
    if (!editor) {
        showMessage(new Error(getCurrentTranslations('errorEditorNotInitialized')));
        return;
    }
    const hasLoadedImage =
        !!editor && typeof editor.isImageLoaded === 'function' && editor.isImageLoaded();
    if (!hasLoadedImage) {
        showMessage(new Error(getCurrentTranslations('noImageLoaded')));
        return;
    }

    try {
        const imageBase64 = await editor.exportImageBase64();
        showMessage(imageBase64);
    } catch (error) {
        showMessage(error);
        console.error(error);
    }
}

const base64ButtonElement = getOptionalElement('base64Button');
if (base64ButtonElement) {
    base64ButtonElement.addEventListener('click', getBase64Action);
}
