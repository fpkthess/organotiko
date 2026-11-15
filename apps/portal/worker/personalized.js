import {normalizePhone} from './sms-providers.js';
export const PREFIX='ENC1:';
const pattern=/\{([^{}]+)\}/gu;
const safeKey=/^[a-z_α-ω][a-z0-9_α-ω]{0,39}$/u;
export function fieldKey(value){
 const norm=String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[\s-]+/g,'_').replace(/[^a-z0-9_α-ω]/gu,'');
 const alias={ονομα:'first_name',name:'first_name',firstname:'first_name',first_name:'first_name',επιθετο:'last_name',surname:'last_name',lastname:'last_name',last_name:'last_name',τηλεφωνο:'phone',κινητο:'phone',telephone:'phone',mobile:'phone',number:'phone',αριθμος:'phone'};
 return alias[norm]||norm;
}
export function personalizedSnapshot(raw,template,excludes=[]){
 if(!Array.isArray(raw)||raw.length<1||raw.length>500||typeof template!=='string'||!template.trim()||template.length>612)throw Error('Χρειάζονται 1–500 παραλήπτες και κείμενο έως 612 χαρακτήρες.');
 const tags=[...template.matchAll(pattern)].map(m=>fieldKey(m[1]));
 if(!tags.length)throw Error('Πρόσθεσε τουλάχιστον μία μεταβλητή στο μήνυμα, π.χ. {username}.');
 if(tags.some(t=>!safeKey.test(t)))throw Error('Μη έγκυρες μεταβλητές στο μήνυμα.');
 const unique=new Set(),excludedSet=new Set(excludes),valid=[];let invalid=0,duplicates=0,excluded=0;
 for(const original of raw){
  if(!original||typeof original!=='object'||Array.isArray(original))throw Error('Μη έγκυρες γραμμές αρχείου.');
  const entries=Object.entries(original);
  if(entries.length>20)throw Error('Μέγιστο 20 στήλες.');
  const values={};
  for(const [k,v] of entries){
   const key=fieldKey(k);
   if(!safeKey.test(key)||Object.hasOwn(values,key)||typeof v!=='string'||v.length>300)throw Error('Μη έγκυρες ή διπλές στήλες.');
   values[key]=v.trim();
  }
  const phone=normalizePhone(values.phone);
  if(!phone){invalid++;continue;}
  if(unique.has(phone)){duplicates++;continue;}
  unique.add(phone);
  if(excludedSet.has(phone)){excluded++;continue;}
  values.phone=phone;
  for(const t of tags){
   if(!Object.hasOwn(values,t))throw Error(`Λείπει η στήλη {${t}} από το αρχείο.`);
   if(!values[t]&&!['first_name','last_name'].includes(t))throw Error(`Κενό πεδίο {${t}} για αριθμό που τελειώνει σε ${phone.slice(-4)}.`);
  }
  const rendered=template.replace(pattern,(_all,key)=>values[fieldKey(key)]??'');
  if(!rendered.trim()||rendered.length>612)throw Error(`Το SMS για τον αριθμό που τελειώνει σε ${phone.slice(-4)} ξεπερνά τους 612 χαρακτήρες ή είναι κενό.`);
  const redacted=template.replace(pattern,(_all,key)=>/password|passwd|pass|otp|pin|secret|token|κωδικ/.test(fieldKey(key))?'••••••':values[fieldKey(key)]??'');
  valid.push({phone,first_name:String(values.first_name||'').slice(0,100),last_name:String(values.last_name||'').slice(0,100),rendered,redacted});
 }
 if(invalid)throw Error(`Βρέθηκαν ${invalid} μη έγκυροι αριθμοί. Διόρθωσε το αρχείο πριν την αποστολή.`);
 if(!valid.length)throw Error('Δεν απέμειναν παραλήπτες μετά τις εξαιρέσεις.');
 return {valid,invalid,duplicates,excluded};
}
const hexToBytes=hex=>Uint8Array.from(hex.match(/.{2}/g)||[],b=>parseInt(b,16));
const toBase64=bytes=>{let out='';for(let i=0;i<bytes.length;i+=4096)out+=String.fromCharCode(...bytes.subarray(i,i+4096));return btoa(out);};
const fromBase64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
let activeCryptoKey=null,activeSecret=null;
async function cryptKey(secret){
 if(!/^[0-9a-f]{64}$/i.test(secret||''))throw Error('Encryption key not configured');
 if(activeSecret!==secret||!activeCryptoKey){
  activeCryptoKey=await crypto.subtle.importKey('raw',hexToBytes(secret),'AES-GCM',false,['encrypt','decrypt']);
  activeSecret=secret;
 }
 return activeCryptoKey;
}
export async function encryptMessage(message,secret){
 const key=await cryptKey(secret);const iv=crypto.getRandomValues(new Uint8Array(12));
 const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(message)));
 const combined=new Uint8Array(iv.length+cipher.length);combined.set(iv);combined.set(cipher,iv.length);
 return PREFIX+toBase64(combined);
}
export async function decryptMessage(blob,secret){
 if(typeof blob!=='string'||!blob.startsWith(PREFIX))return blob;
 const combined=fromBase64(blob.slice(PREFIX.length));if(combined.length<29)throw Error('Invalid encrypted payload');
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:combined.slice(0,12)},await cryptKey(secret),combined.slice(12));
 return new TextDecoder().decode(plain);
}
