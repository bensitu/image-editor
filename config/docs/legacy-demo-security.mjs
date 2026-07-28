/**
 * Defines the reviewed CSP and verified CDN assets for the isolated Legacy demo.
 *
 * @module
 */

function freezeAsset(asset) {
    return Object.freeze(asset);
}

export const LEGACY_DEMO_CSP =
    "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; " +
    "style-src 'self' https://cdn.jsdelivr.net; " +
    "img-src 'self' data: blob: https://upload.wikimedia.org; font-src 'self'; " +
    "connect-src 'self'; worker-src 'self' blob:; object-src 'none'; " +
    "base-uri 'self'; form-action 'self'";

export const LEGACY_DEMO_CDN_ASSETS = Object.freeze(
    [
        {
            kind: 'style',
            url: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css',
            integrity: 'sha384-sRIl4kxILFvY47J16cr9ZwB07vP4J8+LH7qKQnuqkuIAvNWLzeN8tE5YBujZqJLB',
        },
        {
            kind: 'script',
            url: 'https://cdn.jsdelivr.net/npm/lucide@1.17.0/dist/umd/lucide.min.js',
            integrity: 'sha384-bdZtphetAEBgkGZvhZXOFDWc55tHGLqaSo1f4qZtgvEiolEBqlJ9u6FTk+CoLfj0',
        },
        {
            kind: 'script',
            url: 'https://cdn.jsdelivr.net/npm/fabric@5.5.2/dist/fabric.min.js',
            integrity: 'sha384-dnr7M+/77nscyHpus9UkBDijHAK+2msD7nXVK61ft8LQWIyVJzGcsbwFUcJAzstd',
        },
        {
            kind: 'script',
            url: 'https://cdn.jsdelivr.net/npm/@bensitu/image-editor@1.5.2/dist/image-editor.min.js',
            integrity: 'sha384-AxUzjW6VM34ddv5TkXgOb4E5Fu9Dg/3Rhdwxb5v7lRK3ghu31C0kVt4cQX309qpH',
        },
    ].map(freezeAsset),
);
