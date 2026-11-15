import { createClient } from '@supabase/supabase-js';
import type { TaskPriority, TaskStatus } from './types';
const URL = import.meta.env.VITE_SUPABASE_URL || '';
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(URL.replace(/\/$/, '')) && KEY.length > 20;
export const supabase = createClient(URL || 'https://placeholder.supabase.co', KEY || 'placeholder-configuration', {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
});
// Internal Auth identity only; no personal email is requested or exposed to staff.
// Reserve this subdomain for the application. No email delivery or recovery links are used.
export const LOGIN_DOMAIN = 'protoporiathess.com';
export const USERNAME_PATTERN = /^[a-z][a-z0-9._-]{2,31}$/;
export const normalizedUsername = (value: string) => value.trim().toLowerCase();
export const authEmailForUsername = (value: string) => {
 const username = normalizedUsername(value);
 if (!USERNAME_PATTERN.test(username)) throw new Error('Το username πρέπει να έχει 3–32 λατινικούς χαρακτήρες, αριθμούς ή . _ - και να αρχίζει από γράμμα.');
 return `${username}@${LOGIN_DOMAIN}`;
};
export const statusLabel: Record<TaskStatus, string> = { todo: 'Εκκρεμεί', in_progress: 'Σε εξέλιξη', in_review: 'Για έλεγχο', done: 'Ολοκληρώθηκε' };
export const priorityLabel: Record<TaskPriority, string> = { low: 'Χαμηλή', normal: 'Κανονική', high: 'Υψηλή', urgent: 'Επείγουσα' };
export const roleLabel = { admin: 'Admin', leadership: 'Ηγεσία', coordinator: 'Συντονιστής', member: 'Στέλεχος' };
export const dateFmt = (value?: string|null, opts?: Intl.DateTimeFormatOptions) => value ? new Intl.DateTimeFormat('el-GR', opts || { day:'2-digit', month:'short', year:'numeric' }).format(new Date(value)) : '—';
export const relativeDay = (value: string|null) => {
 if(!value) return false;
 const due = new Date(value).getTime();
 return due < Date.now();
};
export const initials = (name: string) => name.trim().split(/\s+/).slice(0,2).map(x=>x.charAt(0)).join('').toUpperCase() || '—';
export const safeError = (e: unknown): string => e instanceof Error ? e.message : String(e || 'Παρουσιάστηκε σφάλμα.');
