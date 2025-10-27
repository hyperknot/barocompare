import { fileURLToPath } from 'node:url'
import { includeIgnoreFile } from '@eslint/compat'
import js from '@eslint/js'
import * as tsParser from '@typescript-eslint/parser'
import { defineConfig, globalIgnores } from 'eslint/config'
import solid from 'eslint-plugin-solid/configs/typescript'
import tseslint from 'typescript-eslint'

const gitignorePath = fileURLToPath(new URL('.gitignore', import.meta.url))

export default defineConfig([
  includeIgnoreFile(gitignorePath, 'Imported .gitignore patterns'),
  globalIgnores([
    // Build outputs
    '**/*.bak/**',
    '**/.idea/**',
    '**/cdn/**',

    // Debug and development files
    '**/debug/**',

    // Config files
    '**/*.config.ts',
    '**/*.cjs',
    '**/*.js',
    '**/*.mjs',

    // Other files to ignore
    '**/_not_used/**',
  ]),

  js.configs.recommended,
  tseslint.configs.recommended,

  // Configuration for app/frontend files (SolidJS) - matches tsconfig.app.json
  {
    files: ['fe/**/*.{ts,tsx}'],
    extends: [solid],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.app.json',
      },
    },
    plugins: {},
    rules: {},
  },

  // Configuration for Node.js files - matches tsconfig.node.json
  {
    files: ['**/vite.config.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.node.json',
      },
    },
    rules: {},
  },

  // Global rules for all files
  {
    rules: {
      'no-empty': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
])
