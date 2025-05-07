import pluginJs from '@eslint/js';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
      ignores: ["dist/"]
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
      '@typescript-eslint/no-floating-promises': 'error',
      'simple-import-sort/exports': 'error',
      'simple-import-sort/imports': 'error'
    }
  }
);
