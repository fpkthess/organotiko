// @ts-nocheck
// Imported and adapted unchanged from SMS Control Center v4.5 parsing utilities.
function cleanCol(s){return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9α-ω]/g,'');}
function mapContactColumns(grid){
  const rows=grid.filter(r=>Array.isArray(r)&&r.some(v=>String(v??'').trim()));
  if(!rows.length)throw new Error('Το αρχείο δεν περιέχει εγγραφές.');
  const head=rows[0].map(cleanCol);
  const idx=(patterns)=>head.findIndex(h=>patterns.some(p=>h===p||h.includes(p)));
  let first=idx(['ονομα','firstname','givenname']),last=idx(['επιθετο','surname','lastname','familyname']);
  let phone=idx(['τηλεφωνο','κινητο','phone','mobile','telephone','number','αριθμοσ']);
  let skipHeader=false;
  if(phone>=0){skipHeader=true;}
  else if(first>=0||last>=0)throw new Error('Η επικεφαλίδα δεν περιλαμβάνει στήλη ΤΗΛΕΦΩΝΟ.');
  else {first=0;last=1;phone=2;}
  const arr=rows.slice(skipHeader?1:0).map(r=>[first>=0?String(r[first]??''):'',last>=0?String(r[last]??''):'',String(r[phone]??'')]);
  if(!arr.length)throw new Error('Δεν βρέθηκαν αριθμοί κάτω από τις επικεφαλίδες.');
  if(arr.length>1500)throw new Error('Το μέγιστο είναι 1.500 εγγραφές ανά αρχείο. Χώρισε την εισαγωγή σε μικρότερα αρχεία.');
  return arr;
}
function csvRows(text){
  text=text.replace(/^\uFEFF/,'');
  const line=text.slice(0,1200).split(/\r?\n/)[0]||'';
  const delimiter=[';',',','\t'].map(c=>[c,(line.split(c).length-1)]).sort((a,b)=>b[1]-a[1])[0][0];
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"' && quoted && text[i+1]==='"'){cell+='"';i++;}
    else if(c==='"'){quoted=!quoted;}
    else if(c===delimiter&&!quoted){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw new Error('Το CSV έχει μη κλεισμένα εισαγωγικά.');
  row.push(cell);rows.push(row);
  return rows;
}
async function zipTextEntries(buf,names){
  const b=new Uint8Array(buf),dv=new DataView(buf);const out=new Map();
  let tail=-1;for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--){if(dv.getUint32(i,true)===0x06054b50){tail=i;break;}}
  if(tail<0)throw new Error('Το Excel δεν είναι έγκυρο αρχείο .xlsx.');
  const count=dv.getUint16(tail+10,true),central=dv.getUint32(tail+16,true);
  if(count>4000||central>=b.length)throw new Error('Πολύ σύνθετο αρχείο Excel.');
  let p=central;
  for(let i=0;i<count;i++){
    if(p+46>b.length||dv.getUint32(p,true)!==0x02014b50)throw new Error('Κατεστραμμένο Excel (ZIP).');
    const flag=dv.getUint16(p+8,true),compression=dv.getUint16(p+10,true);
    const compSize=dv.getUint32(p+20,true),size=dv.getUint32(p+24,true),nameLen=dv.getUint16(p+28,true),extraLen=dv.getUint16(p+30,true),commentLen=dv.getUint16(p+32,true),offset=dv.getUint32(p+42,true);
    if(p+46+nameLen>b.length)throw new Error('Κατεστραμμένο Excel.');
    const name=new TextDecoder().decode(b.slice(p+46,p+46+nameLen));
    p+=46+nameLen+extraLen+commentLen;
    if(!names.has(name))continue;
    if(flag&1||size>8000000||offset+30>b.length||dv.getUint32(offset,true)!==0x04034b50)throw new Error('Το Excel είναι κρυπτογραφημένο ή υπερβολικά μεγάλο.');
    const start=offset+30+dv.getUint16(offset+26,true)+dv.getUint16(offset+28,true);
    if(start+compSize>b.length)throw new Error('Κατεστραμμένο Excel.');
    const compressed=b.slice(start,start+compSize);
    let unzipped;
    if(compression===0){unzipped=compressed;}
    else if(compression===8){
      if(typeof DecompressionStream==='undefined')throw new Error('Ο browser δεν υποστηρίζει ανάγνωση .xlsx. Δοκίμασε CSV.');
      const reader=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
      const chunks=[];let total=0;
      while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>8000000){await reader.cancel();throw new Error('Μεγάλο περιεχόμενο Excel.');}chunks.push(value);}
      unzipped=new Uint8Array(total);let pos=0;for(const chunk of chunks){unzipped.set(chunk,pos);pos+=chunk.length;}
    } else throw new Error('Μη υποστηριζόμενη συμπίεση Excel.');
    out.set(name,new TextDecoder().decode(unzipped));
  }
  return out;
}
function xmlDoc(raw){
  const doc=new DOMParser().parseFromString(raw,'application/xml');
  if(doc.querySelector('parsererror'))throw new Error('Το Excel περιέχει μη έγκυρο XML.');
  return doc;
}
async function excelRows(file){
  const buf=await file.arrayBuffer();
  // Discover workbook's first worksheet; map r:id -> xl/_rels/workbook.xml.rels.
  const initial=await zipTextEntries(buf,new Set(['xl/workbook.xml','xl/_rels/workbook.xml.rels','xl/sharedStrings.xml']));
  if(!initial.has('xl/workbook.xml'))throw new Error('Δεν βρέθηκε φύλλο εργασίας μέσα στο .xlsx.');
  const workbook=xmlDoc(initial.get('xl/workbook.xml'));
  const sheets=workbook.getElementsByTagNameNS('*','sheet');
  if(!sheets.length)throw new Error('Το Excel δεν περιέχει φύλλο.');
  const rel=sheets[0].getAttribute('r:id')||sheets[0].getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
  let path='xl/worksheets/sheet1.xml';
  if(initial.has('xl/_rels/workbook.xml.rels')){
    const relationships=xmlDoc(initial.get('xl/_rels/workbook.xml.rels')).getElementsByTagNameNS('*','Relationship');
    for(const r of relationships){if(r.getAttribute('Id')===rel){const target=r.getAttribute('Target')||'';
      if(target.startsWith('/'))path=target.slice(1);else path=new URL(target,'https://file.local/xl/workbook.xml').pathname.slice(1);
      break;}}
  }
  if(path.includes('..')||!path.startsWith('xl/'))throw new Error('Μη υποστηριζόμενη δομή Excel.');
  const result=await zipTextEntries(buf,new Set([path]));
  if(!result.has(path))throw new Error('Δεν βρέθηκε το πρώτο φύλλο του Excel.');
  const shared=[];
  if(initial.has('xl/sharedStrings.xml')){
    const strings=xmlDoc(initial.get('xl/sharedStrings.xml')).getElementsByTagNameNS('*','si');
    for(const x of strings)shared.push(x.textContent||'');
  }
  const sheet=xmlDoc(result.get(path));
  const rows=[];
  for(const row of sheet.getElementsByTagNameNS('*','row')){
    const values=[];
    for(const cell of row.getElementsByTagNameNS('*','c')){
      const ref=cell.getAttribute('r')||'';
      const match=/^([A-Z]+)\d+$/.exec(ref);if(!match)continue;
      let col=0;for(const char of match[1])col=col*26+char.charCodeAt(0)-64;col--;
      if(col>60)continue;
      const type=cell.getAttribute('t');
      let v=cell.getElementsByTagNameNS('*','v')[0]?.textContent??'';
      if(type==='s')v=shared[Number(v)]??'';
      else if(type==='inlineStr')v=cell.getElementsByTagNameNS('*','is')[0]?.textContent??'';
      values[col]=String(v);
    }
    if(values.length)rows.push(values);
    if(rows.length>1502)break;
  }
  return rows;
}
async function readContactFile(file){
  if(!file)throw new Error('Διάλεξε πρώτα αρχείο Excel ή CSV.');
  if(file.size>3000000)throw new Error('Το αρχείο δεν πρέπει να ξεπερνά τα 3 MB.');
  const name=file.name.toLowerCase();
  if(name.endsWith('.csv'))return mapContactColumns(csvRows(await file.text()));
  if(name.endsWith('.xlsx'))return mapContactColumns(await excelRows(file));
  throw new Error('Υποστηρίζονται μόνο .xlsx και .csv.');
}

