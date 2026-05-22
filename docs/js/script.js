let editor = null;

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
        reset: 'Reset',
        undo: 'Undo',
        redo: 'Redo',
        createMask: 'Create Mask',
        removeMask: 'Remove',
        removeAllMasks: 'Remove All',
        crop: 'Crop',
        apply: 'Apply',
        cancel: 'Cancel',
        merge: 'Merge',
        download: 'Download',
        consoleBase64: 'Console Base64',
        maskList: 'Mask list',
        noImageLoaded: 'No image loaded',
        darkMode: 'Dark mode',
        legacyDemo: 'Legacy v1 demo',
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
        reset: '重置',
        undo: '撤销',
        redo: '重做',
        createMask: '创建遮罩',
        removeMask: '移除',
        removeAllMasks: '全部移除',
        crop: '裁剪',
        apply: '应用',
        cancel: '取消',
        merge: '合并',
        download: '下载',
        consoleBase64: '输出 Base64',
        maskList: '遮罩列表',
        noImageLoaded: '尚未加载图片',
        darkMode: '深色模式',
        legacyDemo: '旧版 v1 演示',
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
        reset: 'リセット',
        undo: '元に戻す',
        redo: 'やり直す',
        createMask: 'マスク作成',
        removeMask: '削除',
        removeAllMasks: 'すべて削除',
        crop: '切り抜き',
        apply: '適用',
        cancel: 'キャンセル',
        merge: '結合',
        download: 'ダウンロード',
        consoleBase64: 'Base64 出力',
        maskList: 'マスクリスト',
        noImageLoaded: '画像が読み込まれていません',
        darkMode: 'ダークモード',
        legacyDemo: '旧 v1 デモ',
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
        reset: '초기화',
        undo: '실행 취소',
        redo: '다시 실행',
        createMask: '마스크 생성',
        removeMask: '삭제',
        removeAllMasks: '전체 삭제',
        crop: '자르기',
        apply: '적용',
        cancel: '취소',
        merge: '병합',
        download: '다운로드',
        consoleBase64: 'Base64 출력',
        maskList: '마스크 목록',
        noImageLoaded: '이미지가 없습니다',
        darkMode: '다크 모드',
        legacyDemo: '이전 v1 데모',
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
        reset: 'Réinitialiser',
        undo: 'Annuler',
        redo: 'Rétablir',
        createMask: 'Créer un masque',
        removeMask: 'Supprimer',
        removeAllMasks: 'Tout supprimer',
        crop: 'Recadrer',
        apply: 'Appliquer',
        cancel: 'Annuler',
        merge: 'Fusionner',
        download: 'Télécharger',
        consoleBase64: 'Afficher Base64',
        maskList: 'Liste des masques',
        noImageLoaded: 'Aucune image chargée',
        darkMode: 'Mode sombre',
        legacyDemo: 'Démo v1 historique',
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
        reset: 'Restablecer',
        undo: 'Deshacer',
        redo: 'Rehacer',
        createMask: 'Crear máscara',
        removeMask: 'Eliminar',
        removeAllMasks: 'Eliminar todo',
        crop: 'Recortar',
        apply: 'Aplicar',
        cancel: 'Cancelar',
        merge: 'Fusionar',
        download: 'Descargar',
        consoleBase64: 'Mostrar Base64',
        maskList: 'Lista de máscaras',
        noImageLoaded: 'No hay imagen cargada',
        darkMode: 'Modo oscuro',
        legacyDemo: 'Demo v1 anterior',
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

function getStoredValue(key) {
    try {
        return window.localStorage.getItem(key);
    } catch (error) {
        return null;
    }
}

function setStoredValue(key, value) {
    try {
        window.localStorage.setItem(key, value);
    } catch (error) {
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

    const darkModeToggleElement = document.getElementById('darkModeToggle');
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
    if (editor || typeof window.ImageEditor !== 'function') return;

    editor = new window.ImageEditor({
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
    const fitImageRadio = document.getElementById('fitImage');
    const coverCanvasRadio = document.getElementById('coverCanvas');
    const expandCanvasRadio = document.getElementById('expandCanvas');
    if (fitImageRadio.checked) {
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

function canLoadImage() {
    return !!editor && !editor.isAnimating && !editor._cropMode;
}

function updateDemoControls() {
    const hasLoadedImage = !!editor && typeof editor.isImageLoaded === 'function' && editor.isImageLoaded();
    const isBusy = !!editor && (editor.isAnimating || editor._cropMode);
    const addMaskButtonElement = document.getElementById('addMaskBtn');
    const maskShapeSelectElement = document.getElementById('maskShapeSelect');
    const loadButtonElement = document.getElementById('loadBtn');

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
    window.setTimeout(updateDemoControls, 0);
    window.setTimeout(updateDemoControls, 350);
}

function getSelectedMaskConfig() {
    const selectedShape = document.getElementById('maskShapeSelect')?.value || 'rect';
    return { ...(maskShapeConfigs[selectedShape] || maskShapeConfigs.rect) };
}

function handleAddMaskButtonClick() {
    if (!editor || editor.isAnimating || editor._cropMode) return;
    editor.createMask(getSelectedMaskConfig());
    updateDemoControls();
}

function loadFile(file) {
    if (!file || !canLoadImage()) return;

    setOptions();
    const reader = new FileReader();
    reader.onload = function(loadEvent) {
        const imageBase64 = loadEvent.target.result;
        editor.loadImage(imageBase64).finally(updateDemoControls);
    };
    reader.readAsDataURL(file);
}

function handleLoadButtonClick() {
    if (!canLoadImage()) return;

    setOptions();
    const imageBase64 = document.getElementById('base64Input')?.value || '';
    editor.loadImage(imageBase64).finally(updateDemoControls);
}

function handleImageInputChange(event) {
    loadFile(event.target.files[0]);
}

function handleUploadAreaClick() {
    if (!canLoadImage()) return;

    imageInputElement?.click();
}

function handleUploadAreaDrop(event) {
    event.preventDefault();
    uploadAreaElement.classList.remove('dragover');
    if (!canLoadImage()) return;

    loadFile(event.dataTransfer.files[0]);
}

function handleUploadAreaDragOver(event) {
    event.preventDefault();
    if (!canLoadImage()) return;

    uploadAreaElement.classList.add('dragover');
}

function handleUploadAreaDragLeave() {
    uploadAreaElement.classList.remove('dragover');
}

const loadButtonElement = document.getElementById('loadBtn');
if (loadButtonElement) {
    loadButtonElement.addEventListener('click', handleLoadButtonClick);
}

const addMaskButtonElement = document.getElementById('addMaskBtn');
if (addMaskButtonElement) {
    addMaskButtonElement.addEventListener('click', handleAddMaskButtonClick);
}

['cropBtn', 'applyCropBtn', 'cancelCropBtn'].forEach(function(buttonId) {
    document.getElementById(buttonId)?.addEventListener('click', scheduleDemoControlUpdate);
});

const imageInputElement = document.getElementById('imageInput');
if (imageInputElement) {
    imageInputElement.addEventListener('change', handleImageInputChange);
}

const uploadAreaElement = document.getElementById('uploadArea');
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

const darkModeToggleElement = document.getElementById('darkModeToggle');
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
    try {
        const imageBase64 = await editor.exportImageBase64();
        console.log(imageBase64);
    } catch (error) {
        console.error(error);
    }
}
