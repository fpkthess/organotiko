# Role and permission model (v1.3)

### Base roles
- `admin`: account provisioning and password reset through Worker, set any role or custom permission, global task/event management, audit.
- `leadership`: global management of tasks and events, but NO user-account provisioning or role changes by default.
- `coordinator`: task/event management only in authorized groups marked `team_members.access='coordinator'`.
- `member`: sees their own assigned tasks and group events. Does not assign tasks by default.

### Independent attributes
- `position_title`: freeform label ('Πρόεδρος', 'Οργανωτικός', etc). It confers **no** privileges.
- `manage_all_tasks`: authorized to manage tasks across all groups (and read group data needed for management).
- `manage_events`: authorized to create/manage events in groups they belong to, but cannot manage all tasks.
- `view_audit`: read-only access to Audit Log.

All extras can be changed only by `admin` through profile row update with RLS. Baseline access is enforced by SQL helper functions. `is_admin` is **not** expanded to leadership so leadership cannot administer other accounts.

### Responsibility and safety
Admin can designate another Admin, but the existing last-admin guard prevents eliminating the final active Admin. Self-demotion from the UI is disabled. Profile `username` and technical `email` remain immutable. Team coordinators must still be assigned to teams explicitly. Service-role credentials are Cloudflare secrets only.
