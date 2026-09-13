import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.resolve(__dirname, '..', 'apps', 'web', 'dist');
const port = Number(process.env.WEB_PORT ?? 3000);
const host = process.env.WEB_HOST ?? '0.0.0.0';

if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
  console.error(`Web dist folder not found at ${distDir}`);
  console.error('Run build first: pnpm build');
  process.exit(1);
}

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

function safeJoin(base, reqPath) {
  const decoded = decodeURIComponent(reqPath);
  const clean = decoded.split('?')[0].split('#')[0];
  const normalized = path.posix.normalize(clean).replace(/^(\.\.(\/|\\|$))+/, '');
  return path.join(base, normalized);
}

const server = http.createServer((req, res) => {
  if (!req.url || req.method !== 'GET') {
    res.statusCode = 405;
    res.end('Method not allowed');
    return;
  }

  const urlPath = req.url === '/' ? '/index.html' : req.url;
  let filePath = safeJoin(distDir, urlPath);

  // If a direct file doesn't exist, fall back to SPA entry
  if (!existsSync(filePath) || (existsSync(filePath) && statSync(filePath).isDirectory())) {
    filePath = path.join(distDir, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = contentTypes[ext] ?? 'application/octet-stream';
  res.setHeader('Content-Type', contentType);

  // PWA bootstrap files keep a stable filename across deploys (unlike hashed
  // /assets/*), so caching them immutably strands clients on a stale service
  // worker that keeps referencing deleted hashed bundles after a redeploy.
  const fileName = path.basename(filePath);
  const isPwaBootstrapFile =
    fileName === 'sw.js' || fileName === 'registerSW.js' || ext === '.webmanifest';

  if (filePath.endsWith('.html') || isPwaBootstrapFile) {
    res.setHeader('Cache-Control', 'no-cache');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }

  createReadStream(filePath)
    .on('error', () => {
      res.statusCode = 500;
      res.end('Server error');
    })
    .pipe(res);
});

server.listen(port, host, () => {
  console.log(`ZimHealth Web serving ${distDir}`);
  console.log(`Listening on http://${host}:${port}`);
});
