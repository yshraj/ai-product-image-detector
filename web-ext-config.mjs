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
    'eslint.config.mjs',
    'package.json',
    'package-lock.json',
    'web-ext-config.mjs',
    'research',
    'CHANGELOG.md',
    'LICENSE',
    'README.md',
    '.gitignore',
    '.github',
    '.agents',
    'logos',
    'CHROMEWEBSTORE.md',
    'FEATURES.md',
    'skills-lock.json',
    // On-device engine assets: the ONNX Runtime + offscreen detector are only
    // needed for the opt-in on-device model (see docs/ONDEVICE.md). Excluded
    // from the default lean build (~120 KB); a full/on-device build includes
    // them. The engine degrades gracefully when they're absent.
    'offscreen',
    'libs/onnx',
  ],
  build: {
    overwriteDest: true,
  },
};
