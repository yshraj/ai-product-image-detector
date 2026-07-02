#!/usr/bin/env node
// Chrome-appropriate sanity check for the extension:
//   1. manifest.json parses
//   2. every file the manifest references exists
//   3. every project .js file passes `node --check` (skips vendored libs)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
let errors = 0;
const fail = (msg) => { console.error('  ✗ ' + msg); errors++; };
const ok = (msg) => console.log('  ✓ ' + msg);

// 1. manifest
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  ok('manifest.json parses');
} catch (e) {
  fail('manifest.json invalid: ' + e.message);
  process.exit(1);
}

// 2. referenced files
const refs = [
  ...(manifest.content_scripts?.[0]?.js || []),
  ...(manifest.content_scripts?.[0]?.css || []),
  manifest.background?.service_worker,
  manifest.action?.default_popup,
  manifest.options_ui?.page,
  ...Object.values(manifest.icons || {}),
].filter(Boolean);

for (const ref of refs) {
  if (!fs.existsSync(path.join(root, ref))) fail('missing referenced file: ' + ref);
}
if (errors === 0) ok(`all ${refs.length} referenced files present`);

// 3. syntax-check project JS (skip libs/)
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'libs', 'dist', '.git'].includes(entry.name)) continue;
      walk(full);
    } else if (entry.name.endsWith('.js')) {
      try {
        execFileSync(process.execPath, ['--check', full], { stdio: 'pipe' });
      } catch (e) {
        fail(`syntax error in ${path.relative(root, full)}: ${e.message.split('\n')[0]}`);
      }
    }
  }
}
walk(root);
if (errors === 0) ok('all project JS files pass syntax check');

// 4. version alignment (package.json ↔ manifest)
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (pkg.version !== manifest.version) {
    fail(`version mismatch: package.json ${pkg.version} vs manifest ${manifest.version}`);
  } else {
    ok(`version ${manifest.version} aligned across package.json and manifest`);
  }
} catch (e) {
  fail('package.json version check failed: ' + e.message);
}

// 5. no stray debugger statements in shipped JS
const shipDirs = ['background', 'content', 'compare', 'detection', 'options', 'popup', 'utils'];
for (const dir of shipDirs) {
  const base = path.join(root, dir);
  if (!fs.existsSync(base)) continue;
  for (const file of fs.readdirSync(base, { recursive: true })) {
    if (!String(file).endsWith('.js')) continue;
    const full = path.join(base, file);
    const src = fs.readFileSync(full, 'utf8');
    if (/\bdebugger\b/.test(src)) fail(`debugger statement in ${path.relative(root, full)}`);
  }
}
if (errors === 0) ok('no debugger statements in shipped JS');

console.log(errors === 0 ? '\n✅ validate: PASS' : `\n❌ validate: ${errors} problem(s)`);
process.exit(errors === 0 ? 0 : 1);
