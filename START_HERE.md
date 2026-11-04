# Start here

1. Open this folder as a Codex workspace, or copy `PROJECT_SPEC.md` and `AGENTS.md` into your development repository.
2. Provide Codex with the existing Portal repository, separate Netlify website-admin repository, and safe read-only schema exports. Later provide sanitized Access schema and Google Sheets structure. **Do not provide production credentials or personal data in prompts.**
3. Initial Codex prompt:

> Read AGENTS.md and PROJECT_SPEC.md. Do not write code yet. Audit the repositories and read-only database schema exports I provide. Produce ARCHITECTURE.md, MODULE_MATRIX.md, DATA_MODEL.md, MIGRATION_PLAN.md, and IMPLEMENTATION_PLAN.md. Explicitly mark confirmed requirements, assumptions, and unresolved decisions. Prioritize the complete Organotiko interface, preserving all Portal and website-admin features, and safe staged integration. Do not touch production.

## Scope note
This is a structured handoff based on the conversation, not a literal transcript export. Some historical details may require checking against original Access files and the actual codebases.
