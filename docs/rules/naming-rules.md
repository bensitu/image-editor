# Naming Rules

Reusable naming conventions for a TypeScript codebase. The goal is to keep names predictable, readable, searchable, and consistent across source code, tests, examples, and documentation.

## 1. Core Principles

- Use names that describe intent, behavior, and domain meaning.
- Prefer full words over unclear abbreviations.
- Avoid vague names such as `data`, `info`, `obj`, `temp`, `flag`, `handle`, `process`, `doSomething`, and `result` unless the scope is very small and obvious.
- Treat acronyms as normal words: use `imageUrl`, `userId`, `HtmlParser`, `HttpClient`, `ApiResponse`.
- Keep external naming styles only at external boundaries.

## 2. Case Conventions

| Target                   | Convention                       | Example                |
| ------------------------ | -------------------------------- | ---------------------- |
| Variables                | `camelCase`                      | `selectedImage`        |
| Local `const` values     | `camelCase`                      | `canvasWidth`          |
| Functions and methods    | `camelCase`                      | `applyCrop()`          |
| Object properties        | `camelCase`                      | `imageSource`          |
| Classes                  | `PascalCase`                     | `ImageEditor`          |
| Interfaces               | `PascalCase`                     | `ImageEditorOptions`   |
| Type aliases             | `PascalCase`                     | `CropMode`             |
| Enums                    | `PascalCase`                     | `ResizeMode`           |
| TypeScript enum members  | `PascalCase`                     | `ResizeMode.Cover`     |
| Generic type parameters  | `PascalCase`                     | `TInput`, `TOutput`    |
| True global constants    | `UPPER_SNAKE_CASE`               | `DEFAULT_CANVAS_WIDTH` |
| Constant maps            | `UPPER_SNAKE_CASE` variable name | `MIME_TYPES`           |
| File and directory names | `kebab-case`                     | `image-editor.ts`      |
| Test files               | `kebab-case` + test suffix       | `crop-mode.test.ts`    |

## 3. TypeScript Declarations

Use `PascalCase` for type-like declarations:

```ts
class ImageEditor {}
interface ImageEditorOptions {}
type CropMode = 'cover' | 'contain';
enum ResizeMode {
    Cover,
    Contain,
}
```

Do not prefix interfaces with `I`.

```ts
// Good
interface ImageEditorOptions {}

// Avoid
interface IImageEditorOptions {}
```

Do not add type-kind suffixes such as `Type`, `Interface`, or `Alias` unless the word is part of the domain meaning.

```ts
// Good
type ImageSource = File | Blob | string;
interface CropResult {}

// Avoid
type ImageSourceType = File | Blob | string;
interface CropResultInterface {}
```

Use meaningful role suffixes when they clarify purpose: `Options`, `Config`, `Payload`, `Result`, `State`, `Props`, `Params`, `Context`, `Event`, `Error`.

Use `interface` for object-shaped contracts, options, payloads, and extension points. Use `type` for unions, intersections, tuples, primitive aliases, mapped types, conditional types, and utility types.

## 4. Generic Type Parameters

Use `T` for a simple generic value type. Use descriptive names when there are multiple type parameters or when meaning matters.

| Generic    | Meaning              |
| ---------- | -------------------- |
| `T`        | Generic value type   |
| `TInput`   | Input type           |
| `TOutput`  | Output type          |
| `TOptions` | Options type         |
| `TEvent`   | Event type           |
| `TKey`     | Key type             |
| `TValue`   | Value type           |
| `TItem`    | Collection item type |
| `TState`   | State type           |

Examples: `Nullable<T>`, `Record<TKey, TValue>`, `Transformer<TInput, TOutput>`.

## 5. Private and Protected Members

Do not use `_` as a private or protected member prefix.

```ts
// Good
private canvas: fabric.Canvas;
protected history: HistoryManager;

// Avoid
private _canvas: fabric.Canvas;
protected _history: HistoryManager;
```

Use TypeScript `private` for normal project-level privacy. Use JavaScript `#private` only when runtime-enforced privacy is intentionally required and supported by the target environment.

