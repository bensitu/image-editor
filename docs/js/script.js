// Demo wiring for the browser/UMD build. This file intentionally shows the
// public ImageEditor API calls a host page would use: construct the editor,
// call `init` with DOM IDs, choose a layout mode, load images, create masks,
// crop/merge/export, and react to lifecycle callbacks.
let editor = null;
// Demo-local busy flag covering operations the demo itself drives
// (image loads). The editor manages its own toolbar disabled-state during
// animations and crop sessions through the IDs passed to `init`.
let messagePanel = null;
let demoMessage = null;
let demoLoading = false;
let currentBase64SummaryDataUrl = '';

const defaultLanguage = 'en';
const supportedLanguages = ['en', 'zh', 'ja', 'ko', 'fr', 'es'];

// UI-only copy. These translations are not part of the image-editor API; they
// keep the demo localized while the API examples below remain language-neutral.
const translations = {
    en: {
        appSubtitle:
            'Canvas image editing demo: annotate, mask, mosaic, crop, transform, and export.',
        legacyDemo: 'Legacy v1 demo',
        demoPreferences: 'Demo preferences',
        imageLoading: 'Image loading',
        imageLayoutMode: 'Image layout mode',
        messages: 'Messages',
        canvasWorkspace: 'Canvas workspace',
        editorControls: 'Editor controls',
        fitMode: 'Fit',
        coverMode: 'Cover',
        expandMode: 'Expand',
        dropImage: 'Drop image here',
        selectImageHint: 'or click to select JPG, PNG, WEBP, GIF, or BMP',
        base64Input: 'Base64 input',
        base64Placeholder: 'Paste data:image/jpeg;base64,...',
        loadImage: 'Load',
        zoomActions: 'Zoom actions',
        scalePercent: 'Scale percent',
        zoomOut: 'Zoom Out',
        zoomIn: 'Zoom In',
        rotationActions: 'Rotation actions',
        rotateLeftDegrees: 'Rotate left degrees',
        rotateRightDegrees: 'Rotate right degrees',
        rotateLeft: 'Rotate Left',
        rotateRight: 'Rotate Right',
        flipHorizontal: 'Flip H',
        flipVertical: 'Flip V',
        historyActions: 'History actions',
        resetTransform: 'Reset',
        undo: 'Undo',
        redo: 'Redo',
        maskActions: 'Mask actions',
        maskShape: 'Mask shape',
        createMask: 'Create Mask',
        removeMask: 'Remove',
        removeAllMasks: 'Remove All',
        cropActions: 'Crop actions',
        cropAspectRatio: 'Crop aspect ratio',
        cropRatioFree: 'Free',
        crop: 'Crop',
        apply: 'Apply',
        cancel: 'Cancel',
        mosaicActions: 'Mosaic actions',
        mosaic: 'Mosaic',
        exitMosaic: 'Exit Mosaic',
        mosaicBrushSize: 'Brush',
        mosaicBlockSize: 'Block',
        annotationActions: 'Annotation actions',
        textTool: 'Text',
        exitText: 'Exit Text',
        textColor: 'Text color',
        textSize: 'Text size',
        drawTool: 'Draw',
        exitDraw: 'Exit Draw',
        drawColor: 'Draw color',
        drawBrushSize: 'Brush',
        removeAnnotation: 'Remove Annotation',
        removeAllAnnotations: 'Remove All Annotations',
        layerActions: 'Layer actions',
        deleteSelection: 'Delete Selection',
        layerForward: 'Forward',
        layerBackward: 'Backward',
        layerToFront: 'To Front',
        layerToBack: 'To Back',
        exportActions: 'Export actions',
        mergeMasks: 'Bake Masks',
        mergeAnnotations: 'Bake Annotations',
        exportMasks: 'Export masks',
        exportAnnotations: 'Export annotations',
        download: 'Download',
        consoleBase64: 'Console Base64',
        copyBase64: 'Copy',
        copiedBase64: 'Copied',
        maskList: 'Mask list',
        annotationList: 'Annotation list',
        noImageLoaded: 'No image loaded',
        darkMode: 'Dark mode',
        maskShapeRect: 'Rect',
        maskShapeCircle: 'Circle',
        maskShapeEllipse: 'Ellipse',
        maskShapePolygon: 'Polygon',
        exportedImageSummary: 'Exported image: {mimeType}, {size}, Base64: {preview}',
        defaultErrorMessage: 'Image processing failed',
        errorFileRead: 'Image file could not be read',
        errorEditorNotInitialized: 'Editor is not initialized',
    },
    zh: {
        appSubtitle: 'Canvas 图片编辑演示：标注、遮罩、马赛克、裁剪、变换与导出。',
        legacyDemo: '旧版 v1 演示',
        demoPreferences: '演示偏好设置',
        imageLoading: '图片加载',
        imageLayoutMode: '图片布局模式',
        messages: '消息',
        canvasWorkspace: '画布工作区',
        editorControls: '编辑器控件',
        fitMode: '适应',
        coverMode: '覆盖',
        expandMode: '扩展',
        dropImage: '拖放图片到这里',
        selectImageHint: '或点击选择 JPG、PNG、WEBP、GIF 或 BMP',
        base64Input: 'Base64 输入',
        base64Placeholder: '粘贴 data:image/jpeg;base64,...',
        loadImage: '加载',
        zoomActions: '缩放操作',
        scalePercent: '缩放百分比',
        zoomOut: '缩小',
        zoomIn: '放大',
        rotationActions: '旋转操作',
        rotateLeftDegrees: '向左旋转角度',
        rotateRightDegrees: '向右旋转角度',
        rotateLeft: '向左旋转',
        rotateRight: '向右旋转',
        flipHorizontal: '水平翻转',
        flipVertical: '垂直翻转',
        historyActions: '历史操作',
        resetTransform: '重置',
        undo: '撤销',
        redo: '重做',
        maskActions: '遮罩操作',
        maskShape: '遮罩形状',
        createMask: '创建遮罩',
        removeMask: '移除',
        removeAllMasks: '全部移除',
        cropActions: '裁剪操作',
        cropAspectRatio: '裁剪比例',
        cropRatioFree: '自由',
        crop: '裁剪',
        apply: '应用',
        cancel: '取消',
        mosaicActions: '马赛克操作',
        mosaic: '马赛克',
        exitMosaic: '退出马赛克',
        mosaicBrushSize: '画笔',
        mosaicBlockSize: '块大小',
        annotationActions: '标注操作',
        textTool: '文本',
        exitText: '退出文本',
        textColor: '文本颜色',
        textSize: '文本大小',
        drawTool: '绘制',
        exitDraw: '退出绘制',
        drawColor: '绘制颜色',
        drawBrushSize: '画笔',
        removeAnnotation: '移除标注',
        removeAllAnnotations: '移除全部标注',
        layerActions: '图层操作',
        deleteSelection: '删除所选对象',
        layerForward: '上移一层',
        layerBackward: '下移一层',
        layerToFront: '置于顶层',
        layerToBack: '置于底层',
        exportActions: '导出操作',
        mergeMasks: '合成遮罩',
        mergeAnnotations: '合成标注',
        exportMasks: '导出遮罩',
        exportAnnotations: '导出标注',
        download: '下载',
        consoleBase64: '输出 Base64',
        copyBase64: '复制',
        copiedBase64: '已复制',
        maskList: '遮罩列表',
        annotationList: '标注列表',
        noImageLoaded: '尚未加载图片',
        darkMode: '深色模式',
        maskShapeRect: '矩形',
        maskShapeCircle: '圆形',
        maskShapeEllipse: '椭圆',
        maskShapePolygon: '多边形',
        exportedImageSummary: '已导出图片：{mimeType}，{size}，Base64：{preview}',
        defaultErrorMessage: '图像处理失败',
        errorFileRead: '无法读取图片文件',
        errorEditorNotInitialized: '编辑器未初始化',
    },
    ja: {
        appSubtitle: 'Canvas画像編集デモ：注釈、マスク、モザイク、切り抜き、変形、エクスポート。',
        legacyDemo: '旧 v1 デモ',
        demoPreferences: 'デモ設定',
        imageLoading: '画像の読み込み',
        imageLayoutMode: '画像レイアウトモード',
        messages: 'メッセージ',
        canvasWorkspace: 'キャンバス作業領域',
        editorControls: 'エディタ操作',
        fitMode: 'フィット',
        coverMode: 'カバー',
        expandMode: '拡張',
        dropImage: '画像をここにドロップ',
        selectImageHint: 'またはクリックして JPG、PNG、WEBP、GIF、BMP を選択',
        base64Input: 'Base64 入力',
        base64Placeholder: 'data:image/jpeg;base64,... を貼り付け',
        loadImage: '読み込み',
        zoomActions: 'ズーム操作',
        scalePercent: '拡大率',
        zoomOut: '縮小',
        zoomIn: '拡大',
        rotationActions: '回転操作',
        rotateLeftDegrees: '左回転の角度',
        rotateRightDegrees: '右回転の角度',
        rotateLeft: '左回転',
        rotateRight: '右回転',
        flipHorizontal: '左右反転',
        flipVertical: '上下反転',
        historyActions: '履歴操作',
        resetTransform: 'リセット',
        undo: '元に戻す',
        redo: 'やり直す',
        maskActions: 'マスク操作',
        maskShape: 'マスク形状',
        createMask: 'マスク作成',
        removeMask: '削除',
        removeAllMasks: 'すべて削除',
        cropActions: '切り抜き操作',
        cropAspectRatio: '切り抜き比率',
        cropRatioFree: '自由',
        crop: '切り抜き',
        apply: '適用',
        cancel: 'キャンセル',
        mosaicActions: 'モザイク操作',
        mosaic: 'モザイク',
        exitMosaic: '終了',
        mosaicBrushSize: 'ブラシ',
        mosaicBlockSize: 'ブロック',
        annotationActions: '注釈操作',
        textTool: 'テキスト',
        exitText: 'テキスト終了',
        textColor: '文字色',
        textSize: '文字サイズ',
        drawTool: '描画',
        exitDraw: '描画終了',
        drawColor: '描画色',
        drawBrushSize: 'ブラシ',
        removeAnnotation: '注釈を削除',
        removeAllAnnotations: '注釈をすべて削除',
        layerActions: 'レイヤー操作',
        deleteSelection: '選択を削除',
        layerForward: '前面へ',
        layerBackward: '背面へ',
        layerToFront: '最前面へ',
        layerToBack: '最背面へ',
        exportActions: '書き出し操作',
        mergeMasks: 'マスクを焼き込み',
        mergeAnnotations: '注釈を焼き込み',
        exportMasks: 'マスクを書き出す',
        exportAnnotations: '注釈を書き出す',
        download: 'ダウンロード',
        consoleBase64: 'Base64 出力',
        copyBase64: 'コピー',
        copiedBase64: 'コピー済み',
        maskList: 'マスクリスト',
        annotationList: '注釈リスト',
        noImageLoaded: '画像が読み込まれていません',
        darkMode: 'ダークモード',
        maskShapeRect: '長方形',
        maskShapeCircle: '円',
        maskShapeEllipse: '楕円',
        maskShapePolygon: '多角形',
        exportedImageSummary: '書き出した画像: {mimeType}, {size}, Base64: {preview}',
        defaultErrorMessage: '画像処理に失敗しました',
        errorFileRead: '画像ファイルを読み込めませんでした',
        errorEditorNotInitialized: 'エディタが初期化されていません',
    },
    ko: {
        appSubtitle: 'Canvas 이미지 편집 데모: 주석, 마스크, 모자이크, 자르기, 변형 및 내보내기.',
        legacyDemo: '레거시 v1 데모',
        demoPreferences: '데모 설정',
        imageLoading: '이미지 불러오기',
        imageLayoutMode: '이미지 레이아웃 모드',
        messages: '메시지',
        canvasWorkspace: '캔버스 작업 영역',
        editorControls: '편집기 컨트롤',
        fitMode: '맞춤',
        coverMode: '채우기',
        expandMode: '확장',
        dropImage: '여기에 이미지 놓기',
        selectImageHint: '또는 클릭하여 JPG, PNG, WEBP, GIF, BMP 선택',
        base64Input: 'Base64 입력',
        base64Placeholder: 'data:image/jpeg;base64,... 붙여넣기',
        loadImage: '불러오기',
        zoomActions: '줌 작업',
        scalePercent: '확대/축소 비율',
        zoomOut: '축소',
        zoomIn: '확대',
        rotationActions: '회전 작업',
        rotateLeftDegrees: '왼쪽 회전 각도',
        rotateRightDegrees: '오른쪽 회전 각도',
        rotateLeft: '왼쪽 회전',
        rotateRight: '오른쪽 회전',
        flipHorizontal: '좌우 반전',
        flipVertical: '상하 반전',
        historyActions: '기록 작업',
        resetTransform: '초기화',
        undo: '실행 취소',
        redo: '다시 실행',
        maskActions: '마스크 작업',
        maskShape: '마스크 모양',
        createMask: '마스크 생성',
        removeMask: '삭제',
        removeAllMasks: '전체 삭제',
        cropActions: '자르기 작업',
        cropAspectRatio: '자르기 비율',
        cropRatioFree: '자유',
        crop: '자르기',
        apply: '적용',
        cancel: '취소',
        mosaicActions: '모자이크 작업',
        mosaic: '모자이크',
        exitMosaic: '모자이크 종료',
        mosaicBrushSize: '브러시',
        mosaicBlockSize: '블록',
        annotationActions: '주석 작업',
        textTool: '텍스트',
        exitText: '텍스트 종료',
        textColor: '텍스트 색상',
        textSize: '텍스트 크기',
        drawTool: '그리기',
        exitDraw: '그리기 종료',
        drawColor: '그리기 색상',
        drawBrushSize: '브러시',
        removeAnnotation: '주석 삭제',
        removeAllAnnotations: '모든 주석 삭제',
        layerActions: '레이어 작업',
        deleteSelection: '선택 삭제',
        layerForward: '앞으로',
        layerBackward: '뒤로',
        layerToFront: '맨 앞으로',
        layerToBack: '맨 뒤로',
        exportActions: '내보내기 작업',
        mergeMasks: '마스크 굽기',
        mergeAnnotations: '주석 굽기',
        exportMasks: '마스크 내보내기',
        exportAnnotations: '주석 내보내기',
        download: '다운로드',
        consoleBase64: 'Base64 출력',
        copyBase64: '복사',
        copiedBase64: '복사됨',
        maskList: '마스크 목록',
        annotationList: '주석 목록',
        noImageLoaded: '이미지가 없습니다',
        darkMode: '다크 모드',
        maskShapeRect: '사각형',
        maskShapeCircle: '원',
        maskShapeEllipse: '타원',
        maskShapePolygon: '다각형',
        exportedImageSummary: '내보낸 이미지: {mimeType}, {size}, Base64: {preview}',
        defaultErrorMessage: '이미지 처리에 실패했습니다',
        errorFileRead: '이미지 파일을 읽을 수 없습니다',
        errorEditorNotInitialized: '에디터가 초기화되지 않았습니다',
    },
    fr: {
        appSubtitle:
            'Démo d’édition d’image Canvas : annotation, masque, mosaïque, recadrage, transformation et export.',
        legacyDemo: 'Démo v1 héritée',
        demoPreferences: 'Préférences de démo',
        imageLoading: "Chargement de l'image",
        imageLayoutMode: "Mode de mise en page de l'image",
        messages: 'Messages',
        canvasWorkspace: 'Espace de travail canvas',
        editorControls: "Contrôles de l'éditeur",
        fitMode: 'Ajuster',
        coverMode: 'Couvrir',
        expandMode: 'Étendre',
        dropImage: 'Déposez une image ici',
        selectImageHint: 'ou cliquez pour choisir JPG, PNG, WEBP, GIF ou BMP',
        base64Input: 'Entrée Base64',
        base64Placeholder: 'Collez data:image/jpeg;base64,...',
        loadImage: 'Charger',
        zoomActions: 'Actions de zoom',
        scalePercent: 'Pourcentage de zoom',
        zoomOut: 'Zoom arrière',
        zoomIn: 'Zoom avant',
        rotationActions: 'Actions de rotation',
        rotateLeftDegrees: 'Degrés de rotation gauche',
        rotateRightDegrees: 'Degrés de rotation droite',
        rotateLeft: 'Rotation gauche',
        rotateRight: 'Rotation droite',
        flipHorizontal: 'Retourner H',
        flipVertical: 'Retourner V',
        historyActions: "Actions d'historique",
        resetTransform: 'Réinitialiser',
        undo: 'Annuler',
        redo: 'Rétablir',
        maskActions: 'Actions de masque',
        maskShape: 'Forme du masque',
        createMask: 'Créer un masque',
        removeMask: 'Supprimer',
        removeAllMasks: 'Tout supprimer',
        cropActions: 'Actions de recadrage',
        cropAspectRatio: 'Ratio de recadrage',
        cropRatioFree: 'Libre',
        crop: 'Recadrer',
        apply: 'Appliquer',
        cancel: 'Annuler',
        mosaicActions: 'Actions de mosaïque',
        mosaic: 'Mosaïque',
        exitMosaic: 'Quitter',
        mosaicBrushSize: 'Pinceau',
        mosaicBlockSize: 'Bloc',
        annotationActions: "Actions d'annotation",
        textTool: 'Texte',
        exitText: 'Quitter le texte',
        textColor: 'Couleur du texte',
        textSize: 'Taille du texte',
        drawTool: 'Dessiner',
        exitDraw: 'Quitter le dessin',
        drawColor: 'Couleur du dessin',
        drawBrushSize: 'Pinceau',
        removeAnnotation: "Supprimer l'annotation",
        removeAllAnnotations: 'Supprimer toutes les annotations',
        layerActions: 'Actions de calque',
        deleteSelection: 'Supprimer la sélection',
        layerForward: 'Avancer',
        layerBackward: 'Reculer',
        layerToFront: 'Premier plan',
        layerToBack: 'Arrière-plan',
        exportActions: "Actions d'export",
        mergeMasks: 'Intégrer les masques',
        mergeAnnotations: 'Intégrer les annotations',
        exportMasks: 'Exporter les masques',
        exportAnnotations: 'Exporter les annotations',
        download: 'Télécharger',
        consoleBase64: 'Afficher Base64',
        copyBase64: 'Copier',
        copiedBase64: 'Copié',
        maskList: 'Liste des masques',
        annotationList: 'Liste des annotations',
        noImageLoaded: 'Aucune image chargée',
        darkMode: 'Mode sombre',
        maskShapeRect: 'Rectangle',
        maskShapeCircle: 'Cercle',
        maskShapeEllipse: 'Ellipse',
        maskShapePolygon: 'Polygone',
        exportedImageSummary: 'Image exportée : {mimeType}, {size}, Base64 : {preview}',
        defaultErrorMessage: "Échec du traitement de l'image",
        errorFileRead: "Le fichier image n'a pas pu être lu",
        errorEditorNotInitialized: "L'éditeur n'est pas initialisé",
    },
    es: {
        appSubtitle:
            'Demo de edición de imágenes en Canvas: anotación, máscara, mosaico, recorte, transformación y exportación.',
        legacyDemo: 'Demo heredada v1',
        demoPreferences: 'Preferencias de demo',
        imageLoading: 'Carga de imagen',
        imageLayoutMode: 'Modo de diseño de imagen',
        messages: 'Mensajes',
        canvasWorkspace: 'Área de trabajo del canvas',
        editorControls: 'Controles del editor',
        fitMode: 'Ajustar',
        coverMode: 'Cubrir',
        expandMode: 'Expandir',
        dropImage: 'Suelta una imagen aquí',
        selectImageHint: 'o haz clic para elegir JPG, PNG, WEBP, GIF o BMP',
        base64Input: 'Entrada Base64',
        base64Placeholder: 'Pega data:image/jpeg;base64,...',
        loadImage: 'Cargar',
        zoomActions: 'Acciones de zoom',
        scalePercent: 'Porcentaje de escala',
        zoomOut: 'Alejar',
        zoomIn: 'Acercar',
        rotationActions: 'Acciones de rotación',
        rotateLeftDegrees: 'Grados de giro a la izquierda',
        rotateRightDegrees: 'Grados de giro a la derecha',
        rotateLeft: 'Girar a la izquierda',
        rotateRight: 'Girar a la derecha',
        flipHorizontal: 'Voltear H',
        flipVertical: 'Voltear V',
        historyActions: 'Acciones de historial',
        resetTransform: 'Restablecer',
        undo: 'Deshacer',
        redo: 'Rehacer',
        maskActions: 'Acciones de máscara',
        maskShape: 'Forma de máscara',
        createMask: 'Crear máscara',
        removeMask: 'Eliminar',
        removeAllMasks: 'Eliminar todo',
        cropActions: 'Acciones de recorte',
        cropAspectRatio: 'Relación de recorte',
        cropRatioFree: 'Libre',
        crop: 'Recortar',
        apply: 'Aplicar',
        cancel: 'Cancelar',
        mosaicActions: 'Acciones de mosaico',
        mosaic: 'Mosaico',
        exitMosaic: 'Salir',
        mosaicBrushSize: 'Pincel',
        mosaicBlockSize: 'Bloque',
        annotationActions: 'Acciones de anotación',
        textTool: 'Texto',
        exitText: 'Salir de texto',
        textColor: 'Color de texto',
        textSize: 'Tamaño de texto',
        drawTool: 'Dibujar',
        exitDraw: 'Salir de dibujo',
        drawColor: 'Color de dibujo',
        drawBrushSize: 'Pincel',
        removeAnnotation: 'Eliminar anotación',
        removeAllAnnotations: 'Eliminar todas las anotaciones',
        layerActions: 'Acciones de capa',
        deleteSelection: 'Eliminar selección',
        layerForward: 'Adelante',
        layerBackward: 'Atrás',
        layerToFront: 'Al frente',
        layerToBack: 'Al fondo',
        exportActions: 'Acciones de exportación',
        mergeMasks: 'Aplicar máscaras',
        mergeAnnotations: 'Aplicar anotaciones',
        exportMasks: 'Exportar máscaras',
        exportAnnotations: 'Exportar anotaciones',
        download: 'Descargar',
        consoleBase64: 'Mostrar Base64',
        copyBase64: 'Copiar',
        copiedBase64: 'Copiado',
        maskList: 'Lista de máscaras',
        annotationList: 'Lista de anotaciones',
        noImageLoaded: 'No hay imagen cargada',
        darkMode: 'Modo oscuro',
        maskShapeRect: 'Rectángulo',
        maskShapeCircle: 'Círculo',
        maskShapeEllipse: 'Elipse',
        maskShapePolygon: 'Polígono',
        exportedImageSummary: 'Imagen exportada: {mimeType}, {size}, Base64: {preview}',
        defaultErrorMessage: 'Error al procesar la imagen',
        errorFileRead: 'No se pudo leer el archivo de imagen',
        errorEditorNotInitialized: 'El editor no está inicializado',
    },
};

