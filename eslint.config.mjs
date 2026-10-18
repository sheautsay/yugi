// @ts-check
import eslint from '@eslint/js';
import angular from 'angular-eslint';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', '.angular/**', 'node_modules/**', 'src-tauri/**', 'build/**', 'test-results/**', 'docs/**', 'public/**'] },
  {
    files: ['src/**/*.ts'],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended, ...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      // Style-type rules relaxed for now (existing code uses short-circuit / ternary statements and a few `any`s).
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true }],
      '@typescript-eslint/no-explicit-any': 'off',
      // The BOM character in the deck parsers is intentional.
      'no-irregular-whitespace': ['error', { skipRegExps: true, skipStrings: true }],
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }],
    },
  },
  {
    files: ['src/**/*.html'],
    extends: [...angular.configs.templateRecommended],
    rules: {},
  },
);
