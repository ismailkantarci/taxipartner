// Flat config for ESLint v9+
import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        location: 'readonly',
        performance: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        URLSearchParams: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        sessionStorage: 'readonly',
        Event: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        requestAnimationFrame: 'readonly',
        caches: 'readonly',
        // Vitest globals
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        vi: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'all', caughtErrorsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-useless-escape': 'off'
    }
  },
  // Node scripts
  {
    files: ['scripts/**/*.mjs', 'scripts/**/*.js', 'vite.config.js', 'commitlint.config.cjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly'
      }
    }
  },
  // Service worker
  {
    files: ['sw.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'script',
      globals: {
        self: 'readonly',
        caches: 'readonly',
        clients: 'readonly',
        URL: 'readonly',
        fetch: 'readonly'
      }
    }
  }
];
