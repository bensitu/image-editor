module.exports = {
    root: true,
    env: {
        browser: true,
        node: true,
        es2022: true
    },
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module'
    },
    extends: [
        'eslint:recommended'
    ],
    rules: {
        'no-unused-vars': 'warn',
        'no-console': 'warn'
    }
};