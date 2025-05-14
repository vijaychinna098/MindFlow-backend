// config.js
const isDev = process.env.NODE_ENV !== 'production';
const devPort = 3001;
const prodPort = 5000;

module.exports = {
  API_BASE_URL: process.env.API_BASE_URL || `http://localhost:${isDev ? devPort : prodPort}`
};