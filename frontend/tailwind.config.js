import baseConfig from '../tailwind.config.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const resolveFromFrontend = (...segments) => path.join(__dirname, ...segments);

export default {
  ...baseConfig,
  content: [
    resolveFromFrontend('../index.html'),
    resolveFromFrontend('../modules/**/*.{js,ts,html}'),
    resolveFromFrontend('../src/**/*.{js,ts,jsx,tsx}'),
    resolveFromFrontend('./index.html'),
    resolveFromFrontend('./src/**/*.{js,ts,jsx,tsx,html}')
  ]
};
