const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

// Always resolve relative to this file, not wherever `expo start` is invoked
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Allow Metro to resolve shared packages from the monorepo root
config.watchFolders = [monorepoRoot];

// Prefer local node_modules first, then fall back to the monorepo root
// (required for pnpm hoisting)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = withNativeWind(config, { input: './global.css' });
