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
    {
      // Expo Metro bundler — physical device connects via tunnel URL shown in logs.
      // Requires apps/mobile/.env to exist on the server with EXPO_PUBLIC_API_URL
      // set to the server's public IP (e.g. http://173.212.195.88:4000).
      // View the QR code / tunnel URL with:  pm2 logs zimhealth-expo --lines 50
      name: 'zimhealth-expo',
      cwd: path.join(root, 'apps', 'mobile'),
      script: 'pnpm',
      args: ['exec', 'expo', 'start', '--tunnel', '--non-interactive'],
      autorestart: true,
      max_restarts: 5,
      restart_delay: 5000,
      // Expo reads EXPO_PUBLIC_* from apps/mobile/.env automatically.
      // The env block below is intentionally empty — do not add EXPO_PUBLIC_*
      // here; set them in apps/mobile/.env on the server instead.
      env: {},
    },
  ],
};
