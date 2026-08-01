/**
 * Applies the persisted or system theme before the archived demo renders.
 *
 * @module
 */

(function () {
    'use strict';

    try {
        const storedTheme = window.localStorage.getItem('imageEditorDemoTheme');
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
        document.documentElement.setAttribute('data-bs-theme', storedTheme || systemTheme);
    } catch {
        document.documentElement.setAttribute('data-bs-theme', 'light');
    }
})();
