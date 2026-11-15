import test from 'node:test';
import assert from 'node:assert/strict';
import {personalizedSnapshot,encryptMessage,decryptMessage} from '../worker/personalized.js';
const key='a'.repeat(64);
const rows=[{first_name:'Κύπρος',last_name:'Κυπρίδημος',phone:'99187784',username:'kypros',password:'TempOnlyPass123!'},
 {first_name:'Μαρία',last_name:'',phone:'99187785',username:'maria',password:'SecretOnly456!'}];
test('per-recipient rendering with arbitrary placeholders',()=>{
 const snap=personalizedSnapshot(rows,'Γεια σου {όνομα} {επίθετο}. User: {username}, Pass: {password}');
 assert.equal(snap.valid.length,2);
 assert.ok(snap.valid[0].rendered.includes('TempOnlyPass123!'));
 assert.ok(snap.valid[1].rendered.includes('maria'));
 assert.ok(!snap.valid[0].redacted.includes('TempOnlyPass123!'));
});
test('invalid missing variable and required values cause complete rejection',()=>{
 assert.throws(()=>personalizedSnapshot(rows,'{unknown}'));
 assert.throws(()=>personalizedSnapshot([{phone:'99187784',username:''}],'username {username}'));
});
test('duplicate phone and excluded phone never included',()=>{
 const snap=personalizedSnapshot([...rows,rows[0]],'Hello {username}',['35799187785']);
 assert.equal(snap.valid.length,1);assert.equal(snap.duplicates,1);assert.equal(snap.excluded,1);
});
test('AES-GCM encrypts recipient message at rest and decrypts only in worker',async()=>{
 const text='User: kypros Pass: TempOnlyPass123!';
 const enc=await encryptMessage(text,key);
 assert.ok(enc.startsWith('ENC1:'));assert.ok(!enc.includes('TempOnlyPass'));
 assert.equal(await decryptMessage(enc,key),text);
 assert.notEqual(await encryptMessage(text,key),enc); // nonce
 await assert.rejects(()=>decryptMessage(enc,'b'.repeat(64)));
});
test('rendered SMS length is checked per recipient',()=>{
 assert.throws(()=>personalizedSnapshot([{phone:'99187784',username:'x'.repeat(300)}],'X'.repeat(400)+'{username}'));
});
