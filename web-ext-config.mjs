// web-ext configuration — keeps dev/tooling files out of the packaged zip.
export default {
  ignoreFiles: [
    'node_modules',
    'dist',
    'docs',
    'scripts',
    'test',
    'test-results',
    'playwright-report',
    'playwright.config.cjs',
    'package.json',
    'package-lock.json',
    'web-ext-config.mjs',
    'web-ext-config.cjs',
    'research',
    'qa-screenshots',
    'CHANGELOG.md',
    'LICENSE',
    'README.md',
    '.gitignore',
    '.github',
  ],
  build: {
    overwriteDest: true,
  },
};
