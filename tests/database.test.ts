import test from 'node:test';
import assert from 'node:assert/strict';
import { readStudentPages, studentFromDatabase } from '../packages/data/src/index.ts';
const row=(id='1')=>({id,person_id:`person-${id}`,surname:'ΔΟΚΙΜΗ',name:'ΑΝΝΑ',department:'ΝΟΜΙΚΗ',year_code:'01',notes:'',status:'active',nucleus:'',secondary_nucleus:'',ef_registered:false,protoporia:true,bluepass:false});
test('database mapping preserves identities, archive status, independent booleans and notes',()=>{
 const mapped=studentFromDatabase({...row(),status:'archived',notes:'Exact note',ef_registered:true});
 assert.equal(mapped.personId,'person-1');assert.equal(mapped.status,'archived');assert.equal(mapped.notes,'Exact note');assert.equal(mapped.efRegistered,true);assert.equal(mapped.bluepass,false);
});
test('unknown membership/status or malformed database values fail instead of becoming false/demo data',()=>{
 for(const change of [{protoporia:null},{bluepass:'false'},{status:'deleted'},{person_id:null},{surname:4}])assert.throws(()=>studentFromDatabase({...row(),...change}));
});
test('database pagination retrieves every page, including exact page boundary',async()=>{
 const calls:number[][]=[];const records=[row('1'),row('2'),row('3'),row('4')];
 const result=await readStudentPages(async(from,to)=>{calls.push([from,to]);return records.slice(from,to+1);},2);
 assert.equal(result.length,4);assert.deepEqual(calls,[[0,1],[2,3],[4,5]]);
});
test('page failure discards partial results and overlapping identities are rejected',async()=>{
 await assert.rejects(readStudentPages(async from=>{if(from)throw new Error('offline');return [row()];},1),/offline/);
 await assert.rejects(readStudentPages(async()=>[row()],1),/άλλαξαν/);
});
