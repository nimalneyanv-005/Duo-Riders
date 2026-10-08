# CodePulse

**Never debug the same outage twice.**

CodePulse is an incident memory and root-cause engine. An engineer pastes a production stack trace and CodePulse finds the closest past incident, shows the root cause and fix, names the engineer who resolved it, links the fix commit, and warns when a later commit touched the same files and may have undone the fix. It then drafts a structured post-mortem and saves it, so the next engineer who hits the same crash finds it.

Live demo: https://duo-riders.vercel.app

## What it does

1. **Incident workspace.** Paste a stack trace and click Analyze.
2. **Vector search over incident history.** The trace is normalized, embedded, and compared with every past incident using pgvector cosine similarity.
3. **Error-to-fix correlation.** The best match is linked to its fix commit, the author of that commit, and the engineer who resolved the incident.
4. **Relapse detection.** If a later commit changed the same files as the fix, CodePulse flags a likely regression and names the commit and author.
5. **Automated post-mortem builder.** Generates a structured RCA draft (summary, impact, root cause, resolution, fix commit, why it recurred, prevention steps). The engineer edits it and saves it to the database.
6. **Memory that learns.** A saved post-mortem is embedded and becomes searchable immediately.
7. **Analytics dashboard.** Incidents by service and root-cause category, average time to resolve, top resolvers, and the time lost to repeat incidents.

## Architecture

```
Browser (React, Tailwind)
   |  POST /api/analyze            { trace }
   |  POST /api/postmortem/draft   { trace }
   |  POST /api/postmortem         { trace, incidentId, pm }
   |  GET  /api/dashboard
   v
Next.js route handlers (server only, all secrets live here)
   |                         |
   v                         v
Neon Postgres + pgvector     Gemini via Vercel AI SDK
(incidents, commits,         (gemini-embedding-001 embeddings,
 postmortems)                 gemini-2.5-flash for drafts)
```

- **Framework:** Next.js 16 (App Router, Turbopack, Cache Components), TypeScript, Tailwind CSS
- **Database:** Neon Postgres with the pgvector extension, queried through the Neon serverless driver
- **AI:** Vercel AI SDK (`ai`, `@ai-sdk/google`). Embeddings use `gemini-embedding-001` reduced to 1536 dimensions. Post-mortem drafts use `gemini-2.5-flash`.
- **Validation:** zod schemas on the post-mortem routes, manual validation on the analyze route
- **Hosting:** Vercel

### Database

| Table         | Purpose                                                                                                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `incidents`   | Historic and newly saved incidents: title, service, severity, stack trace, root cause, root-cause category, resolution, resolver, timestamps, `repeat_of`, and a `vector(1536)` embedding |
| `commits`     | Git history: hash, author, message, files changed, commit time, `incident_id` (set for fix commits) and an embedding                                                                      |
| `postmortems` | Saved post-mortems stored as JSONB, linked to the incident they created                                                                                                                   |

The seed data contains 12 incidents (Redis timeouts, null pointers, DB pool exhaustion, bad deploys and similar), 12 fix commits linked to them, and 3 later commits with no incident link that touch the same files as earlier fixes. Those later commits are what relapse detection finds.

## How matching works

The analysis in `lib/analyze.ts` is deterministic. It makes no LLM call, so it is fast, repeatable, and easy to explain.

1. **Normalize** (`lib/normalize.ts`). Strip the parts of a trace that change between occurrences but do not change the meaning: IP addresses, hex memory addresses, UUIDs, timestamps, line and column numbers, `line N` text, and extra whitespace. The result is cut to 6000 characters. This means the same bug at a different line number still matches.
2. **Embed** (`lib/embed.ts`). The normalized trace becomes a 1536-dimension vector using Gemini embeddings.
3. **Search.** pgvector ranks incidents by cosine distance (`<=>`) and returns the top 3. Only original incidents are searched (`repeat_of IS NULL`), so saved repeats do not crowd out the original.
4. **Threshold.** A similarity of 0.55 or higher counts as a match. Anything lower is reported as a novel incident.
5. **Keyword fallback.** If the embedding call or vector query fails, CodePulse falls back to Jaccard token similarity over normalized traces (threshold 0.2). The response says which mode was used, so the fallback is visible rather than silent.
6. **Frame overlap.** Function names are extracted from each stack frame and compared with the match, giving an explainable reason for the result.
7. **Fix correlation.** The fix commit is looked up through `commits.incident_id`.
8. **Relapse detection.** CodePulse looks for a later commit with no incident link whose changed files overlap (`&&`) the fix commit's files and whose date is after the fix.
9. **Explanation.** The response includes a plain-language sentence describing the similarity, the overlapping frames and the original root cause.

### Post-mortem generation

`lib/postmortem.ts` builds the draft from stored facts first (root cause, resolution, fix commit, relapse explanation) and only then asks Gemini for the narrative parts (summary, impact, prevention, and for novel incidents a best-guess title, service, category and root cause). If the LLM call fails, the template is still returned. The trace is passed inside `<trace>` tags and the system prompt tells the model to treat it as untrusted data, which guards against prompt injection from log content.

Saving a post-mortem embeds it, inserts a new incident (with `repeat_of` set when it matched an earlier one) and a `postmortems` row. If embedding fails, the record is still saved without a vector and the UI says the search index is pending.

## API

| Route                   | Method | Purpose                                                            |
| ----------------------- | ------ | ------------------------------------------------------------------ |
| `/api/analyze`          | POST   | Analyze a trace and return the match, fix, relapse and explanation |
| `/api/postmortem/draft` | POST   | Generate a post-mortem draft for a trace                           |
| `/api/postmortem`       | POST   | Validate and save a post-mortem to the database                    |
| `/api/dashboard`        | GET    | Aggregated analytics                                               |

## Security and data integrity

- All AI and database access happens in server route handlers. No key uses the `NEXT_PUBLIC_` prefix, and none appears in client code.
- Secrets are read from environment variables only. `.env*` is git-ignored, and the git history was checked for committed keys.
- Every input is validated: traces must be 20 to 8000 characters, request bodies are size-limited, and post-mortems are validated field by field with zod.
- All SQL uses parameterized queries through the tagged-template driver. The dashboard queries take no user input.
- Errors returned to the client are generic. Details go to server logs only.
- Responses are sent with `Cache-Control: no-store`.

## Run locally

```bash
npm install
```

Create `.env.local` with:

```
DATABASE_URL=...                      # Neon connection string
GOOGLE_GENERATIVE_AI_API_KEY=...      # Gemini API key (server only)
```

Then:

```bash
npm run dev
```

Open http://localhost:3000. Click **Load demo trace**, then **Analyze**.

## Project structure

```
app/
  page.tsx                  incident workspace
  PostmortemPanel.tsx       post-mortem editor and save
  dashboard/page.tsx        analytics dashboard
  api/
    analyze/route.ts
    postmortem/route.ts
    postmortem/draft/route.ts
    dashboard/route.ts
lib/
  analyze.ts                search, fallback, correlation, relapse
  normalize.ts              trace normalization
  embed.ts                  Gemini embeddings
  postmortem.ts             draft generation and schema
  db.ts                     Neon client
```

## Limitations and next steps

- The seed data is synthetic. The match threshold (0.55) was set by testing against it and should be tuned on real incident history.
- There is no login or rate limiting yet. A production version would add authentication and per-user limits on the AI-backed routes.
- Commits are matched to incidents through a stored link. A production version would ingest commits from a Git provider and link them automatically.
