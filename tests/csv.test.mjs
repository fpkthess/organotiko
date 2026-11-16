import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript');
const source=readFileSync(resolve(import.meta.dirname,'../apps/organotiko/src/csv.ts'),'utf8');
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const dir=mkdtempSync(join(tmpdir(),'organotiko-csv-'));const path=join(dir,'csv.mjs');writeFileSync(path,output);
const {csvContent}=await import(pathToFileURL(path).href);
test('CSV escapes embedded separators, quotes, and Unicode correctly',()=>{
 const actual=csvContent(['ΕΠΩΝΥΜΟ'],[['ΠΑΠΑ;ΔΟΠΟΥΛΟΣ'],['a"b']]);
 assert.ok(actual.includes('"ΠΑΠΑ;ΔΟΠΟΥΛΟΣ"'));
 assert.ok(actual.includes('"a""b"'));
});
test('CSV neutralizes formula-like cells before spreadsheet import',()=>{
 const actual=csvContent(['ΑΔΤ'],[['=1+1'],['+SUM(1,2)'],['-cmd'],['@foo'],['normal']]);
 for(const x of ["'=1+1","'+SUM(1,2)","'-cmd","'@foo"])assert.ok(actual.includes('"'+x+'"'));
 assert.ok(actual.includes('"normal"'));
});
process.on('exit',()=>{try{rmSync(dir,{recursive:true,force:true})}catch{}});
