import pluginJs from '@eslint/js';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...tseslint.configs.recommended,
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
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    }
  }
);
