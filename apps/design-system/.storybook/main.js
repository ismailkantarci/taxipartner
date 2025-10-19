

const { resolve } = require('node:path');

const repoRoot = resolve(__dirname, '../../..');
const libraryDir = resolve(repoRoot, 'modules/library');

/** @type { import('@storybook/html-vite').StorybookConfig } */
const config = {
  "stories": [
    "../stories/**/*.mdx",
    "../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  "addons": [
    "@storybook/addon-essentials",
    "@storybook/addon-interactions"
  ],
  "framework": {
    "name": "@storybook/html-vite",
    "options": {}
  },
  async viteFinal(baseConfig) {
    const config = { ...baseConfig };
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@taxipartner/library': libraryDir
    };

    config.server = config.server || {};
    config.server.fs = config.server.fs || {};
    const allow = new Set([...(config.server.fs.allow || []), repoRoot, libraryDir]);
    config.server.fs.allow = Array.from(allow);

    config.optimizeDeps = config.optimizeDeps || {};
    const include = new Set([...(config.optimizeDeps.include || [])]);
    include.add('intl-tel-input');
    config.optimizeDeps.include = Array.from(include);

    return config;
  }
};
module.exports = config;
