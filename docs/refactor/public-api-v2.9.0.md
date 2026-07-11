# v2.9.0 public API baseline

This inventory freezes the package-root API at release commit `3f1c7a376f424addaed58b65eef6d550d2128a22` and reviewed HEAD `ae8c34347d6c849f204332038e85e046e917f05e`. Phase 0–1 does not add Plugin Kernel symbols to this surface.

## Package entry contract

| Consumer              | Entry                          |
| --------------------- | ------------------------------ |
| ESM JavaScript        | `dist/esm/index.js`            |
| CommonJS JavaScript   | `dist/cjs/index.cjs`           |
| ESM declarations      | `dist/types/index.d.ts`        |
| CommonJS declarations | `dist/types/index.d.cts`       |
| UMD                   | `dist/umd/image-editor.umd.js` |

`package.json#exports` contains only `"."`; there are no public subpath exports. `main`, `module`, `types`, `unpkg`, and `jsdelivr` all point to the entries above. `sideEffects` is `false`. Fabric is a peer dependency (`>=7.4.0 <8`) and is external in CJS/UMD builds. The UMD global is the namespace `ImageEditor`; the class is available as `ImageEditor.ImageEditor`.

## Root runtime exports

- `ImageEditor` is both the named and default export.
- Runtime guards: `isAnnotationObject`, `isBaseImageObject`, `isDrawAnnotationObject`, `isEditableOverlayObject`, `isMaskObject`, `isSessionObject`, `isShapeAnnotationObject`, and `isTextAnnotationObject`.

No controller, manager, service, action, operation guard, serializer implementation, or Plugin Kernel symbol is exported from the root.

## Constructor

```ts
new ImageEditor(fabricModule?: FabricModule, options?: ImageEditorOptions)
new ImageEditor(options?: ImageEditorOptions) // UMD/global Fabric form
```

The implementation accepts `FabricModule | ImageEditorOptions` as its first argument and detects which form was supplied. This overload shape is unchanged.

## Public instance methods

The following 92 methods are present in `dist/types/image-editor.d.ts`.

### Lifecycle, load, layout, and state

- `init(elementMap?: ElementMap): void`
- `loadImage(base64: string, options?: LoadImageOptions): Promise<void>`
- `loadFromState(jsonString: string | CanvasJson): Promise<void>`
- `saveState(): void`
- `isImageLoaded(): boolean`
- `isBusy(): boolean`
- `isProcessing(): boolean`
- `setLayoutMode(mode: LayoutMode): void`
- `setCanvasSize(widthPx: number, heightPx: number): void`
- `resizeToContainer(options?: ResizeToContainerOptions): void`
- `relayout(options?: RelayoutOptions): void`
- `getImageInfo(): ImageInfo | null`
- `getEditorState(): ImageEditorState`
- `getSelection(): ImageEditorSelection`
- `getActiveToolMode(): EditorToolMode | null`
- `dispose(): void`
- `disposeAsync(): Promise<void>`

### Base-image transforms and filters

- `scaleImage(factor: number): Promise<void>`
- `rotateImage(degrees: number): Promise<void>`
- `flipHorizontal(): Promise<void>`
- `flipVertical(): Promise<void>`
- `resetImageTransform(): Promise<void>`
- `setImageFilterConfig(config: Partial<ImageFilterConfig>): void`
- `getImageFilterConfig(): ResolvedImageFilterConfig`
- `resetImageFilterConfig(): void`
- `clearImageFilters(): void`
- `commitImageFilters(): void`

### History

- `undo(): Promise<void>`
- `redo(): Promise<void>`

### Masks and annotations

