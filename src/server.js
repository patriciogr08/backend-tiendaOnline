// src/server.js
import http from 'http';
import env from './config/env.js';
import { createApp } from './app.js';

const app = createApp();
const server = http.createServer(app);

server.listen(env.PORT, env.HOST, () => {
  const base = env.PUBLIC_URL || `http://${env.HOST}:${env.PORT}`;
  console.log(`API listening on ${base}`);
  console.log(`Static images at ${base}/images`);
});

function shutdown(signal) {
  console.log(`\nReceived ${signal}. Closing server...`);
  server.close(err => {
    if (err) {
      console.error('Error on close:', err);
      process.exit(1);
    }
    console.log('HTTP server closed. Bye!');
    process.exit(0);
  });
}
['SIGINT', 'SIGTERM'].forEach(s => process.on(s, () => shutdown(s)));
