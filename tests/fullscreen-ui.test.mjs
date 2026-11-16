import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const table=fs.readFileSync(new URL('../apps/organotiko/src/TableWorkspace.tsx',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../apps/organotiko/src/styles.css',import.meta.url),'utf8');
test('full-window table uses CSS, not native element fullscreen that hides EF dialog',()=>{
  assert.match(table,/table-fullscreen-mode/);
  assert.doesNotMatch(table,/ref\.current\?\.requestFullscreen\(\)/);
  assert.doesNotMatch(table,/document\.exitFullscreen\(\)/);
  assert.match(table,/setIsFullscreen\(false\)/);
});
test('EF dialog and student profile appear above full-window table',()=>{
  assert.match(css,/\.table-workspace\.table-fullscreen-mode\s*\{/);
  assert.match(css,/\.modal-wrap\s*\{\s*z-index:110!important/);
  assert.match(css,/\.drawer-screen\s*\{\s*z-index:105!important/);
});
