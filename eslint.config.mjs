// Flat ESLint config for the TrueKart extension.
// The codebase is vanilla JS: UMD modules (utils/, detection/), classic browser
// scripts (popup/, options/), MV3 service worker + offscreen docs, and CommonJS
// tests/scripts. One permissive-globals block covers all of them; the value is
// in `no-unused-vars` / `no-undef` catching dead code and typos that
// `node --check` cannot.
import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'libs/**', // vendored (exifr, onnx runtime)
      'test-results/**',
      'playwright-report/**',
      'research/**',
      '.github/skills/**', // vendored agent-skill scripts, not extension code
      '.agents/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
        ...globals.node,
        chrome: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-constant-condition': ['error', { checkLoops: false }],
      // Playwright fixtures use the idiomatic `async ({}, use) => …` signature.
      'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }],
    },
  },
  {
    // ES module config/build files.
    files: ['**/*.mjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.node } },
  },
];
