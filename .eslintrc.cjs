module.exports = {
  env: {
    es2021: true,
    node: true
  },
  extends: ['standard', 'prettier'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  globals: {
    Bot: true,
    redis: true,
    logger: true,
    plugin: true
  },
  plugins: ['prettier'],
  rules: {
    eqeqeq: ['off'],
    'prefer-const': ['off'],
    'prettier/prettier': 'error',
    'arrow-body-style': 'off',
    'prefer-arrow-callback': 'off',
    'space-before-function-paren': 'off'
  }
}
