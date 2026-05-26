let editor = null;
// Demo-local busy flag covering operations the demo itself drives
// (image loads). The editor manages its own toolbar disabled-state during
// animations and crop sessions through the IDs passed to `init`.
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
        maskShapeRect: 'Rect',
        maskShapeCircle: 'Circle',
        maskShapeEllipse: 'Ellipse',
        maskShapePolygon: 'Polygon'
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
        maskShapeRect: '矩形',
        maskShapeCircle: '圆形',
        maskShapeEllipse: '椭圆',
        maskShapePolygon: '多边形'
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
        maskShapeRect: '長方形',
        maskShapeCircle: '円',
        maskShapeEllipse: '楕円',
        maskShapePolygon: '多角形'
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
        maskShapeRect: '사각형',
        maskShapeCircle: '원',
        maskShapeEllipse: '타원',
        maskShapePolygon: '다각형'
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
        maskShapeRect: 'Rectangle',
        maskShapeCircle: 'Cercle',
        maskShapeEllipse: 'Ellipse',
        maskShapePolygon: 'Polygone'
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
        maskShapeRect: 'Rectángulo',
        maskShapeCircle: 'Círculo',
        maskShapeEllipse: 'Elipse',
        maskShapePolygon: 'Polígono'
    }
};

const maskShapeConfigs = {
    rect: { shape: 'rect' },
    circle: { shape: 'circle' },
    ellipse: { shape: 'ellipse' },
    polygon: { shape: 'polygon', points: [[0, 0], [80, 0], [40, 64]] }
};

function getOptionalElement(id) {
    return document.getElementById(id);
}

function getErrorMessage(error) {
    return error && error.message ? error.message : 'Image operation failed';
}

function showDemoError(error) {
    const demoErrorElement = getOptionalElement('demoError');
    if (!demoErrorElement) return;
    demoErrorElement.textContent = getErrorMessage(error);
    demoErrorElement.hidden = false;
}

