'use strict';

const http = require('http');
const app = require('./app');
const config = require('./config');

const server = http.createServer(app);

server.listen(config.server.port, () => {
  console.log(`iborg-dating server running on port ${config.server.port} [${config.server.nodeEnv}]`);
});

module.exports = server;