## 6. Constants

Use `UPPER_SNAKE_CASE` only for true constants whose values are fixed and conceptually global.

```ts
const DEFAULT_CANVAS_WIDTH = 800;
const MAX_IMAGE_PIXELS = 12_000_000;

const MIME_TYPES = {
    PNG: 'image/png',
    JPEG: 'image/jpeg',
} as const;
```

Do not rename every `const` variable to uppercase. Local constants stay `camelCase`.

```ts
const targetWidth = 800;
const aspectRatio = image.width / image.height;
```

For fixed value sets, prefer string literal unions or `as const` objects when they are clearer than `enum`. When using TypeScript `enum`, use `PascalCase` for enum members.

## 7. Boolean Names

Boolean names should be positive and should use one of these prefixes:

| Prefix     | Example            |
| ---------- | ------------------ |
| `is`       | `isReady`          |
| `has`      | `hasSelection`     |
| `can`      | `canUndo`          |
| `should`   | `shouldRenderMask` |
| `allow`    | `allowRotation`    |
| `enable`   | `enableHistory`    |
| `requires` | `requiresRedraw`   |
| `supports` | `supportsWebp`     |

Avoid negative or double-negative names such as `isNotReady`, `noSelection`, `disableHistory`, or `preventRender`. For options and feature flags, prefer positive `enableXxx` names consistently.

## 8. Collections, Maps, Sets, and Records

Use plural names for arrays and iterable collections: `masks`, `selectedImages`, `toolbarItems`.

Use explicit suffixes for keyed collections:

| Structure     | Pattern     | Example         |
| ------------- | ----------- | --------------- |
| Array/List    | plural noun | `masks`         |
| Record by key | `xxxByYyy`  | `maskById`      |
| `Map`         | `xxxMap`    | `imageMap`      |
| `Set`         | `xxxSet`    | `selectedIdSet` |
| Count         | `xxxCount`  | `maskCount`     |
| Index         | `xxxIndex`  | `selectedIndex` |
| Length        | `xxxLength` | `historyLength` |

## 9. DOM, UI, and Canvas Names

DOM element variables should use the `Element` suffix: `canvasElement`, `uploadInputElement`, `toolbarElement`, `saveButtonElement`.

For non-DOM canvas or graphics objects, use domain names without `Element`: `canvas`, `activeObject`, `maskObject`.

For component-based UI, use `PascalCase` for components, `useXxx` for hooks, `XxxProps` for props, and `XxxState` for state types.

## 10. Function and Method Verbs

Function and method names should start with verbs that describe behavior precisely.

| Prefix           | Meaning                                  | Example                 |
| ---------------- | ---------------------------------------- | ----------------------- |
| `getXxx`         | Pure accessor without side effects       | `getActiveImage()`      |
| `setXxx`         | Direct assignment or replacement         | `setZoomRatio()`        |
| `updateXxx`      | Modify existing state or UI              | `updateToolbarState()`  |
| `createXxx`      | Create a new object or value             | `createMaskObject()`    |
| `buildXxx`       | Assemble a complex object                | `buildExportPayload()`  |
| `applyXxx`       | Apply an operation                       | `applyCrop()`           |
| `clearXxx`       | Remove content while keeping owner alive | `clearSelection()`      |
| `resetXxx`       | Restore defaults or initial state        | `resetCanvas()`         |
| `renderXxx`      | Render UI or canvas output               | `renderMaskList()`      |
| `exportXxx`      | Produce external output                  | `exportImage()`         |
| `serializeXxx`   | Convert to storable/string form          | `serializeState()`      |
| `deserializeXxx` | Restore from stored/string form          | `deserializeState()`    |
| `parseXxx`       | Parse raw or string input                | `parseCropMode()`       |
| `normalizeXxx`   | Normalize input to internal form         | `normalizeOptions()`    |
| `validateXxx`    | Validate input                           | `validateOptions()`     |
| `resolveXxx`     | Resolve from sources or fallbacks        | `resolveImageSource()`  |
| `computeXxx`     | Calculate a derived value                | `computeCropBounds()`   |
| `toXxx`          | Convert to another representation        | `toCanvasPoint()`       |
| `fromXxx`        | Create from another representation       | `fromSerializedState()` |
| `loadXxx`        | Load local resource or file              | `loadImageFile()`       |
| `fetchXxx`       | Fetch over network                       | `fetchImageMetadata()`  |
| `saveXxx`        | Persist data                             | `saveState()`           |
| `removeXxx`      | Remove a specific item                   | `removeMask()`          |
| `deleteXxx`      | Delete persisted or external data        | `deleteSavedPreset()`   |
| `disposeXxx`     | Release resources or listeners           | `disposeCanvas()`       |
| `destroyXxx`     | Permanently tear down an instance        | `destroyEditor()`       |

