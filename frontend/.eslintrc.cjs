module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', 'coverage', '.eslintrc.cjs', 'vite.config.ts', 'vitest.config.ts'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    // 后端返回的是动态 JSON，接口字段逐层收窄前用 any 是可接受的过渡手段，
    // 因此降为提示而不是阻断。
    '@typescript-eslint/no-explicit-any': 'warn',
    // 本项目多个文件同时导出组件与 hook/工具函数，fast refresh 检查噪声太大。
    'react-refresh/only-export-components': 'off',
  },
}
