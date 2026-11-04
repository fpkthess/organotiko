import { Plus, X } from 'lucide-react';
import { filterFields, type FilterGroup, type FilterRule } from '@organotiko/domain';
export function FilterBuilder({value,onChange}:{value:FilterGroup;onChange:(next:FilterGroup)=>void}) {
  function patch(id:string, change:Partial<FilterRule>) {onChange({...value,rules:value.rules.map(r=>r.id===id?{...r,...change}:r)});}
  return <section className="advanced-filters" aria-label="Σύνθετα φίλτρα">
    <div className="filter-heading"><strong>Σύνθετα φίλτρα</strong><label>Συνδυασμός <select value={value.mode} onChange={e=>onChange({...value,mode:e.target.value as FilterGroup['mode']})}><option value="all">Όλες οι συνθήκες (ΚΑΙ)</option><option value="any">Οποιαδήποτε συνθήκη (Ή)</option></select></label></div>
    {value.rules.map((r,i)=>{const boolean=filterFields.find(f=>f[0]===r.field)?.[2]==='boolean';return <div className="filter-rule" key={r.id}>
      <select aria-label={`Πεδίο φίλτρου ${i+1}`} value={r.field} onChange={e=>{const field=e.target.value as FilterRule['field'];const bool=filterFields.find(f=>f[0]===field)?.[2]==='boolean';patch(r.id,{field,operator:bool?'equals':'contains',value:bool?'true':''});}}>{filterFields.map(f=><option key={f[0]} value={f[0]}>{f[1]}</option>)}</select>
      <select aria-label={`Σύγκριση φίλτρου ${i+1}`} value={r.operator} onChange={e=>patch(r.id,{operator:e.target.value as FilterRule['operator']})}>{!boolean&&<option value="contains">Περιέχει</option>}<option value="equals">Είναι</option><option value="notEquals">Δεν είναι</option>{!boolean&&<><option value="empty">Είναι κενό</option><option value="notEmpty">Δεν είναι κενό</option></>}</select>
      {boolean?<select aria-label={`Τιμή φίλτρου ${i+1}`} value={r.value} onChange={e=>patch(r.id,{value:e.target.value})}><option value="true">ΝΑΙ</option><option value="false">ΟΧΙ</option></select>:!['empty','notEmpty'].includes(r.operator)&&<input aria-label={`Τιμή φίλτρου ${i+1}`} value={r.value} onChange={e=>patch(r.id,{value:e.target.value})}/>}
      <button type="button" aria-label={`Αφαίρεση φίλτρου ${i+1}`} onClick={()=>onChange({...value,rules:value.rules.filter(x=>x.id!==r.id)})}><X size={15}/></button>
    </div>;})}
    <button type="button" onClick={()=>onChange({...value,rules:[...value.rules,{id:crypto.randomUUID(),field:'nucleus',operator:'contains',value:''}]})}><Plus size={14}/>Προσθήκη συνθήκης</button>
  </section>;
}
