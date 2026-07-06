module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
  ],
  rules: {
    'react/no-unknown-property': ['error', {
      ignore: ['webpreferences', 'partition', 'preload', 'allowpopups']
    }]
  }
}
