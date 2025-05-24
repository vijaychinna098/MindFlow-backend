// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add specific configurations
config.resolver.sourceExts = ['jsx', 'js', 'ts', 'tsx', 'json'];

// Ensure both index.js and App.js are recognized as entry points
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// Add server configuration for better cross-device support
config.server = {
  port: 8081,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // Add more permissive CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      return middleware(req, res, next);
    };
  },
};

// Make source maps work better
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    keep_classnames: true,
    keep_fnames: true,
    mangle: {
      keep_classnames: true,
      keep_fnames: true
    },
  },
};

module.exports = config;
