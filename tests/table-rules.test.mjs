import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const root=resolve(import.meta.dirname,'..');
const source=readFileSync(join(root,'apps/organotiko/src/model.ts'),'utf8');
const out=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const dir=mkdtempSync(join(tmpdir(),'organotiko-table-'));
const entry=join(dir,'model.mjs');
const domain=pathToFileURL(join(root,'packages/domain/index.js')).href;
writeFileSync(entry,out.replaceAll("'@organotiko/domain'",`'${domain}'`));
const model=await import(pathToFileURL(entry).href);
const domainModule=await import(domain);
test('the complete Access-style column catalog includes historic election intentions and results',()=>{
 const columns=model.columnsForYear('2026-27');
 assert.ok(columns.length>=50);
 for(const key of ['event:ΕΚΛ26:intent','event:ΕΚΛ26:actual','event:ΑΓΣ25:intent','event:ΒΓΣ26:actual','reg:2025-26','note:25-26'])
  assert.ok(columns.find(c=>c.key===key),key);
 assert.equal(columns[0].key,'surname');
});
test('source is displayed over previous intent for same academic year',()=>{
 const student=domainModule.makeSyntheticStudents(1)[0];
 const c=model.columnsForYear('2026-27').find(c=>c.key==='reg:2026-27');
 const annual={[`${student.id}|2026-27`]:{intentCode:'1',registrationSource:'ψ2',registeredOn:'2026-11-03'}};
 assert.equal(model.cellValue(student,c,annual,{}),'ψ2');
});
test('legacy event intent and actual are independently retrievable',()=>{
 const s=domainModule.makeSyntheticStudents(1)[0];
 const columns=model.columnsForYear('2026-27');
 const events={[s.id]:{'ΕΚΛ26':{intent:'1',actual:'2'}}};
 assert.equal(model.cellValue(s,columns.find(c=>c.key==='event:ΕΚΛ26:intent'),{},events),'1');
 assert.equal(model.cellValue(s,columns.find(c=>c.key==='event:ΕΚΛ26:actual'),{},events),'2');
});
test('contains and begins search are accent/case insensitive',()=>{
 assert.equal(model.matchesColumnFilter('ΘΕΣΣΑΛΟΝΙΚΗ',{mode:'contains',query:'σαλον',values:[]}),true);
 assert.equal(model.matchesColumnFilter('ΠΥΡΗΝΑΣ Α',{mode:'begins',query:'πυρη',values:[]}),true);
 assert.equal(model.matchesColumnFilter('ΝΙΚΟΣ',{mode:'begins',query:'κος',values:[]}),false);
});
test('column filters combine with AND and limit only matching students',()=>{
 const rows=domainModule.makeSyntheticStudents(30);
 const columns=model.columnsForYear('2026-27');
 const filters={yearCode:{mode:'equals',query:'1',values:[]},department:{mode:'begins',query:'ΝΟΜ',values:[]}};
 const found=model.filterStudents(rows,filters,'',columns,{},{});
 assert.ok(found.length>0);
 assert.ok(found.every(s=>s.yearCode==='1'&&s.department.startsWith('ΝΟΜ')));
});
test('blank search returns all in table, search module handles blank independently',()=>{
 const rows=domainModule.makeSyntheticStudents(11);
 assert.equal(model.filterStudents(rows,{},'',model.columnsForYear('2026-27'),{},{}).length,11);
});
test('registration sources have only six actual codes',()=>{
 assert.deepEqual(domainModule.REGISTRATION_SOURCES,['+','ψ2','ψ3','ψ4','ψ5','Μ']);
});
process.on('exit',()=>{try{rmSync(dir,{recursive:true,force:true})}catch{}});
