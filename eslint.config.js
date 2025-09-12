// leaugueofchoding/wooriban-league/wooriban-league-ad2abd8122801a36b5845b6e315a8c75c3702c90/eslint.config.js

import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react'; // ◀◀◀ [추가]
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    plugins: { // ◀◀◀ [추가] plugins 객체
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2020,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: { // ◀◀◀ [추가] react 버전 자동 감지
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules, // ◀◀◀ [추가] react 추천 규칙
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'warn',
      'react/prop-types': 'off', // ◀◀◀ [추가] prop-types 규칙 비활성화
      'react/react-in-jsx-scope': 'off', // ◀◀◀ [추가] React import 규칙 비활성화
    },
  },
]);