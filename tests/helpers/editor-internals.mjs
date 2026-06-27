/**
 * Test-only accessors for ImageEditor runtime state.
 *
 * Prefer public ImageEditor APIs in integration tests. Use these helpers only
 * for implementation-level tests that need Fabric objects, runtime sessions,
 * or guard/history internals that are intentionally not public.
 */

import assert from 'node:assert/strict';

function getEditorRuntime(editor) {
    assert.ok(editor.runtime, 'expected ImageEditor runtime to exist');
    return editor.runtime;
}

function getEditorCanvas(editor) {
    return getEditorRuntime(editor).canvas;
}

export function requireEditorCanvas(editor) {
    const canvas = getEditorCanvas(editor);
    assert.ok(canvas, 'expected ImageEditor canvas to exist');
    return canvas;
}

function getOriginalImage(editor) {
    return getEditorRuntime(editor).originalImage;
}

export function requireOriginalImage(editor) {
    const image = getOriginalImage(editor);
    assert.ok(image, 'expected ImageEditor original image to exist');
    return image;
}

export function setOriginalImage(editor, image) {
    getEditorRuntime(editor).originalImage = image;
}

export function getHistoryManager(editor) {
    return getEditorRuntime(editor).historyManager;
}

export function getOperationGuard(editor) {
    return getEditorRuntime(editor).operationGuard;
}

export function setCropSession(editor, session) {
    getEditorRuntime(editor).cropSession = session;
}

export function getMosaicSession(editor) {
    return getEditorRuntime(editor).mosaicSession;
}

export function setTextSession(editor, session) {
    getEditorRuntime(editor).textSession = session;
}

export function setDrawSession(editor, session) {
    getEditorRuntime(editor).drawSession = session;
}

export function getCurrentScale(editor) {
    return getEditorRuntime(editor).currentScale;
}

export function setCurrentScale(editor, scale) {
    getEditorRuntime(editor).currentScale = scale;
}

export function getCurrentRotation(editor) {
    return getEditorRuntime(editor).currentRotation;
}

export function setCurrentRotation(editor, rotation) {
    getEditorRuntime(editor).currentRotation = rotation;
}

export function getBaseImageScale(editor) {
    return getEditorRuntime(editor).baseImageScale;
}

export function setBaseImageScale(editor, scale) {
    getEditorRuntime(editor).baseImageScale = scale;
}

export function setCurrentLayoutMode(editor, mode) {
    getEditorRuntime(editor).currentLayoutMode = mode;
}

export function setLastSnapshot(editor, snapshot) {
    getEditorRuntime(editor).lastSnapshot = snapshot;
}
