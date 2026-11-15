import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
test('tasks have an event id relationship without database changes',()=>{
 assert.match(app, /if\(!task\.event_id\)return null/);
 assert.match(app, /const linkedEvent=task\.event_id\?data\.events\.find/);
});
test('event title shown in task detail with status and date, including cancellation',()=>{
 assert.match(app, /ΣΥΝΔΕΔΕΜΕΝΗ ΕΚΔΗΛΩΣΗ/);
 assert.match(app, /linkedEvent\?\.title/);
 assert.match(app, /linkedEvent\.starts_at/);
 assert.match(app, /eventStageName\[linkedEvent\.stage\]/);
 assert.match(app, /cancelled:'Ακυρωμένη'/);
});
test('event labels appear on dashboard, in list and Kanban',()=>{
 assert.match(app, /function TaskLine\(\{task,team,users=\[\],event,onClick\}/);
 assert.match(app, /<LinkedEventTag task=\{task\} event=\{event\}\/>/);
 assert.match(app, /<LinkedEventTag task=\{t\} event=\{t\.event_id\?eventById\.get/);
 assert.match(app, /events=\{data\.events\} assignees=/);
 assert.match(app, /event=\{data\.events\.find\(e=>e\.id===t\.event_id\)\}/);
});
test('event ids outside events page are loaded specifically',()=>{
 assert.match(app, /const missingIds=/);
 assert.match(app, /supabase\.from\('events'\)\.select\('\*'\)\.in\('id',missingIds\.slice/);
 assert.match(app, /events:allEvents/);
});
test('visual styling and favicon are preserved',()=>{
 assert.match(css, /\.task-linked-event-panel\.cancelled/);
 assert.match(css, /\.task-linked-event-tag\.cancelled/);
 assert.match(html, /favicon/);
});
