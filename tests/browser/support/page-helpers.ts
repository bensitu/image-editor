import { expect, type Locator, type Page } from '@playwright/test';
import type {
    CallbackRecord,
    ExportPreviewResult,
    HarnessCreateOptions,
    ImageEditorTestHarness,
} from '../pages/basic-editor';
import type { ImageExportOptions } from '@bensitu/image-editor';

const harnessPath = '/tests/browser/pages/basic-editor.html';

type HarnessMethodName = {
    [Key in keyof ImageEditorTestHarness]: ImageEditorTestHarness[Key] extends (
        ...args: infer _Args
    ) => unknown
        ? Key
        : never;
}[keyof ImageEditorTestHarness];

type HarnessMethodArgs<Key extends HarnessMethodName> = ImageEditorTestHarness[Key] extends (
    ...args: infer Args
) => unknown
    ? Args
    : never;

type HarnessMethodReturn<Key extends HarnessMethodName> = ImageEditorTestHarness[Key] extends (
    ...args: infer _Args
) => infer Return
    ? Awaited<Return>
    : never;

export async function openEditor(page: Page, createOptions?: HarnessCreateOptions): Promise<void> {
    await page.goto(harnessPath);
    await page.waitForFunction(() => {
        return Boolean(
            (
                window as typeof window & {
                    __imageEditorTest?: unknown;
                }
            ).__imageEditorTest,
        );
    });
    if (createOptions) {
        await callHarness(page, 'createEditor', createOptions);
    }
}

export async function callHarness<Key extends HarnessMethodName>(
    page: Page,
    methodName: Key,
    ...methodArgs: HarnessMethodArgs<Key>
): Promise<HarnessMethodReturn<Key>> {
    return (await page.evaluate(
        async ({ evaluatedMethodName, evaluatedMethodArgs }) => {
            const testWindow = window as typeof window & {
                __imageEditorTest: Record<string, (...args: unknown[]) => unknown>;
            };
            const method = testWindow.__imageEditorTest[evaluatedMethodName];
            if (typeof method !== 'function') {
                throw new Error(`Unknown image editor test harness method: ${evaluatedMethodName}`);
            }
            return await method(...evaluatedMethodArgs);
        },
        {
            evaluatedMethodName: String(methodName),
            evaluatedMethodArgs: methodArgs as unknown[],
        },
    )) as HarnessMethodReturn<Key>;
}

export function upperCanvas(page: Page): Locator {
    return page.locator('.upper-canvas').first();
}

export async function clickCanvas(page: Page, x: number, y: number): Promise<void> {
    const canvas = upperCanvas(page);
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Fabric upper canvas is not visible.');
    await page.mouse.move(box.x + x, box.y + y);
    await page.mouse.down();
    await page.mouse.up();
}

export async function dragCanvas(
    page: Page,
    points: Array<{ x: number; y: number }>,
): Promise<void> {
    if (points.length < 2) throw new Error('dragCanvas requires at least two points.');
    const canvas = upperCanvas(page);
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Fabric upper canvas is not visible.');
    const [firstPoint, ...remainingPoints] = points;
    await page.mouse.move(box.x + firstPoint.x, box.y + firstPoint.y);
    await page.mouse.down();
    for (const point of remainingPoints) {
        await page.mouse.move(box.x + point.x, box.y + point.y);
    }
    await page.mouse.up();
}

export async function waitForCallback(
    page: Page,
    predicate: (record: CallbackRecord) => boolean,
): Promise<void> {
    await expect
        .poll(async () => {
            const records = await callHarness(page, 'getCallbackRecords');
            return records.some(predicate);
        })
        .toBe(true);
}

export async function waitForHistory(
    page: Page,
    expected: { canUndo: boolean; canRedo: boolean },
): Promise<void> {
    await expect
        .poll(async () => {
            const state = await callHarness(page, 'getState');
            return {
                canUndo: state.canUndo,
                canRedo: state.canRedo,
            };
        })
        .toEqual(expected);
}

export async function expectPreviewScreenshot(
    page: Page,
    screenshotName: string,
    exportOptions: ImageExportOptions = { fileType: 'png' },
): Promise<ExportPreviewResult> {
    const result = await callHarness(page, 'exportToPreview', exportOptions);
    await expect(page.locator('#export-preview')).toHaveScreenshot(screenshotName, {
        maxDiffPixelRatio: 0.01,
    });
    return result;
}