function clearDemoError() {
    const demoErrorElement = getOptionalElement('demoError');
    if (!demoErrorElement) return;
    demoErrorElement.textContent = '';
    demoErrorElement.hidden = true;
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
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getInitialTheme() {
    const storedTheme = getStoredValue('imageEditorDemoTheme');
    return storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : getSystemTheme();
}

function applyLanguage(language) {
    const nextLanguage = supportedLanguages.includes(language) ? language : defaultLanguage;
    const languageTranslations = translations[nextLanguage];
    document.documentElement.lang = nextLanguage;

    document.querySelectorAll('[data-i18n]').forEach(function(element) {
        const translationKey = element.dataset.i18n;
        if (languageTranslations[translationKey]) {
            element.textContent = languageTranslations[translationKey];
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(function(element) {
        const translationKey = element.dataset.i18nPlaceholder;
        if (languageTranslations[translationKey]) {
            element.setAttribute('placeholder', languageTranslations[translationKey]);
        }
    });

    const darkModeToggleElement = getOptionalElement('darkModeToggle');
    if (darkModeToggleElement) {
        darkModeToggleElement.setAttribute('aria-label', languageTranslations.darkMode);
        darkModeToggleElement.closest('.theme-switch')?.setAttribute('title', languageTranslations.darkMode);
    }

    document.querySelectorAll('.language-button').forEach(function(buttonElement) {
        buttonElement.classList.toggle('active', buttonElement.dataset.language === nextLanguage);
    });

    setStoredValue('imageEditorDemoLanguage', nextLanguage);
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
        console.error('ImageEditor constructor not found. Make sure the UMD bundle is loaded before this script.');
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
        exportImageAreaByDefault: true
    });
    editor.init({
        canvas: 'fabricCanvas',
        imgPlaceholder: 'imgPlaceholder',
        scaleRate: 'scaleRate',
        rotateLeftBtn: 'rotateLeftBtn',
        rotateRightBtn: 'rotateRightBtn',
        rotationLeftInput: 'leftValue',
        rotationRightInput: 'rightValue',
        // The demo binds its own Create Mask button so the shape selector
        // is honored. Setting the ID to `null` tells the editor to skip
        // the default click binding.
        addMaskBtn: null,
        removeMaskBtn: 'removeMaskBtn',
        removeAllMasksBtn: 'removeAllMasksBtn',
        mergeBtn: 'mergeBtn',
        downloadBtn: 'downloadBtn',
        maskList: 'maskList',
        cropBtn: 'cropBtn',
        applyCropBtn: 'applyCropBtn',
        cancelCropBtn: 'cancelCropBtn',
        canvasContainer: null,
        imageInput: null,
        uploadArea: null
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
    } else if (coverCanvasRadio.checked) {
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

function canLoadImage() {
    // Only refuse to start a new load while a previous demo-driven load
    // is still in flight. The editor itself rejects concurrent loads
    // during animations, so we do not duplicate that check here.
    return !!editor && !demoLoading;
}

function updateDemoControls() {
    const hasLoadedImage = isEditorReady() && editor.isImageLoaded();
    const addMaskButtonElement = getOptionalElement('addMaskBtn');
    const maskShapeSelectElement = getOptionalElement('maskShapeSelect');
    const loadButtonElement = getOptionalElement('loadBtn');

    if (addMaskButtonElement) addMaskButtonElement.disabled = !hasLoadedImage || demoLoading;
    if (maskShapeSelectElement) maskShapeSelectElement.disabled = demoLoading;
    if (loadButtonElement) loadButtonElement.disabled = demoLoading;
    if (imageInputElement) imageInputElement.disabled = demoLoading;
    if (uploadAreaElement) {
        uploadAreaElement.classList.toggle('disabled', demoLoading);
        uploadAreaElement.setAttribute('aria-disabled', demoLoading ? 'true' : 'false');
    }
}

function scheduleDemoControlUpdate() {
    window.setTimeout(updateDemoControls, 0);
    window.setTimeout(updateDemoControls, 350);
}

function getSelectedMaskConfig() {
    const selectedShape = getOptionalElement('maskShapeSelect')?.value || 'rect';
    return { ...(maskShapeConfigs[selectedShape] || maskShapeConfigs.rect) };
}

function handleAddMaskButtonClick() {
    if (!editor || !editor.isImageLoaded()) return;
    // `createMask` is the canonical v2 entry point; it returns the new
    // mask object or `null`. The editor handles its own animation guard.
    editor.createMask(getSelectedMaskConfig());
    updateDemoControls();
}

function loadFile(file) {
    if (!file || !canLoadImage()) return Promise.resolve();

    clearDemoError();
    setOptions();
    demoLoading = true;
    updateDemoControls();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(loadEvent) {
            const imageBase64 = loadEvent.target.result;
            editor.loadImage(imageBase64)
                .then(resolve)
                .catch(reject);
        };
        reader.onerror = () => reject(new Error('Image file could not be read'));
        reader.readAsDataURL(file);
    }).catch(function(error) {
        showDemoError(error);
        console.error(error);
    }).finally(function() {
        demoLoading = false;
        updateDemoControls();
    });
}

function handleLoadButtonClick() {
    if (!canLoadImage()) return;

    clearDemoError();
    setOptions();
    const imageBase64 = getOptionalElement('base64Input')?.value || '';
    demoLoading = true;
    updateDemoControls();
    editor.loadImage(imageBase64)
        .catch(function(error) {
            showDemoError(error);
            console.error(error);
        })
        .finally(function() {
            demoLoading = false;
            updateDemoControls();
        });
}

function handleImageInputChange(event) {
    loadFile(event.target.files[0]).finally(function() {
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

    loadFile(event.dataTransfer.files[0]);
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

const loadButtonElement = getOptionalElement('loadBtn');
if (loadButtonElement) {
    loadButtonElement.addEventListener('click', handleLoadButtonClick);
}

const addMaskButtonElement = getOptionalElement('addMaskBtn');
if (addMaskButtonElement) {
    addMaskButtonElement.addEventListener('click', handleAddMaskButtonClick);
}

['cropBtn', 'applyCropBtn', 'cancelCropBtn'].forEach(function(buttonId) {
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

document.querySelectorAll('.language-button').forEach(function(buttonElement) {
    buttonElement.addEventListener('click', function() {
        applyLanguage(buttonElement.dataset.language);
    });
});

const darkModeToggleElement = getOptionalElement('darkModeToggle');
if (darkModeToggleElement) {
    const storedTheme = getStoredValue('imageEditorDemoTheme');
    const isDarkModeEnabled = getInitialTheme() === 'dark';
    darkModeToggleElement.checked = isDarkModeEnabled;
    applyTheme(isDarkModeEnabled, !!storedTheme);
    darkModeToggleElement.addEventListener('change', function(event) {
        applyTheme(event.target.checked);
    });
}

applyLanguage(getInitialLanguage());
updateDemoControls();

if (window.matchMedia) {
    const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    systemThemeQuery.addEventListener('change', function(event) {
        if (getStoredValue('imageEditorDemoTheme')) return;

        const shouldUseDarkMode = event.matches;
        if (darkModeToggleElement) darkModeToggleElement.checked = shouldUseDarkMode;
        applyTheme(shouldUseDarkMode, false);
    });
}

async function getBase64Action() {
    if (!editor) return;
    try {
        // `exportImageBase64` is the canonical v2 export entry point.
        // It resolves to an empty string when no image is loaded, with a
        // console warning emitted by the editor.
        const imageBase64 = await editor.exportImageBase64();
        console.log(imageBase64);
    } catch (error) {
        console.error(error);
    }
}

const base64ButtonElement = getOptionalElement('base64Btn');
if (base64ButtonElement) {
    base64ButtonElement.addEventListener('click', getBase64Action);
}
