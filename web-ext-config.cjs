// web-ext configuration — keeps dev/tooling files out of the packaged zip.
module.exports = {
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
    'web-ext-config.cjs',
    'README.md',
    '.gitignore',
  ],
  build: {
    overwriteDest: true,
  },
};
