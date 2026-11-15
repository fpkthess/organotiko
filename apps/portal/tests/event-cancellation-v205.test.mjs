import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync(new URL('../src/EventsPage.tsx',import.meta.url),'utf8');
const types=readFileSync(new URL('../src/types.ts',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/009_cancel_event_by_stage.sql',import.meta.url),'utf8');
const calendar=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
test('planning cancellations permanently delete event records, recording audit and safeguarding linked tasks',()=>{
 assert.match(sql,/IF e\.stage='planning' THEN/);
 assert.match(sql,/EXISTS\s*\(SELECT 1 FROM public\.tasks WHERE event_id=e\.id\)/);
 assert.match(sql,/DELETE FROM public\.events WHERE id=e\.id/);
 assert.match(sql,/VALUES\(auth\.uid\(\),'events',e\.id::text,'delete'/);
 assert.match(sql,/RETURN 'deleted'/);
});
test('confirmed cancellations change stage without deleting existing tasks',()=>{
 assert.match(sql,/ELSIF e\.stage='confirmed' THEN/);
 assert.match(sql,/UPDATE public\.events SET stage='cancelled' WHERE id=e\.id/);
 assert.doesNotMatch(sql,/DELETE FROM public\.tasks/);
 assert.match(sql,/RETURN 'cancelled'/);
});
test('event cancellation is server-only for authorized, logged-in managers',()=>{
 assert.match(sql,/IF auth\.uid\(\) IS NULL/);
 assert.match(sql,/public\.can_manage_event_team\(e\.team_id\)/);
 assert.match(sql,/SECURITY DEFINER SET search_path = ''/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.cancel_event\(uuid\) FROM PUBLIC, anon/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.cancel_event\(uuid\) TO authenticated/);
 assert.match(sql,/REVOKE DELETE ON public\.events FROM PUBLIC, anon, authenticated/);
});
test('client reflects both cancellation paths with clear confirmation',()=>{
 assert.match(ui,/const planning=e\.stage==='planning'/);
 assert.match(ui,/window\.confirm\(warning\)/);
 assert.match(ui,/supabase\.rpc\('cancel_event',\{p_event_id:e\.id\}\)/);
 assert.match(ui,/> Ακύρωση και διαγραφή</);
 assert.match(ui,/> Ακύρωση εκδήλωσης</);
 assert.match(ui,/>Ακυρωμένες</);
 assert.match(ui,/selected\.stage==='confirmed'&&managed/);
});
test('cancelled events are represented by type, history and calendar styles',()=>{
 assert.match(types,/EventStage = 'planning'\|'confirmed'\|'cancelled'/);
 assert.match(calendar,/\.event-state\.cancelled/);
 assert.match(calendar,/\.calendar-task\.event-item\.cancelled/);
});
