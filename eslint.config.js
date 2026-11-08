import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'release', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
  {
    // Text the operator sees or sends must never ship a template placeholder like "[Your Name]" (QA 2026-11-07 #2, #3).
    files: ['src/renderer/**/*.{ts,tsx}', 'src/shared/templates/**/*.ts', 'src/core/**/*.ts'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: 'Literal[value=/\\[[A-Z][A-Za-z ]{1,30}\\]/]', message: 'Template placeholder in shipped text. Use the real value (e.g. settings.fullName).' },
        { selector: 'TemplateElement[value.raw=/\\[[A-Z][A-Za-z ]{1,30}\\]/]', message: 'Template placeholder in shipped text. Use the real value (e.g. settings.fullName).' },
        { selector: 'JSXText[value=/\\[[A-Z][A-Za-z ]{1,30}\\]/]', message: 'Template placeholder in shipped text. Use the real value.' },
      ],
    },
  },
  {
    files: ['src/main/**', 'src/preload/**', 'src/infra/**', 'scripts/**', '*.config.ts'],
    languageOptions: { globals: globals.node },
  },
);
