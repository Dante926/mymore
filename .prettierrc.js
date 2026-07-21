module.exports = {
  printWidth: 150,
  tabWidth: 2,
  useTabs: false,
  singleQuote: true,
  trailingComma: 'all',
  bracketSpacing: true,
  arrowParens: 'always',
  endOfLine: 'lf',
  proseWrap: 'preserve',
  plugins: [require.resolve('prettier-plugin-packagejson')],
};
