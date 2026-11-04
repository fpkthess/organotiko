import type { Student } from '../../domain/src/students.ts';

/** Explicit projection contract: never coerce unknown/null membership into false. */
export function studentFromDatabase(value: unknown): Student {
 if (!value || typeof value !== 'object') throw new Error('Μη έγκυρη εγγραφή βάσης δεδομένων.');
 const r = value as Record<string, unknown>;
 const text = (key: string) => { if (typeof r[key] !== 'string') throw new Error(`Μη έγκυρο πεδίο: ${key}`); return r[key] as string; };
 const flag = (key: string) => { if (typeof r[key] !== 'boolean') throw new Error(`Μη έγκυρο πεδίο: ${key}`); return r[key] as boolean; };
 const status = text('status');
 if (!['active','zero','archived'].includes(status)) throw new Error('Μη έγκυρη κατάσταση φοιτητή.');
 return {id:text('id'),personId:text('person_id'),surname:text('surname'),name:text('name'),department:text('department'),year:text('year_code'),notes:text('notes'),nucleus:text('nucleus'),secondaryNucleus:text('secondary_nucleus'),efRegistered:flag('ef_registered'),protoporia:flag('protoporia'),bluepass:flag('bluepass'),status:status as Student['status']};
}

/** Fetch every page; never silently limit the organizational grid to 1,000 rows. */
export async function readStudentPages(fetchPage: (from:number,to:number)=>Promise<unknown[]>, pageSize=500): Promise<Student[]> {
 if (!Number.isInteger(pageSize) || pageSize<1 || pageSize>500) throw new Error('Invalid page size');
 const result:Student[]=[]; const ids=new Set<string>();
 for(let from=0;;from+=pageSize){
  const page=await fetchPage(from,from+pageSize-1);
  for(const raw of page){const row=studentFromDatabase(raw);if(ids.has(row.id))throw new Error('Τα δεδομένα άλλαξαν κατά τη φόρτωση. Επαναλάβετε.');ids.add(row.id);result.push(row);}
  if(page.length<pageSize)return result;
 }
}
