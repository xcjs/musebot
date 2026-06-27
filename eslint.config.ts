import pluginJs from '@eslint/js';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'coverage/', '.gitlab-ci/']
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      },
    },
  },
  {
    ...pluginJs.configs.recommended,
    files: ['src/**/*.{js,cjs,mjs,ts}'],
    languageOptions: {
      sourceType: 'script',
      globals: globals.node
    },
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'simple-import-sort/exports': 'error',
      'simple-import-sort/imports': 'error'
    }
  },
  {
    files: ['src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off'
    }
  }
);
