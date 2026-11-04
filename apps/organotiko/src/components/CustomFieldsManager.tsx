import { useState } from 'react';
import { Plus, SlidersHorizontal } from 'lucide-react';
import { defineCustomField, type CustomField, type CustomFieldState, type CustomFieldType } from '@organotiko/domain';
export const fieldTypeLabels:Record<CustomFieldType,string>={text:'Κείμενο',number:'Αριθμός',date:'Ημερομηνία',boolean:'Ναι / Όχι',select:'Λίστα επιλογών'};
export function CustomFieldsManager({state,onChange}:{state:CustomFieldState;onChange:(state:CustomFieldState)=>void}) {
  const [editing,setEditing]=useState<CustomField|'new'|null>(null);
  const [error,setError]=useState('');
  return <div><p className="prototype-note">Τοπικά, συνθετικά πεδία. Οι ρυθμίσεις επεξεργασίας δεν αντικαθιστούν τα μελλοντικά δικαιώματα στον διακομιστή.</p>
    <div className="section-title"><h2>Ορισμοί πεδίων</h2><button className="primary" onClick={()=>{setEditing('new');setError('');}}><Plus size={15}/>Νέο πεδίο</button></div>
    {error&&<p role="alert" className="review-error">{error}</p>}
    <div className="field-definition-list">{state.definitions.map(field=><article key={field.id}><span className="module-icon"><SlidersHorizontal size={19}/></span><div><h3>{field.label}</h3><p>{fieldTypeLabels[field.type]} · {field.retired?'Αποσυρμένο':field.editable?'Επεξεργάσιμο':'Μόνο ανάγνωση'}{field.type==='text'?(field.preserveCase?' · Διατήρηση πεζών / κεφαλαίων':' · Κεφαλαία'):''}</p></div><button onClick={()=>{setEditing(field);setError('');}}>Ρυθμίσεις πεδίου</button></article>)}</div>
    {editing&&<FieldDefinitionForm key={editing==='new'?'new':editing.id} value={editing} onCancel={()=>setEditing(null)} onSave={field=>{try{onChange(defineCustomField(state,field,crypto.randomUUID(),new Date().toISOString()));setError('');setEditing(null);}catch(e){setError((e as Error).message);}}}/>}
    <p className="keyboard-help">Η απόσυρση κρύβει το πεδίο από τον καθημερινό πίνακα χωρίς να διαγράφει τιμές ή ιστορικό. Ο τύπος και οι κανόνες τιμών παραμένουν σταθεροί μετά τη δημιουργία.</p>
  </div>;
}
function FieldDefinitionForm({value,onSave,onCancel}:{value:CustomField|'new';onSave:(field:CustomField)=>void;onCancel:()=>void}) {
  const [label,setLabel]=useState(value==='new'?'':value.label),[type,setType]=useState<CustomFieldType>(value==='new'?'text':value.type),[options,setOptions]=useState(value==='new'?'':value.options.join('\n')),[preserveCase,setPreserveCase]=useState(value==='new'?false:value.preserveCase),[editable,setEditable]=useState(value==='new'?true:value.editable),[retired,setRetired]=useState(value==='new'?false:value.retired);
  return <section className="review-card"><h2>{value==='new'?'Νέο προσαρμοσμένο πεδίο':value.label}</h2><form className="field-definition-form" onSubmit={e=>{e.preventDefault();onSave({id:value==='new'?crypto.randomUUID():value.id,label,type,options:type==='select'?options.split('\n'):[],preserveCase,editable,retired});}}>
    <label className="form-label">Όνομα πεδίου<input autoFocus required maxLength={80} value={label} onChange={e=>setLabel(e.target.value)}/></label>
    <label className="form-label">Τύπος τιμής<select disabled={value!=='new'} value={type} onChange={e=>{setType(e.target.value as CustomFieldType);setPreserveCase(false);}}>{Object.entries(fieldTypeLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    {type==='select'&&<label className="form-label">Επιλογές · μία ανά γραμμή<textarea required disabled={value!=='new'} value={options} onChange={e=>setOptions(e.target.value)}/></label>}
    {type==='text'&&<label className="report-check"><input type="checkbox" disabled={value!=='new'} checked={preserveCase} onChange={e=>setPreserveCase(e.target.checked)}/>Διατήρηση πεζών / κεφαλαίων στις τιμές</label>}
    <label className="report-check"><input type="checkbox" checked={editable} onChange={e=>setEditable(e.target.checked)}/>Να επιτρέπεται επεξεργασία τιμών στην καρτέλα</label>
    {value!=='new'&&<label className="report-check"><input type="checkbox" checked={retired} onChange={e=>setRetired(e.target.checked)}/>Απόσυρση πεδίου από την καθημερινή προβολή</label>}
    <div className="review-actions"><button className="primary">Αποθήκευση ορισμού</button><button type="button" onClick={onCancel}>Επιστροφή</button></div>
  </form></section>;
}
