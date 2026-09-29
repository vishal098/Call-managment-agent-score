# AgentScore Test Cases

## Setup

1. Ensure MongoDB is running and the API health endpoint reports `"database":"connected"`:

   ```sh
   curl http://localhost:3001/api/health
   ```

2. Seed demo data if needed: `npm run seed` (creates 42 calls across 6 agents).
3. Start the app with `npm run dev` and open `http://localhost:5173`.

## UI Scenarios

| ID | Test | Steps | Expected result |
|---|---|---|---|
| UI-01 | Call list loads | Open the Calls view. | 42 seeded calls appear with agent, customer, date, duration, AI score, manager score, and issue count. |
| UI-02 | Filter calls | Choose an agent, set a score range, and select Has issues. | Only calls matching all selected filters remain; Reset filters restores the full list. |
| UI-03 | Sort calls | Click Agent, Call date, AI score, Manager, and Flagged headers. | Each click sorts that column; clicking the same header again reverses the order. |
| UI-04 | Inspect a call | Open any row with issues. | Call metadata, the original AI score, flagged moments, and review history are visible. |
| UI-05 | Submit manager review | Change the score, Confirm or Dismiss each issue, add a note, and save. | A success message appears; the manager score and issue decisions update; the AI score remains unchanged. |
| UI-06 | Audit trail | Save another review for the same call. | The history shows the new version and keeps the previous review. |
| UI-07 | Agent dashboard | Open Agent performance and select an agent. | AI and manager averages, score trend, and top confirmed issue types appear. |

## API Scenarios

| ID | Request | Expected result |
|---|---|---|
| API-01 | `GET /api/health` | `200`; MongoDB status is `connected`. |
| API-02 | `GET /api/calls?agent=AG-1042&minScore=70&maxScore=95&flagged=true&sort=aiScore&order=asc` | `200`; every call matches the filters and results are ordered by AI score ascending. |
| API-03 | `GET /api/calls/:id` | `200`; returns full flagged issues and review history for the call. |
| API-04 | `POST /api/calls/:id/reviews` with a whole-number score, note, and issue decisions | `201`; review version increments, and `aiScore` is unchanged. |
| API-05 | `GET /api/agents/:agentId/analytics?from=2026-09-01&to=2026-09-30` | `200`; includes averages, trend, all AI flags by type, and manager-confirmed counts. The end date is inclusive. |
| API-06 | `GET /api/calls?minScore=150` | `400`; invalid score range is rejected. |
| API-07 | Submit a review with a score above 100 or an issue ID not on the call | `400`; invalid review data is rejected and no review is added. |

For API-04, get a call detail first and use one of its issue IDs in the request body:

```json
{
  "score": 84,
  "note": "Clear explanation; verify the closing script next time.",
  "issueDecisions": [
    { "issueId": "<issue-id-from-call-detail>", "status": "valid" }
  ]
}
```
