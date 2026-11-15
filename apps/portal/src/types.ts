export type Role = 'admin' | 'leadership' | 'coordinator' | 'member';
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type Page = 'overview' | 'mine' | 'tasks' | 'calendar' | 'events' | 'teams' | 'people' | 'activity' | 'sms' | 'finance';
export interface Profile { id: string; email: string; username: string; full_name: string; role: Role; position_title: string; manage_all_tasks: boolean; manage_events: boolean; view_audit: boolean; sms_access: boolean; sms_manage_contacts:boolean; sms_manage_settings:boolean; active: boolean; finance_manager?:boolean; created_at: string }
export interface Team { id: string; name: string; description: string; color: string; created_at: string; created_by: string }
export interface TeamMember { team_id: string; user_id: string; access: 'member'|'coordinator'; created_at: string }
export interface Task { id: string; team_id: string; title: string; description: string; status: TaskStatus; priority: TaskPriority; due_at: string|null; review_required: boolean; created_by: string; created_at: string; updated_at: string; completed_at: string|null; event_id?:string|null; event_template_id?:string|null }
export interface Assignee { task_id: string; user_id: string; assigned_at: string }
export interface CheckItem { id: string; task_id: string; title: string; is_done: boolean; sort_order: number }
export interface Comment { id: string; task_id: string; user_id: string; body: string; created_at: string }
export interface Notice { id: string; task_id: string|null; user_id: string; kind: string; message: string; read_at: string|null; created_at: string }
export interface Audit { id: number; actor_id: string|null; entity_type: string; entity_id: string|null; action: string; details: Record<string, unknown>; created_at: string }

export type EventKind = string;
export interface EventKindDefinition {key:string;label:string;color:string;active:boolean;sort_order:number;created_at:string}
export type EventStage = 'planning'|'confirmed'|'cancelled';
export interface Event { id:string; team_id:string; kind:EventKind; other_label:string; title:string; details:string; venue:string; starts_at:string; stage:EventStage; created_by:string; confirmed_by:string|null; confirmed_at:string|null; created_at:string }
export interface EventTaskTemplate {id:string; team_id:string; kind:EventKind; title:string; assignee_id:string|null; priority:TaskPriority; days_before:number; enabled:boolean; created_at:string}
