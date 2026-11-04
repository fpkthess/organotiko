import { createClient } from '@supabase/supabase-js';
import { readStudentPages } from '@organotiko/data';
const env = import.meta.env;
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
// Accept public keys only: a browser must never receive a service-role/secret key.
function publicKey(value:string) {
 if(value.startsWith('sb_publishable_'))return true;
 try {return JSON.parse(atob(value.split('.')[1])).role==='anon';} catch {return false;}
}
export const database = url && key && publicKey(key) ? createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'organotiko.auth'}}) : null;
export const configurationError = !url || !key ? 'Προσθέστε το URL και το publishable key του Supabase στο τοπικό αρχείο περιβάλλοντος.' : !publicKey(key) ? 'Επιτρέπεται μόνο publishable ή anon key στον περιηγητή.' : '';
export async function loadStudents(signal:AbortSignal) {
 if(!database)throw new Error(configurationError);
 const {data:allowed,error:accessError}=await database.rpc('organotiko_can_read');
 if(accessError)throw new Error('Το σχήμα οργανωτικού δεν είναι έτοιμο ή η σύνδεση απέτυχε.');
 if(allowed!==true)throw new Error('Δεν έχετε πρόσβαση στο Οργανωτικό με επαληθευμένο TOTP.');
 return readStudentPages(async(from,to)=>{
  const {data,error}=await database!.from('organotiko_student_read_model').select('id,person_id,surname,name,department,year_code,notes,status,nucleus,secondary_nucleus,ef_registered,protoporia,bluepass').order('id').range(from,to).abortSignal(signal);
  if(error)throw new Error('Δεν ήταν δυνατή η φόρτωση των φοιτητών. Ελέγξτε σύνδεση, σχήμα και δικαιώματα.');
  return data||[];
 });
}
