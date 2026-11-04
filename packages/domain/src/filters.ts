import { normalize, type Student } from './students.ts';
export const filterFields = [
  ['surname', 'Επώνυμο', 'text'], ['name', 'Όνομα', 'text'],
  ['department', 'Τμήμα', 'text'], ['year', 'Έτος', 'text'],
  ['annualRegistration', 'Ετήσια εγγραφή', 'text'], ['registrationIntention', 'Πρόθεση εγγραφής', 'text'], ['registrationDate', 'Ημερομηνία εγγραφής', 'text'],
  ['nucleus', 'Πρωτεύων πυρήνας', 'text'], ['secondaryNucleus', 'Δευτερεύων πυρήνας', 'text'], ['notes', 'Πληροφορίες', 'text'],
  ['efRegistered', 'ΕΦΕΚΘ', 'boolean'], ['protoporia', 'Πρωτοπορία', 'boolean'],
  ['bluepass', 'Bluepass', 'boolean'],
] as const;
export type FilterField = typeof filterFields[number][0];
export type FilterOperator = 'contains' | 'equals' | 'notEquals' | 'empty' | 'notEmpty';
export interface FilterRule { id: string; field: FilterField; operator: FilterOperator; value: string }
export interface FilterGroup { mode: 'all' | 'any'; rules: FilterRule[] }
export function matchesFilters(row: Student, group: FilterGroup): boolean {
  if (!group.rules.length) return true;
  const results = group.rules.map(rule => {
    const value = row[rule.field];
    if (typeof value === 'boolean') {
      if (!['equals', 'notEquals'].includes(rule.operator) || !['true','false'].includes(rule.value)) return false;
      return rule.operator === 'equals' ? value === (rule.value === 'true') : value !== (rule.value === 'true');
    }
    const a = normalize(value||''), b = normalize(rule.value);
    switch (rule.operator) {
      case 'empty': return (value||'').trim() === '';
      case 'notEmpty': return (value||'').trim() !== '';
      case 'contains': return a.includes(b);
      case 'equals': return a === b;
      case 'notEquals': return a !== b;
    }
  });
  return group.mode === 'all' ? results.every(Boolean) : results.some(Boolean);
}
export function emptyFilters(): FilterGroup { return { mode:'all', rules:[] }; }
