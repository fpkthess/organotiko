import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/010_task_edit_delete.sql',import.meta.url),'utf8');
const ui=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
test('edit: server-side manager checks and validation',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.edit_task_details/);
 assert.match(sql,/public\.can_manage_team\(v_task\.team_id\)/);
 assert.match(sql,/char_length\(btrim\(coalesce\(p_title/);
 assert.match(sql,/5000/);
 assert.match(sql,/p_priority NOT IN/);
 assert.match(sql,/p_review_required IS NULL/);
});
test('edit: preserves team, event, status and created_by while auditing via trigger',()=>{
 const edit=sql.split('CREATE OR REPLACE FUNCTION public.edit_task_details')[1].split('CREATE OR REPLACE FUNCTION public.delete_task_record')[0];
 assert.match(edit,/UPDATE public\.tasks\s+SET title=/);
 assert.doesNotMatch(edit,/SET team_id=|SET event_id=|SET status=|SET created_by=/);
});
test('delete: server-side manager gate, audit and database cascades',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.delete_task_record/);
 assert.match(sql,/DELETE FROM public\.tasks WHERE id=v_task\.id/);
 assert.match(sql,/INSERT INTO public\.audit_log/);
 assert.match(sql,/details\)/);
 assert.match(sql,/'delete',jsonb_build_object/);
 assert.match(sql,/auth\.uid\(\)/);
});
test('delete: last-assignee protection remains for ordinary removal',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.prevent_last_assignee/);
 assert.match(sql,/IF NOT FOUND THEN RETURN old/);
 assert.match(sql,/Δεν μπορείς να αφαιρέσεις τον τελευταίο υπεύθυνο/);
});
test('RPCs are callable by logged-in users but not guests, authorization is server-side',()=>{
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.edit_task_details.*FROM PUBLIC, anon/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.delete_task_record.*FROM PUBLIC, anon/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.edit_task_details.*TO authenticated/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.delete_task_record.*TO authenticated/);
});
test('UI shows separate edit and delete actions only for managers with explicit confirmation',()=>{
 assert.match(ui,/\{canManage&&<div className="form-actions task-management-actions"/);
 assert.match(ui,/Επεξεργασία εργασίας/);
 assert.match(ui,/Διαγραφή εργασίας/);
 assert.match(ui,/window\.confirm/);
 assert.match(ui,/supabase\.rpc\('edit_task_details'/);
 assert.match(ui,/supabase\.rpc\('delete_task_record'/);
 assert.match(ui,/if\(ok\)onClose\(\)/);
 assert.match(css,/\.task-edit-form/);
});
test('date input converts local datetime to ISO for database, blank removes due date',()=>{
 assert.match(ui,/const datetimeLocal =/);
 assert.match(ui,/p_due_at:date\?date\.toISOString\(\):null/);
});