// MaskConfig presets passed directly to `editor.createMask(config)`. Consumers
// can use the same shape names and geometry fields in their own controls.
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

function clearMessageActions(panel) {
    panel.querySelectorAll('[data-demo-message-action]').forEach(function (element) {
        element.remove();
    });
}

function showMessage(error) {
    const { panel, message } = getMessageElements();
    if (!panel || !message) {
        console.warn('Message panel elements not found');
        return;
    }
    currentBase64SummaryDataUrl = '';
    clearMessageActions(panel);
    const text = getMessage(error);
    message.textContent = text;
    message.classList.remove('is-success');
    message.hidden = false;
    panel.hidden = false;
}

function clearMessage() {
    const { panel, message } = getMessageElements();
    if (!panel || !message) return;
    currentBase64SummaryDataUrl = '';
    clearMessageActions(panel);
    message.textContent = '';
    message.classList.remove('is-success');
    message.hidden = true;
    panel.hidden = true;
}

function estimateDataUrlBytes(dataUrl) {
    // `exportImageBase64()` returns a data URL, not raw bytes. This estimate
    // strips the metadata prefix and accounts for Base64 padding so the demo
    // can display an approximate output size without decoding the image.
    const base64 = String(dataUrl).split(',', 2)[1] || '';
    const clean = base64.replace(/\s/g, '');
    const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatTranslation(template, values) {
    return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, function (_match, key) {
        return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : `{${key}}`;
    });
}

