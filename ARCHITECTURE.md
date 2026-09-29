# AgentScore Architecture

## System Overview

```mermaid
flowchart LR
    manager[QA Manager]

    subgraph Client[React UI served by Vite]
        list[Call list<br/>filter and sort]
        detail[Call detail<br/>AI score and flagged issues]
        review[Review form<br/>score, issue decisions, note]
        dashboard[Agent dashboard<br/>score trend and issue types]
    end

    subgraph API[Express REST API]
        callRoutes[Call routes<br/>list, detail, submit review]
        agentRoutes[Agent routes<br/>list and date-range analytics]
        model[Mongoose Call model]
    end

    subgraph Database[MongoDB]
        calls[(calls collection)]
        document[Call document<br/>agent and call metadata<br/>immutable aiScore<br/>flaggedIssues array<br/>versioned reviews array]
    end

    seed[Seed script<br/>42 mock calls]

    manager --> list
    manager --> detail
    manager --> review
    manager --> dashboard

    list -->|GET /api/calls with filters and sort| callRoutes
    detail -->|GET /api/calls/:id| callRoutes
    review -->|POST /api/calls/:id/reviews| callRoutes
    dashboard -->|GET /api/agents/:agentId/analytics?from&to| agentRoutes
    callRoutes --> model
    agentRoutes --> model
    model <--> calls
    calls --- document
    seed -->|insert seeded calls| model
```

## Manager Review Flow

```mermaid
sequenceDiagram
    actor QA as QA Manager
    participant UI as React review panel
    participant API as Express API
    participant DB as MongoDB

    QA->>UI: Set manager score, issue decisions, and note
    UI->>API: POST /api/calls/:id/reviews
    API->>API: Validate score and issue references
    API->>DB: Append review with next version number
    Note over DB: aiScore and original flaggedIssues remain unchanged
    DB-->>API: Saved call with review history
    API-->>UI: Latest manager score and review version
    UI-->>QA: Show saved review and audit trail
```

## Data and API

Each call document stores the original AI score and flagged issues alongside a `reviews` array. A review contains its version, manager score, note, timestamp, and valid/invalid decisions referencing issue IDs. The latest review drives the manager score shown in the UI; earlier reviews remain available for the audit trail.

- `GET /api/calls` filters and sorts calls by agent, score, flags, date, and review score.
- `GET /api/calls/:id` returns full call details and review history.
- `POST /api/calls/:id/reviews` appends a versioned manager review without overwriting the AI score.
- `GET /api/agents` returns agents for the dashboard selector.
- `GET /api/agents/:agentId/analytics?from=...&to=...` returns average AI and manager scores, score trend, total AI-flagged issue counts, and manager-confirmed issue counts.