Avoid generic behavior names such as `processData()`, `handleData()`, `doUpdate()`, or `manageState()`.

## 11. Events, Handlers, and Callbacks

| Pattern             | Meaning                          | Example                           |
| ------------------- | -------------------------------- | --------------------------------- |
| `handleXxx`         | Internal event handler           | `handleUploadChange()`            |
| `onXxx`             | Public callback option           | `onImageLoad`                     |
| `emitXxx`           | Internal event/callback dispatch | `emitImageLoad()`                 |
| `addXxxListener`    | Listener registration            | `addSelectionChangeListener()`    |
| `removeXxxListener` | Listener removal                 | `removeSelectionChangeListener()` |

## 12. Type Guards, Assertions, and Errors

Use `isXxx` for type guards, `assertXxx` for assertion functions that throw, and `XxxError` for custom error classes.

```ts
function isFabricImage(value: unknown): value is fabric.Image {}
function assertCanvasReady(canvas: unknown): asserts canvas is fabric.Canvas {}
class ImageLoadError extends Error {}
```

## 13. Units and Measurements

Include units when a number is ambiguous.

| Suffix    | Meaning              | Example           |
| --------- | -------------------- | ----------------- |
| `Px`      | CSS or canvas pixels | `widthPx`         |
| `Ms`      | milliseconds         | `timeoutMs`       |
| `Seconds` | seconds              | `durationSeconds` |
| `Ratio`   | proportional value   | `scaleRatio`      |
| `Percent` | 0-100 percentage     | `progressPercent` |
| `Degrees` | degrees              | `rotationDegrees` |
| `Radians` | radians              | `angleRadians`    |
| `Count`   | number of items      | `maskCount`       |
| `Index`   | zero-based index     | `selectedIndex`   |
| `Id`      | identifier           | `imageId`         |
| `Url`     | URL string           | `imageUrl`        |

## 14. Async Names

Do not add `Async` to every Promise-returning function. Use `Async` only when both synchronous and asynchronous variants exist and the distinction matters.

```ts
function validateOptions(options: ImageEditorOptions): ValidationResult {}
async function validateOptionsAsync(options: ImageEditorOptions): Promise<ValidationResult> {}
```

## 15. File, Module, and Export Names

Use `kebab-case` for files and directories: `image-editor.ts`, `history-manager.ts`, `crop-controller.ts`, `test-utils/`.

Prefer clear module names over vague ones. Avoid `utils.ts`, `helpers.ts`, `common.ts`, and `misc.ts` when a more specific name is possible, such as `canvas-utils.ts`, `image-load-utils.ts`, or `dom-event-utils.ts`.

Test files should mirror the target module name: `image-editor.test.ts`, `history-manager.test.ts`, `crop-controller.test.ts`.

## 16. External Boundary Names

External systems may require different naming styles. Keep those names only at the boundary.

Acceptable boundary exceptions include third-party API fields, generated code, backend JSON contracts, external CSS class names, DOM attributes such as `aria-*` and `data-*`, and framework-required method names.

Convert external naming to internal naming as early as possible:

```ts
interface RawBackendPayload {
    image_url: string;
    created_at: string;
}

interface ImagePayload {
    imageUrl: string;
    createdAt: Date;
}
```
