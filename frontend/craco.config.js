const webpack = require('webpack');

module.exports = {
  devServer: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.REACT_APP_API_URL || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
      webpackConfig.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^@signalapp\/libsignal-client$/,
        })
      );
      return webpackConfig;
    },
  },
};