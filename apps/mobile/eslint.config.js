const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');

module.exports = defineConfig([
  {
    ignores: ['dist/**', 'node_modules/**', '.expo/**', 'dist/**/*'],
  },
  expo,
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
