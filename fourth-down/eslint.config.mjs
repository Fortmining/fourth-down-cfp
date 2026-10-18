import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
export default [{ ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] }, {
 files: ['app/**/*.ts', 'app/**/*.tsx'],
 languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
 plugins: { 'react-hooks': hooks },
 rules: { 'no-unreachable': 'error', 'no-constant-condition': 'error', 'no-duplicate-case': 'error', 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'error' },
}];
