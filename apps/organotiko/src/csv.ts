/** Minimal safe CSV export for spreadsheet applications. */
export function csvContent(headers:string[],rows:Array<Array<string|number|boolean|null|undefined>>):string {
 const escapeValue=(input:string|number|boolean|null|undefined):string=>{
  let value=String(input??'');
  // Prevent a displayed data field from being interpreted as a spreadsheet formula.
  if (/^[\s\t\r\n]*[=+\-@]/.test(value)) value="'"+value;
  return '"'+value.replaceAll('"','""')+'"';
 };
 return '\uFEFF'+[headers,...rows].map(row=>row.map(escapeValue).join(';')).join('\r\n');
}
export function saveCsv(filename:string,headers:string[],rows:Array<Array<string|number|boolean|null|undefined>>):void{
 const blob=new Blob([csvContent(headers,rows)],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;
 link.download=filename.replace(/[^\p{L}\p{N}._-]/gu,'_')+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
