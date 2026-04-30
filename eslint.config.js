import globals from 'globals';
import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        L: 'readonly', // Leaflet.js (CDN経由)
      },
    },
    rules: {
      // --- バグ防止 ---
      'eqeqeq':                    ['error', 'always'],
      'no-return-assign':          'error',
      'no-throw-literal':          'error',
      'prefer-promise-reject-errors': 'error',
      'no-unused-vars':            ['error', { argsIgnorePattern: '^_' }],

      // --- モダンJS強制 ---
      'no-var':                    'error',
      'prefer-const':              'error',

      // --- スタイル ---
      'semi':                      ['error', 'always'],
      'quotes':                    ['error', 'single', { avoidEscape: true }],
      'no-trailing-spaces':        'error',
      'eol-last':                  ['error', 'always'],

      // --- デバッグ残留防止 ---
      'no-console':                'warn',
    },
  },
  {
    ignores: ['node_modules/**', 'assets/**'],
  },
];
