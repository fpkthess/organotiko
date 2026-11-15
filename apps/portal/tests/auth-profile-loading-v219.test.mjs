import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');

test('Auth session loading and profile loading are distinct states',()=>{
 assert.match(app,/const \[checked,setChecked\]=useState\(false\)/);
 assert.match(app,/const \[profileGate,setProfileGate\]=useState<\{userId:string;status:'ready'\|'missing'\|'error'\}\|null>\(null\)/);
 assert.match(app,/if\(!profileGate \|\| profileGate\.userId!==session\.user\.id\)/);
 assert.match(app,/Φόρτωση Portal…/);
});

test('Missing profile only appears after verified database no-row response',()=>{
 assert.match(app,/if\(!p\.data\)\{\s*setProfile\(null\);setData\(empty\);setProfileGate\(\{userId,status:'missing'\}\)/);
 assert.match(app,/if\(profileGate\.status==='missing' \|\| !profile\)return/);
 assert.ok(app.indexOf("if(profileGate.status==='missing'") > app.indexOf('if(!profileGate || profileGate.userId!==session.user.id)'));
});

test('Network errors do not masquerade as missing profiles',()=>{
 assert.match(app,/status:'error'/);
 assert.match(app,/Αδυναμία φόρτωσης προφίλ/);
 assert.match(app,/Επανάληψη/);
 assert.match(app,/if\(p\.error\)throw p\.error/);
});

test('Stale requests cannot override results from a newer auth session',()=>{
 assert.match(app,/const profileRequest=useRef\(0\)/);
 assert.match(app,/const request=\+\+profileRequest\.current/);
 assert.match(app,/const isCurrent=\(\)=>request===profileRequest\.current/);
 assert.ok((app.match(/if\(!isCurrent\(\)\)return/g)||[]).length >= 2);
 assert.match(app,/profileRequest\.current\+=1;\s*setProfile\(null\);setData\(empty\);setProfileGate\(null\)/);
});

test('Dashboard data and profile become ready together',()=>{
 const setProfile=app.lastIndexOf('setProfile(p.data as Profile);',app.indexOf('async function execute'));
 const setData=app.indexOf('setData({profiles:',setProfile);
 const ready=app.indexOf("setProfileGate({userId,status:'ready'});",setData);
 assert.ok(setProfile>0 && setData>setProfile && ready>setData);
});
