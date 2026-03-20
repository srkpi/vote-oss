import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tailwindCanonicalClasses from 'eslint-plugin-tailwind-canonical-classes';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettierConfig,
  ...tailwindCanonicalClasses.configs['flat/recommended'],
  {
    plugins: {
      prettier: prettierPlugin,
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'prettier/prettier': ['error', { singleQuote: true, semi: true }],
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'tailwind-canonical-classes/tailwind-canonical-classes': [
        'warn',
        {
          cssPath: './src/app/globals.css',
          calleeFunctions: ['cn', 'clsx'],
        },
      ],
    },
  },
  {
    files: ['**/__tests__/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'allure-report/**',
    'allure-results/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
