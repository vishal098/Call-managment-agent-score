# Fieldnote | Call quality review

Fieldnote is a MERN call-center QA tool. It gives managers a review queue for AI-scored calls, a versioned human-review workflow, and an agent performance dashboard.

## What it does

- Filters and sorts calls by agent, AI score, date, manager score, and issue count.
- Shows call metadata, AI score, and timestamped issue flags in a detail panel.
- Lets a manager adjust the score, confirm or dismiss each issue, and add a coaching note.
- Tracks agent AI-versus-manager score trends and issue counts over a selected date range.
- Seeds 42 representative calls across six agents for a ready-to-demo workspace.
- Accepts audio uploads and, when an OpenAI API key is configured, transcribes and scores them automatically.

## Design decisions

- **Preserve the source score:** `aiScore` is never overwritten by a manager review.
- **Keep an audit trail:** reviews append to a call's `reviews` array with a version, note, timestamp, and issue decisions.
- **Separate flags from judgments:** original AI flags remain available; analytics distinguishes all AI flags (`flaggedIssueCounts`) from manager-confirmed flags (`issueCounts`).
- **Keep the domain compact:** a call document owns its issues and review history, while agent analytics are computed over calls for a requested date range.

## Architecture and tests

- [Architecture diagram and interview walkthrough](ARCHITECTURE.md)
- [UI and API test cases](TEST_CASES.md)

## Tech stack

MongoDB and Mongoose for persistence; Express and Node.js for the REST API; React and Vite for the web client; Recharts for the agent score trend.

## Run locally

Requirements: Node.js 20+ and MongoDB 7+ (local or MongoDB Atlas).

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and set `MONGODB_URI`. Set `OPENAI_API_KEY` to enable recording transcription and scoring; the model names can be changed with `OPENAI_TRANSCRIPTION_MODEL` and `OPENAI_SCORING_MODEL`.
3. Start MongoDB. On macOS with Homebrew:

	```sh
	brew tap mongodb/brew
	brew trust mongodb/brew
	brew install mongodb-community@8.0
	brew services start mongodb-community@8.0
	```

4. Seed demo calls: `npm run seed`
5. Start the API and client: `npm run dev`
6. Open `http://localhost:5173`.

## Recording analysis

Use **Upload recording** from the call queue. The API accepts MP3, WAV, M4A, AAC, FLAC, OGG, and WEBM files up to 100 MB. With `OPENAI_API_KEY` configured, transcription and scoring start after upload; otherwise the call remains queued and can be analyzed after configuration. Failed analyses can be retried from the call detail panel.

Audio files are stored under `uploads/recordings` for local development and are excluded from Git. Analysis runs in the API process, so production deployments should move recordings to private object storage, protect playback with authorization, and use a durable job queue. Review recording consent, retention, and provider data-handling requirements before using real customer calls.

MongoDB Atlas also works with the same `MONGODB_URI` setting. Never commit Atlas credentials.

## API overview

- `GET /api/health` reports API and database status.
- `GET /api/calls?agent=AG-1042&minScore=70&maxScore=95&flagged=true&sort=callAt&order=desc` lists, filters, and sorts calls.
- `GET /api/calls/:id` returns a call's full issue list and review history.
- `POST /api/calls/:id/reviews` appends a manager review. Example body: `{ "score": 84, "note": "Coaching note", "issueDecisions": [{ "issueId": "...", "status": "valid" }] }`.
- `GET /api/agents` lists agents for the dashboard.
- `GET /api/agents/:agentId/analytics?from=2026-09-01&to=2026-09-30` returns averages, score trend, and issue totals for an inclusive date range.

## Demo walkthrough

1. Filter the call queue to find a flagged conversation.
2. Open its detail and compare the original AI score with the latest manager score.
3. Confirm or dismiss an issue, change the manager score, add a note, and save.
4. Save a second review to show version history and verify the AI score remains unchanged.
5. Open Agent performance to discuss score trends and coaching signals.