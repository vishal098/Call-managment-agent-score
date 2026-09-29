Context
A call center quality management system ingests recorded calls, runs them through an LLM scoring pipeline, and produces a quality score + flagged issues (e.g. compliance violations, tone problems, missed script steps) per call. QA managers need to review these scored calls, override incorrect AI scores, and track agent performance over time.

What to build

Backend

API + real datastore (Postgres/MySQL) with a calls table: call metadata (agent, duration, timestamp), an ai_score (0-100), and a list of flagged_issues (issue type + timestamp in call + short note).
Seed ~30-50 mock calls (random agents, scores, issues) via a script.
Endpoints:
List calls with filters (by agent, score range, has-flagged-issues).
Get single call detail (full issue list).
Submit a manager review: override score, mark issues as valid/invalid, add a note. Store as a new version — don't overwrite the AI's original score (need audit trail: AI score vs manager-reviewed score).
Get agent-level aggregate: average AI score vs average manager-reviewed score, issue counts by type, over a date range.

Frontend

Call list view: sortable/filterable table (score, agent, date, flag count).
Call detail view: show AI score, flagged issues, and a review form (override score, accept/reject each flagged issue, add note).
Agent dashboard: simple chart or table showing an agent's trend (AI score vs manager score over time) and top issue types.