export { readContactFile };

// Custom columns are kept by name; no uploaded passwords are stored in contacts.
export type PersonalizedSheet = {columns:string[]; rows:Record<string,string>[]};
const normalizedVariable = (value:string) => String(value??'').normalize('NFD')
 .replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
 .replace(/[\s\-]+/g,'_').replace(/[^a-z0-9_α-ω]/g,'');
const fieldAliases:Record<string,string> = {
 ονομα:'first_name', name:'first_name', firstname:'first_name', first_name:'first_name',
 επιθετο:'last_name', surname:'last_name', lastname:'last_name', last_name:'last_name',
 τηλεφωνο:'phone', κινητο:'phone', phone:'phone', mobile:'phone', telephone:'phone',
 αριθμος:'phone', number:'phone'
};
export const customKey=(value:string)=>fieldAliases[normalizedVariable(value)]||normalizedVariable(value);
export async function readPersonalizedFile(file:File):Promise<PersonalizedSheet>{
 if(!file)throw new Error('Διάλεξε αρχείο Excel ή CSV.');
 if(file.size>3000000)throw new Error('Το αρχείο πρέπει να είναι έως 3 MB.');
 const name=file.name.toLowerCase();
 const grid:string[][]=name.endsWith('.csv')?csvRows(await file.text())
  :name.endsWith('.xlsx')?await excelRows(file):(()=>{throw Error('Υποστηρίζονται μόνο .xlsx και .csv.');})();
 const used=grid.filter(r=>r.some(x=>String(x??'').trim()));
 if(used.length<2)throw new Error('Χρειάζονται επικεφαλίδες και τουλάχιστον ένας παραλήπτης.');
 const headers=used[0].map(x=>customKey(String(x??'')));
 if(headers.length>20||!headers.includes('phone')||headers.some(h=>!h||h.length>40)||new Set(headers).size!==headers.length)
  throw new Error('Χρειάζεται μοναδική στήλη Τηλέφωνο και έως 20 διαφορετικές επικεφαλίδες.');
 const rows=used.slice(1).map((r,i)=>{
  if(r.slice(headers.length).some(v=>String(v??'').trim()))throw new Error(`Επιπλέον στήλες στη γραμμή ${i+2}.`);
  const item:Record<string,string>={};
  for(let j=0;j<headers.length;j++){
   const value=String(r[j]??'').trim();
   if(value.length>300)throw new Error(`Πολύ μεγάλη τιμή στη γραμμή ${i+2}.`);
   item[headers[j]]=value;
  }
  return item;
 });
 if(rows.length>500)throw new Error('Έως 500 παραλήπτες ανά εξατομικευμένη καμπάνια.');
 return {columns:headers,rows};
}
