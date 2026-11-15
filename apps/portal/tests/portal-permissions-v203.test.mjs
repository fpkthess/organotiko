import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const ui = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const lib = readFileSync(new URL('../src/lib.ts', import.meta.url), 'utf8');
const worker = readFileSync(new URL('../worker/index.js', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/008_audit_only_admin_and_new_domain.sql', import.meta.url), 'utf8');
test('the public and Worker username aliases both use protoporiathess.com', () => {
 assert.match(lib, /LOGIN_DOMAIN = 'protoporiathess\.com'/);
 assert.match(worker, /LOGIN_DOMAIN = 'protoporiathess\.com'/);
 assert.match(migration, /@protoporiathess\.com/);
});
test('Audit Log is visible to Admin only, independent of persisted view_audit grants', () => {
 assert.match(ui, /const canViewAudit=isAdmin;/);
 assert.match(ui, /const audits=\(p\.data\.role==='admin'\)\?/);
 assert.doesNotMatch(ui, /rights\.view_audit/);
 assert.match(migration, /active AND role='admin'/);
});
test('inherited role permissions appear checked and locked', () => {
 assert.match(ui, /checked=\{\['admin','leadership'\]\.includes\(rightsTarget\.role\)\} disabled readOnly/);
 assert.match(ui, /checked=\{rightsTarget\.role==='admin'\} disabled readOnly/);
});