- `getMasks(): MaskObject[]`
- `createMask(config?: MaskConfig): MaskObject | null`
- `removeSelectedMask(): void`
- `removeAllMasks(options?: RemoveAllMasksOptions): void`
- `mergeMasks(): Promise<void>`
- `getAnnotations(): AnnotationObject[]`
- `enterTextMode(): void`
- `exitTextMode(): void`
- `isTextMode(): boolean`
- `createTextAnnotation(config?: TextAnnotationConfig): TextAnnotationObject | null`
- `getTextConfig(): Readonly<ResolvedTextAnnotationConfig>`
- `setTextConfig(config: TextAnnotationConfig): void`
- `resetTextConfig(): void`
- `setTextColor(color: string): void`
- `setTextFontSize(size: number): void`
- `enterDrawMode(): void`
- `exitDrawMode(): void`
- `isDrawMode(): boolean`
- `getDrawConfig(): Readonly<ResolvedDrawConfig>`
- `setDrawConfig(config: DrawConfig): void`
- `resetDrawConfig(): void`
- `setDrawColor(color: string): void`
- `setDrawBrushSize(size: number): void`
- `setDrawSubMode(mode: DrawSubMode): void`
- `getDrawSubMode(): DrawSubMode | null`
- `getEraserConfig(): Readonly<ResolvedEraserConfig>`
- `setEraserConfig(config: EraserConfig): void`
- `resetEraserConfig(): void`
- `createShapeAnnotation(config?: ShapeAnnotationConfig): ShapeAnnotationObject | null`
- `enterShapeMode(shape?: ShapeAnnotationKind): void`
- `exitShapeMode(): void`
- `isShapeMode(): boolean`
- `getShapeConfig(): Readonly<ResolvedShapeAnnotationConfig>`
- `setShapeConfig(config: ShapeAnnotationConfig): void`
- `resetShapeConfig(): void`
- `removeSelectedAnnotation(): void`
- `removeAllAnnotations(options?: RemoveAllAnnotationsOptions): void`
- `updateAnnotation(annotationId: number, config: AnnotationUpdateConfig): void`
- `updateSelectedAnnotation(config: AnnotationUpdateConfig): void`
- `deleteSelectedObject(): void`
- `bringSelectedObjectForward(): void`
- `sendSelectedObjectBackward(): void`
- `bringSelectedObjectToFront(): void`
- `sendSelectedObjectToBack(): void`
- `mergeAnnotations(): Promise<void>`

### Crop and Mosaic

- `enterCropMode(options?: CropModeOptions): void`
- `setCropAspectRatio(aspectRatio: CropAspectRatio): void`
- `cancelCrop(): void`
- `applyCrop(): Promise<void>`
- `enterMosaicMode(): void`
- `exitMosaicMode(): void`
- `isMosaicMode(): boolean`
- `getMosaicConfig(): Readonly<ResolvedMosaicConfig>`
- `setMosaicConfig(config: MosaicConfig): void`
- `resetMosaicConfig(): void`
- `setMosaicBrushSize(size: number): void`
- `setMosaicBlockSize(size: number): void`

### Overlay-state and export

- `exportOverlayState(options?: ExportOverlayStateOptions): OverlayState`
- `validateOverlayState(input: unknown, options?: OverlayValidationOptions): OverlayValidationResult`
- `importOverlayState(input: unknown, options?: ImportOverlayStateOptions): Promise<ImportOverlayStateResult>`
- `downloadImage(options?: ImageExportOptions): Promise<void>`
- `exportImageBase64(options?: ImageExportOptions): Promise<string>`
- `exportImageFile(options?: ImageExportOptions): Promise<File>`

## `ImageEditorOptions`

The root options type contains the following keys. Defaults remain those documented in `src/core/public-types.ts` and `docs/options.md`.

