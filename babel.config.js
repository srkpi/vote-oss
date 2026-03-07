module.exports = function (api) {
  const isTest = api.env('test');

  return {
    presets: [
      isTest ? ['@babel/preset-env', { targets: { node: 'current' } }] : 'next/babel',
      '@babel/preset-typescript',
    ],
    plugins: [],
  };
};
