/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');

const root = __dirname;

module.exports = {
  apps: [
    {
      name: 'zimhealth-api',
      cwd: root,
      // Use dotenv-cli to load .env reliably (PM2 env_file has been unreliable in some environments)
      script: 'pnpm',
      args: [
        'exec',
        'dotenv',
        '-e',
        path.join(root, '.env'),
        '--',
        'node',
        path.join(root, 'backend', 'dist', 'app.js'),
      ],
      env: {
        // backend reads process.env.PORT
        PORT: process.env.API_PORT || '4000',
      },
    },
    {
      name: 'zimhealth-bot',
      cwd: root,
      script: 'pnpm',
      args: [
        'exec',
        'dotenv',
        '-e',
        path.join(root, '.env'),
        '--',
        'node',
        path.join(root, 'apps', 'whatsapp-bot', 'dist', 'index.js'),
      ],
    },
    {
      name: 'zimhealth-web',
      cwd: root,
      script: path.join(root, 'scripts', 'web-server.mjs'),
      env_file: path.join(root, '.env'),
    },
  ],
};