- Canvas/animation/transform: `canvasWidth`, `canvasHeight`, `backgroundColor`, `animationDuration`, `minScale`, `maxScale`, `scaleStep`, `rotationStep`, `bindMasksToImageTransform`, `bindAnnotationsToImageTransform`, `textAnnotationFlipBehavior`.
- Layout/load: `defaultLayoutMode`, `downsampleOnLoad`, `downsampleMaxWidth`, `downsampleMaxHeight`, `downsampleQuality`, `preserveSourceFormat`, `downsampleMimeType`, `autoOrientImage`, `autoOrientImageQuality`, `maxInputBytes`, `maxInputPixels`, `imageLoadTimeoutMs`, `initialImageBase64`.
- History/export: `maxHistorySize`, `exportMultiplier`, `maxExportPixels`, `maxExportDimension`, `exportAreaByDefault`, `mergeMasksByDefault`, `mergeAnnotationsByDefault`, `defaultDownloadFileName`.
- Mask/overlay defaults: `defaultMaskWidth`, `defaultMaskHeight`, `defaultMaskConfig`, `maskRotatable`, `maskLabelOnSelect`, `maskLabelOffset`, `maskName`, `textAnnotationName`, `drawAnnotationName`, `shapeAnnotationName`, `maskListOrder`, `annotationListOrder`, `groupSelection`, `showPlaceholder`.
- Nested configuration: `label`, `crop`, `defaultMosaicConfig`, `defaultTextConfig`, `defaultDrawConfig`, `defaultEraserConfig`, `defaultShapeConfig`.
- Callbacks: `onImageLoadStart`, `onImageLoaded`, `onImageCleared`, `onImageChanged`, `onBusyChange`, `onToolModeChange`, `onHistoryChange`, `onEditorDisposed`, `onMasksChanged`, `onAnnotationsChanged`, `onSelectionChange`, `onError`, and `onWarning`.

`onError` and `onWarning` retain `(error, message)` argument order. Configuration is not added to Snapshot or overlay-state data by Phase 0–1.

## Snapshot, overlay-state, and export entry points

- Snapshot entry points are `saveState()` and `loadFromState(...)`. Their existing `CanvasJson` wire behavior is unchanged; Phase 0–1 introduces no migration or schema envelope.
- Overlay-state entry points are `exportOverlayState`, `validateOverlayState`, and `importOverlayState`. `OverlayState.version` remains schema version `1` with `image-normalized` coordinates.
- Export entry points are `exportImageBase64`, `exportImageFile`, and `downloadImage`; `mergeMasks` and `mergeAnnotations` remain explicit flattening operations.
- `ImageExportOptions` continues to include the existing format, quality, multiplier, export-area, background, filename, and independent mask/annotation merge controls.

## DOM `ElementMap`

`ElementMap` is an alias of `ElementIdMap`. Values are element IDs, element references, or `null`. The keys are:

`canvas`, `canvasContainer`, `imagePlaceholder`, `scalePercentageInput`, `imageBrightnessInput`, `imageContrastInput`, `imageSaturationInput`, `imageBlurInput`, `imageSharpenInput`, `imageGrayscaleInput`, `imageSepiaInput`, `imageVintageInput`, `applyImageFiltersButton`, `resetImageFiltersButton`, `clearImageFiltersButton`, `rotateLeftDegreesInput`, `rotateRightDegreesInput`, `rotateLeftButton`, `rotateRightButton`, `flipHorizontalButton`, `flipVerticalButton`, `createMaskButton`, `removeSelectedMaskButton`, `removeAllMasksButton`, `mergeMasksButton`, `maskList`, `annotationList`, `enterTextModeButton`, `exitTextModeButton`, `textColorInput`, `textFontSizeInput`, `enterDrawModeButton`, `exitDrawModeButton`, `drawColorInput`, `drawBrushSizeInput`, `drawBrushSubModeButton`, `drawEraseSubModeButton`, `eraserBrushSizeInput`, `shapeKindSelect`, `shapeStrokeInput`, `shapeStrokeWidthInput`, `shapeFillInput`, `createShapeAnnotationButton`, `enterShapeModeButton`, `exitShapeModeButton`, `removeSelectedAnnotationButton`, `removeAllAnnotationsButton`, `deleteSelectedObjectButton`, `mergeAnnotationsButton`, `bringSelectedObjectForwardButton`, `sendSelectedObjectBackwardButton`, `bringSelectedObjectToFrontButton`, `sendSelectedObjectToBackButton`, `downloadImageButton`, `zoomInButton`, `zoomOutButton`, `resetImageTransformButton`, `undoButton`, `redoButton`, `imageInput`, `enterCropModeButton`, `cropAspectRatioSelect`, `applyCropButton`, `cancelCropButton`, `enterMosaicModeButton`, `exitMosaicModeButton`, `mosaicBrushSizeInput`, `mosaicBlockSizeInput`, and `uploadArea`.

