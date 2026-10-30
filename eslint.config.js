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
        google: 'readonly', // Google Maps JavaScript API (CDN経由)
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
    files: ['tests/**/*.mjs', 'tests/**/*.js', 'playwright.config.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: { 'no-console': 'off' },
  },
  {
    files: ['tests/r*-browser.mjs', 'tests/common-browser.mjs'],
    rules: {
      'no-restricted-syntax': ['error',
        {
          selector: "CallExpression[callee.object.name='route'][callee.property.name='continue']",
          message: 'Use route.fallback() to preserve the offline network boundary.',
        },
        {
          selector: "CallExpression[callee.object.name='route'][callee.property.name='fetch']",
          message: 'Use fixed fixtures instead of fetching an external API.',
        },
      ],
    },
  },
  {
    ignores: ['node_modules/**', 'assets/**'],
  },
];