function summarizeDataUrl(dataUrl) {
    const value = String(dataUrl || '');
    const mimeMatch = /^data:([^;]+);base64,/i.exec(value);
    const mimeType = mimeMatch?.[1] || 'image/*';
    const preview = value.length > 42 ? `${value.slice(0, 42)}...` : value;
    return formatTranslation(getCurrentTranslations('exportedImageSummary'), {
        mimeType,
        preview,
        size: formatBytes(estimateDataUrlBytes(value)),
    });
}

async function copyTextToClipboard(text) {
    // Prefer the modern async clipboard API, with a textarea fallback for
    // browsers or local file contexts where `navigator.clipboard` is absent.
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand && document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('Clipboard copy failed');
}

function showBase64Summary(dataUrl) {
    const { panel, message } = getMessageElements();
    if (!panel || !message) {
        console.warn('Message panel elements not found');
        return;
    }

    currentBase64SummaryDataUrl = dataUrl;
    clearMessageActions(panel);
    message.textContent = summarizeDataUrl(dataUrl);
    message.classList.add('is-success');
    message.hidden = false;
    panel.hidden = false;

    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'btn btn-sm btn-outline-secondary demo-copy-button';
    copyButton.dataset.demoMessageAction = 'copyBase64';
    copyButton.dataset.demoCopyState = 'copy';
    copyButton.textContent = getCurrentTranslations('copyBase64');
    copyButton.addEventListener('click', async function () {
        try {
            await copyTextToClipboard(dataUrl);
            copyButton.dataset.demoCopyState = 'copied';
            copyButton.textContent = getCurrentTranslations('copiedBase64');
        } catch (error) {
            showMessage(error);
        }
    });
    panel.append(copyButton);
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
    // Persisting language/theme is demo state only. The editor itself remains
    // stateless with respect to localization and host-page preferences.
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

    document.querySelectorAll('[data-i18n-aria-label]').forEach(function (element) {
        const translationKey = element.dataset.i18nAriaLabel;
        if (languageTranslations[translationKey]) {
            element.setAttribute('aria-label', languageTranslations[translationKey]);
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

    syncToolButtonLabels();
    updateDynamicLocalizedText();
    setStoredValue('imageEditorDemoLanguage', nextLanguage);
}

function syncToolButtonLabels() {
    document.querySelectorAll('.tool-button').forEach(function (buttonElement) {
        const labelElement = buttonElement.querySelector('.tool-label');
        const labelText = labelElement?.textContent?.trim();
        if (!labelText) return;
        buttonElement.setAttribute('aria-label', labelText);
        buttonElement.setAttribute('title', labelText);
    });
}

function renderDemoIcons() {
    if (!window.lucide || typeof window.lucide.createIcons !== 'function') return;
    window.lucide.createIcons({
        attrs: {
            'aria-hidden': 'true',
            focusable: 'false',
        },
    });
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

function updateDynamicLocalizedText() {
    const { panel, message } = getMessageElements();
    if (
        currentBase64SummaryDataUrl &&
        message &&
        !message.hidden &&
        message.classList.contains('is-success')
    ) {
        message.textContent = summarizeDataUrl(currentBase64SummaryDataUrl);
    }

    const copyButton = panel?.querySelector('[data-demo-message-action="copyBase64"]');
    if (copyButton) {
        copyButton.textContent =
            copyButton.dataset.demoCopyState === 'copied'
                ? getCurrentTranslations('copiedBase64')
                : getCurrentTranslations('copyBase64');
    }
}

function initEditor() {
    const ImageEditorCtor =
        window.ImageEditor?.ImageEditor || window.ImageEditor?.default || window.ImageEditor;

    if (typeof ImageEditorCtor !== 'function') {
        console.error(
            'ImageEditor constructor not found. Make sure the UMD bundle is loaded before this script.',
        );
        return;
    }

    editor = new ImageEditorCtor({
        backgroundColor: 'transparent',
        // defaultLayoutMode defines the initial load behavior. The radio buttons
        // below switch future loads via `editor.setLayoutMode(mode)`.
        defaultLayoutMode: 'fit',
        // Downsampling protects memory usage when users drop very large
        // source images into the demo.
        downsampleOnLoad: true,
        initialImageBase64: null,
        // Masks stay rotatable in this demo so the mask and crop examples
        // exercise the richer Fabric object surface.
        maskRotatable: true,
        maskLabelOnSelect: true,
        defaultMosaicConfig: {
            brushSize: 48,
            blockSize: 8,
        },
        animationDuration: 100,
        maskLabelOffset: 5,
        showPlaceholder: true,
        // Export defaults apply when the demo calls `exportImageBase64()`
        // without per-call options.
        exportAreaByDefault: 'image',
        mergeMasksByDefault: true,
        mergeAnnotationsByDefault: true,
        defaultTextConfig: {
            fill: '#ff0000',
            fontSize: 32,
        },
        defaultDrawConfig: {
            color: '#ff0000',
            brushSize: 8,
        },
        // Lifecycle callbacks are a convenient way for host pages to sync
        // their own controls with editor state without reaching into internals.
        onImageChanged: updateDemoControls,
        onBusyChange: updateDemoControls,
        onMasksChanged: updateDemoControls,
        onAnnotationsChanged: updateDemoControls,
        onToolModeChange: updateDemoControls,
        onHistoryChange: updateDemoControls,
        onSelectionChange: updateDemoControls,
    });

    editor.init({
        canvas: 'canvas',
        imagePlaceholder: 'imagePlaceholder',
        scalePercentageInput: 'scalePercentageInput',
        zoomInButton: 'zoomInButton',
        zoomOutButton: 'zoomOutButton',
        rotateLeftButton: 'rotateLeftButton',
        rotateRightButton: 'rotateRightButton',
        flipHorizontalButton: 'flipHorizontalButton',
        flipVerticalButton: 'flipVerticalButton',
        rotateLeftDegreesInput: 'rotateLeftDegreesInput',
        rotateRightDegreesInput: 'rotateRightDegreesInput',
        createMaskButton: null,
        removeSelectedMaskButton: 'removeSelectedMaskButton',
        removeAllMasksButton: 'removeAllMasksButton',
        mergeMasksButton: 'mergeMasksButton',
        mergeAnnotationsButton: 'mergeAnnotationsButton',
        downloadImageButton: null,
        maskList: 'maskList',
        annotationList: 'annotationList',
        enterCropModeButton: 'enterCropModeButton',
        cropAspectRatioSelect: 'cropAspectRatioSelect',
        applyCropButton: 'applyCropButton',
        cancelCropButton: 'cancelCropButton',
        enterMosaicModeButton: 'enterMosaicModeButton',
        exitMosaicModeButton: 'exitMosaicModeButton',
        mosaicBrushSizeInput: 'mosaicBrushSizeInput',
        mosaicBlockSizeInput: 'mosaicBlockSizeInput',
        enterTextModeButton: 'enterTextModeButton',
        exitTextModeButton: 'exitTextModeButton',
        textColorInput: 'textColorInput',
        textFontSizeInput: 'textFontSizeInput',
        enterDrawModeButton: 'enterDrawModeButton',
        exitDrawModeButton: 'exitDrawModeButton',
        drawColorInput: 'drawColorInput',
        drawBrushSizeInput: 'drawBrushSizeInput',
        removeSelectedAnnotationButton: 'removeSelectedAnnotationButton',
        removeAllAnnotationsButton: 'removeAllAnnotationsButton',
        deleteSelectedObjectButton: 'deleteSelectedObjectButton',
        bringSelectedObjectForwardButton: 'bringSelectedObjectForwardButton',
        sendSelectedObjectBackwardButton: 'sendSelectedObjectBackwardButton',
        bringSelectedObjectToFrontButton: 'bringSelectedObjectToFrontButton',
        sendSelectedObjectToBackButton: 'sendSelectedObjectToBackButton',
        undoButton: 'undoButton',
        redoButton: 'redoButton',
        resetImageTransformButton: 'resetImageTransformButton',
        imageInput: null,
        uploadArea: null,
    });

    const exportMergeMasksInput = getOptionalElement('exportMergeMasksInput');
    const exportMergeAnnotationsInput = getOptionalElement('exportMergeAnnotationsInput');
    if (exportMergeMasksInput) exportMergeMasksInput.checked = true;
    if (exportMergeAnnotationsInput) exportMergeAnnotationsInput.checked = true;
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
        editor.setLayoutMode('fit');
    } else if (coverCanvasRadio?.checked) {
        editor.setLayoutMode('cover');
    } else {
        editor.setLayoutMode('expand');
    }
}

function isEditorBusy() {
    if (!editor) return false;
    if (demoLoading) return false;
    return editor.isBusy();
}

function canLoadImage() {
    return !!editor && !isEditorBusy() && editor.getActiveToolMode() === null;
}

function updateDemoControls() {
    // The editor owns controls passed to `init`, but this demo also has
    // host-page controls (`load`, shape select, export options, upload area)
    // that need to follow the same public state as framework integrations.
    const hasLoadedImage = !!editor && editor.isImageLoaded();
    const isBusy = isEditorBusy();
    const activeToolMode = editor ? editor.getActiveToolMode() : null;
    const canUseImageActions = hasLoadedImage && !isBusy && activeToolMode === null;
    const canLoad = !!editor && !isBusy && activeToolMode === null;
    const createMaskButtonElement = getOptionalElement('createMaskButton');
    const maskShapeSelectElement = getOptionalElement('maskShapeSelect');
    const loadImageButtonElement = getOptionalElement('loadImageButton');
    const downloadImageButtonElement = getOptionalElement('downloadImageButton');
    const exportMergeMasksInput = getOptionalElement('exportMergeMasksInput');
    const exportMergeAnnotationsInput = getOptionalElement('exportMergeAnnotationsInput');

    if (createMaskButtonElement) createMaskButtonElement.disabled = !canUseImageActions;
    if (maskShapeSelectElement) maskShapeSelectElement.disabled = isBusy || activeToolMode !== null;
    if (loadImageButtonElement) loadImageButtonElement.disabled = !canLoad;
    if (downloadImageButtonElement) downloadImageButtonElement.disabled = !canUseImageActions;
    if (exportMergeMasksInput) exportMergeMasksInput.disabled = !canUseImageActions;
    if (exportMergeAnnotationsInput) exportMergeAnnotationsInput.disabled = !canUseImageActions;
    if (imageInputElement) imageInputElement.disabled = !canLoad;
    if (uploadAreaElement) {
        uploadAreaElement.classList.toggle('disabled', !canLoad);
        uploadAreaElement.setAttribute('aria-disabled', canLoad ? 'false' : 'true');
    }
}

function getSelectedMaskConfig() {
    // This object is passed directly to `createMask`. The editor applies
    // defaults for omitted dimensions/style fields.
    const selectedShape = getOptionalElement('maskShapeSelect')?.value || 'rect';
    return { ...(maskShapeConfigs[selectedShape] || maskShapeConfigs.rect) };
}

function handleCreateMaskButtonClick() {
    if (!editor || !editor.isImageLoaded() || isEditorBusy() || editor.getActiveToolMode() !== null)
        return;
    // `createMask` returns the created object, but the demo only needs the
    // editor's callbacks/UI refresh to reflect the new mask.
    editor.createMask(getSelectedMaskConfig());
    updateDemoControls();
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function (loadEvent) {
            resolve(loadEvent.target.result);
        };

        reader.onerror = function () {
            reject(new Error(getCurrentTranslations('errorFileRead')));
        };

        reader.readAsDataURL(file);
    });
}

async function loadFile(file) {
    if (!file || !canLoadImage()) return;

    clearMessage();
    setOptions();
    demoLoading = true;
    updateDemoControls();

    try {
        const imageBase64 = await readFileAsDataUrl(file);
        // `loadImage` accepts data URLs. File objects are converted by the
        // host page; the editor then handles decode, downsample, layout, and
        // transactional rollback internally.
        await editor.loadImage(imageBase64);
    } catch (error) {
        showMessage(error);
        console.error(error);
    } finally {
        demoLoading = false;
        updateDemoControls();
    }
}

function handleLoadButtonClick() {
    if (!canLoadImage()) return;

    clearMessage();
    setOptions();
    const imageBase64 = getOptionalElement('base64Input')?.value || '';
    demoLoading = true;
    updateDemoControls();
    // Paste-based loading follows the same public `loadImage(dataUrl)` path
    // as file/drop loading.
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

const loadImageButtonElement = getOptionalElement('loadImageButton');
if (loadImageButtonElement) {
    loadImageButtonElement.addEventListener('click', handleLoadButtonClick);
}

const createMaskButtonElement = getOptionalElement('createMaskButton');
if (createMaskButtonElement) {
    createMaskButtonElement.addEventListener('click', handleCreateMaskButtonClick);
}

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
renderDemoIcons();
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
    const hasLoadedImage = !!editor && editor.isImageLoaded();
    if (!hasLoadedImage) {
        showMessage(new Error(getCurrentTranslations('noImageLoaded')));
        return;
    }

    try {
        // The export toggles affect rendered output only. They do not
        // remove masks or annotations and do not push history entries.
        const imageBase64 = await editor.exportImageBase64(getOverlayExportOptions());
        showBase64Summary(imageBase64);
    } catch (error) {
        showMessage(error);
        console.error(error);
    }
}

function getOverlayExportOptions() {
    return {
        mergeMasks: getOptionalElement('exportMergeMasksInput')?.checked !== false,
        mergeAnnotations: getOptionalElement('exportMergeAnnotationsInput')?.checked !== false,
    };
}

async function handleDownloadButtonClick() {
    if (!editor || !editor.isImageLoaded() || isEditorBusy()) return;
    try {
        await editor.downloadImage(getOverlayExportOptions());
    } catch (error) {
        showMessage(error);
        console.error(error);
    }
}

const base64ButtonElement = getOptionalElement('base64Button');
if (base64ButtonElement) {
    base64ButtonElement.addEventListener('click', getBase64Action);
}

const downloadImageButtonElement = getOptionalElement('downloadImageButton');
if (downloadImageButtonElement) {
    downloadImageButtonElement.addEventListener('click', handleDownloadButtonClick);
}
