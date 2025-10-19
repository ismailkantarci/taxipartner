import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

const tsProjects = [
  './tsconfig.app.json',
  './identity/tsconfig.typecheck.json',
  './taxipartner-admin/tsconfig.typecheck.json'
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.cache/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/playwright-report/**',
      'apps/design-system/storybook-static/**',
      'modules/library/dist/**',
      'frontend/dist/**',
      'frontend/**',
      'modules/**',
      'apps/**',
      'tests/**',
      'taxipartner-admin/src/**',
      'identity/**',
      'scripts/**',
      'prisma/**',
      'taxipartner-admin/tailwind.config.js',
      'src/hooks/useQuerySync.ts',
      'src/lib/repo/http.js',
      'vite.config.js',
      'taxipartner-admin/dist/**',
      'taxipartner-admin-suite@*/**',
      'taxipartner-admin@*/**',
      'taxipartner-identity@*/**',
      'tmp/**'
    ]
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-empty': 'off',
      'react-hooks/exhaustive-deps': 'off',
      '@typescript-eslint/no-unused-vars': 'off'
    }
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: tsProjects,
        tsconfigRootDir: rootDir
      }
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': ['warn', { checksVoidReturn: false }],
      '@typescript-eslint/consistent-type-imports': 'warn',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      'no-empty': 'off',
      'prefer-const': 'off'
    }
  },
  {
    files: ['identity/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './identity/tsconfig.typecheck.json',
        tsconfigRootDir: rootDir
      }
    }
  },
  {
    files: ['taxipartner-admin/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: './taxipartner-admin/tsconfig.typecheck.json',
        tsconfigRootDir: rootDir
      }
    }
  },
  {
    files: ['apps/design-system/.storybook/**/*.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  },
  {
    rules: {
      'react-hooks/exhaustive-deps': 'off'
    }
  }
);