## Root type exports

Core and feature-facing types:

`ImageEditorOptions`, `ResolvedOptions`, `LayoutMode`, `EditorObjectKind`, `EditorToolMode`, `OverlayListOrder`, `AnnotationType`, `SessionObjectType`, `EditorObjectMeta`, `LabelConfig`, `CropConfig`, `CropAspectRatioPreset`, `CropAspectRatio`, `CropModeOptions`, `CropExportFileType`, `MosaicConfig`, `ResolvedMosaicConfig`, `MosaicOutputFileType`, `ImageFilterConfig`, `ResolvedImageFilterConfig`, `TextAnnotationConfig`, `ResolvedTextAnnotationConfig`, `DrawConfig`, `ResolvedDrawConfig`, `DrawSubMode`, `EraserConfig`, `ResolvedEraserConfig`, `ShapeAnnotationConfig`, `ResolvedShapeAnnotationConfig`, `ShapeAnnotationKind`, `OverlayNumericProp`, `LoadImageOptions`, `RemoveAllMasksOptions`, `RemoveAllAnnotationsOptions`, `DefaultMaskConfig`, `MaskConfig`, `MaskObject`, `MaskNumericProp`, `MaskShapeKind`, `ResolvedMaskConfig`, `BaseImageObject`, `SessionObject`, `AnnotationObject`, `TextAnnotationObject`, `DrawAnnotationObject`, `ShapeAnnotationObject`, `AnnotationUpdateConfig`, `ImageMimeType`, `ImageFileType`, `NormalizedImageFormat`, `ExportArea`, `ImageExportOptions`, `ImageInfo`, `ImageEditorState`, `ImageEditorSelection`, `ImageEditorCallbackContext`, `ImageEditorOperation`, `ElementTarget`, `ElementMap`, `ElementIdMap`, `ResizeToContainerOptions`, `RelayoutOptions`, and `FabricModule`.

Overlay-state types:

`ExportOverlayStateOptions`, `ImportOverlayStateOptions`, `ImportOverlayStateResult`, `OverlayBaseImageTransform`, `OverlayExportContext`, `OverlayImageInfo`, `OverlayImportContext`, `OverlayImportWarning`, `OverlayMetadata`, `OverlayMigrationResult`, `OverlaySerializerRegistryEntry`, `OverlayState`, `OverlayValidationError`, `OverlayValidationOptions`, `OverlayValidationResult`, `SerializedCustomOverlay`, `SerializedDrawAnnotationOverlay`, `SerializedDrawBrush`, `SerializedDrawPoint`, `SerializedDrawStroke`, `SerializedEllipseMaskGeometry`, `SerializedMaskGeometry`, `SerializedMaskOverlay`, `SerializedMaskStyle`, `SerializedOverlay`, `SerializedOverlayBase`, `SerializedPolygonMaskGeometry`, `SerializedRectMaskGeometry`, `SerializedShapeAnnotationOverlay`, `SerializedShapeArrowGeometry`, `SerializedShapeGeometry`, `SerializedShapeLineGeometry`, `SerializedShapeRectGeometry`, `SerializedShapeStyle`, `SerializedTextAnnotationOverlay`, `SerializedTextContent`, `SerializedTextGeometry`, and `SerializedTextStyle`.

## Deprecated API

`ElementIdMap` is the only root symbol marked deprecated; its name is retained for compatibility and `ElementMap` is preferred. No deprecated symbol is removed or changed in Phase 0–1.
