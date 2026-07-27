# Task Manager API — Submission

> **Take-Home Assignment: The Untested API**
> Stack: Node.js · Express · Jest · Supertest

---

## Quick Start

```bash
cd task-api
npm install
npm start          # http://localhost:3000
npm test           # run test suite
npm run coverage   # tests + coverage table
```

---

## Project Overview

This repository is a completed, production-readiness refactor of an untested Express API for managing tasks. Starting from a zero-test baseline, the work across three phases produced:

| Phase | Deliverable |
|-------|-------------|
| **1 — Audit & Test** | 145 tests written; 5 bugs identified; >96% statement coverage from a standing start |
| **2 — Fix** | All 5 bugs patched; tests updated to assert correct behaviour; 149 tests, 0 failures |
| **3 — Feature** | `PATCH /tasks/:id/assign` implemented end-to-end; 201 tests, 0 failures, 97.6% coverage |

---

## API Reference

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| `GET` | `/tasks` | ✅ | List all tasks. Supports `?status=`, `?page=`, `?limit=` |
| `POST` | `/tasks` | ✅ | Create a new task |
| `PUT` | `/tasks/:id` | ✅ | Partial/full field update |
| `DELETE` | `/tasks/:id` | ✅ | Delete a task — returns `204 No Content` |
| `PATCH` | `/tasks/:id/complete` | ✅ | Mark a task as done |
| `GET` | `/tasks/stats` | ✅ | Counts by status + overdue count |
| `PATCH` | `/tasks/:id/assign` | ✅ **NEW** | Assign a task to a named person |

### Task Schema

```json
{
  "id":          "uuid-v4",
  "title":       "string (required)",
  "description": "string (default: \"\")",
  "status":      "todo | in_progress | done  (default: todo)",
  "priority":    "low | medium | high  (default: medium)",
  "dueDate":     "ISO 8601 string | null",
  "assignee":    "string | null  (default: null)",
  "completedAt": "ISO 8601 string | null",
  "createdAt":   "ISO 8601 string"
}
```

### Sample Requests

```bash
# Create
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Write tests", "priority": "high"}'

# Filter by status
curl "http://localhost:3000/tasks?status=todo"

# Paginate (page 1, 10 per page)
curl "http://localhost:3000/tasks?page=1&limit=10"

# Mark complete
curl -X PATCH http://localhost:3000/tasks/<id>/complete

# Assign
curl -X PATCH http://localhost:3000/tasks/<id>/assign \
  -H "Content-Type: application/json" \
  -d '{"assignee": "alice@example.com"}'
```

---

## Architecture & Design Decisions

### Service / Route / Validator Separation

The codebase follows a strict three-layer pattern:

```
Request → routes/tasks.js  (HTTP concerns: status codes, req/res)
              ↓
          utils/validators.js  (pure functions: input → error string | null)
              ↓
          services/taskService.js  (domain logic + in-memory store)
```

Validators are **pure functions** that return an error string or `null`. They carry no Express coupling, which makes them trivially unit-testable in isolation without spinning up an HTTP server.

### Route Order Precision

`PATCH /:id/assign` is registered **before** `PATCH /:id/complete` in `routes/tasks.js`. Express matches patterns in registration order. If the generic `:id` segment were registered first with a different suffix handler, both specific paths could conflict. Ordering specific concrete patterns before generic ones is a deliberate correctness constraint, not a style choice.

```js
// tasks.js — order matters
router.patch('/:id/assign',   assignHandler);   // ← registered first
router.patch('/:id/complete', completeHandler); // ← registered second
```

### Explicit Schema Initialisation (`assignee: null`)

`create()` explicitly initialises `assignee: null` rather than relying on `undefined`. This ensures:

1. Every task object has the same shape regardless of how it was created — no `undefined` fields surface in `JSON.stringify` output (which silently drops `undefined` values)
2. API consumers can rely on `assignee` always being present in the response body (`null` vs. absent key is a meaningful distinction in typed clients)
3. Tests that check for field presence via `toHaveProperty('assignee')` work predictably

### Null-Safe Validators

All three validators (`validateCreateTask`, `validateUpdateTask`, `validateAssignee`) open with an identical body guard:

```js
if (!body || typeof body !== 'object' || Array.isArray(body)) {
  return 'Request body must be a valid JSON object';
}
```

This guards against `null`, `undefined`, primitive values, and arrays — all of which Express can receive as `req.body` in edge-case scenarios (missing `Content-Type`, malformed JSON, incorrect middleware ordering).

### `dueDate` Falsy vs. Null Check

The original codebase used `if (body.dueDate && isNaN(...))`, which silently accepted empty strings (`""` is falsy). The fix uses `body.dueDate != null` — an explicit null-check that rejects empty strings as invalid dates while still treating `null` as intentional omission.

---

## Bugs Found & Fixed

Full detail in [`BUG_REPORT.md`](./BUG_REPORT.md).

| ID | Severity | Location | Description | Fix |
|----|----------|----------|-------------|-----|
| BUG-001 | 🔴 Critical | `taskService.js:9` | `getByStatus` uses `String#includes` — partial substring match (`?status=do` returns both `todo` and `done`) | Changed to strict `===` equality |
| BUG-002 | 🔴 Critical | `taskService.js:12` | Pagination offset `page * limit` is 0-based but the route passes 1-based `page` — page 1 always skips the first page of results | Changed to `(page - 1) * limit` |
| BUG-003 | 🟡 Medium | `taskService.js:69` | `completeTask` hardcodes `priority: 'medium'`, silently destroying the original priority of any `high` or `low` task on completion | Removed the hardcoded override |
| BUG-004 | 🟡 Medium | `validators.js:4,20` | No null/undefined guard on `body` — accessing `.title` on a null body throws an unhandled `TypeError` | Added object shape guard at the top of each validator |
| BUG-005 | 🟡 Medium | `validators.js:14,30` | `if (body.dueDate && ...)` falsy check allows empty string `""` to bypass date validation | Changed to `body.dueDate != null` |

---

## Test Suite & Coverage

### Distribution

| File | Type | Tests |
|------|------|-------|
| `tests/unit/taskService.test.js` | Unit | 69 |
| `tests/unit/validators.test.js` | Unit | 59 |
| `tests/integration/tasks.test.js` | Integration | 73 |
| **Total** | | **201** |

### Final Coverage (`npm run coverage`)

```
Test Suites: 3 passed, 3 total
Tests:       201 passed, 0 failed
Time:        ~0.5s
```

| File | Statements | Branches | Functions | Lines |
|------|-----------|----------|-----------|-------|
| `routes/tasks.js` | 100% | 95.83% | 100% | 100% |
| `services/taskService.js` | 100% | 94.73% | 100% | 100% |
| `utils/validators.js` | 100% | 100% | 100% | 100% |
| **All business-logic files** | **100%** | **~97%** | **100%** | **100%** |
| All files (incl. `app.js`) | 97.6% | 97.16% | 93.33% | 97.38% |

> `app.js` sits below 100% because the Express error-handler callback (lines 10–11) and the `app.listen()` block (lines 17–18) are not reachable under `supertest` without injecting an artificial middleware error or calling `listen()` from tests. These are structural test boundaries, not logic gaps.

### What the Tests Cover

- **Happy paths** — every endpoint, every default, every valid enum value
- **Validation rejection** — missing fields, wrong types, wrong enum values, empty/whitespace, oversized inputs
- **HTTP status codes** — `200`, `201`, `204`, `400`, `404` exercised explicitly
- **Edge cases** — null body, empty body `{}`, partial status strings, 0/negative pagination, boundary assignee length (99 / 100 / 101 chars), double-delete, re-assignment
- **State isolation** — `beforeEach` calls `taskService._reset()` so every test runs against a clean in-memory store
- **Data integrity** — verifies that field updates are non-destructive (e.g., a status update preserves title, completing a task preserves priority)
- **E2E lifecycle** — Create → Update → Complete → Delete flow tested as a single chain

---

## Submission Reflections

### What I'd test next with more time

**Concurrency & state mutation.** The in-memory store is a plain JS array with no locking. Under concurrent requests — even in a single-threaded Node.js process with async I/O — operations like splice/push can race if any step yields to the event loop asynchronously in future. I'd add tests that fire multiple `POST` and `DELETE` requests simultaneously and assert the final state is consistent.

**Pagination contract completeness.** The current tests verify correct slices for `page=1,2` and overflow. I'd also add property-based tests (using something like `fast-check`) that generate random `(page, limit, totalTasks)` triples and assert that the union of all pages equals `getAll()` with no duplicates or gaps.

**`/stats` overdue boundary precision.** The overdue check is `new Date(t.dueDate) < now` computed at query time. I'd add a test that creates a task with `dueDate` equal to *exactly* the current second and asserts it flips from not-overdue to overdue as time advances — using Jest's fake timers (`jest.useFakeTimers`).

**Load / stress testing.** With an in-memory array, linear-scan `findIndex` is O(n). I'd run a stress test seeding 10 000 tasks and measuring p95 latency on `GET /tasks?page=1&limit=10` and `GET /tasks/stats` to establish a performance baseline before any future indexing change.

**Contract / schema testing.** Every endpoint response should be validated against a JSON Schema or OpenAPI spec to catch accidental field renames or type changes. Tools like `ajv` or `zod` make this straightforward.

---

### What surprised me in the codebase

**`String#includes` in `getByStatus` (BUG-001).**
This was the most surprising — not because it's an obscure API, but because it's a plausible-looking one-liner that silently does the wrong thing. `t.status.includes(status)` reads as if it's checking membership in an array (the intent), but it actually does a substring search on the status string. Querying `?status=do` returns every `todo` *and* every `done` task. Because there's no validation that `status` must be one of the known enum values on the read path, arbitrary partial strings succeed silently. This kind of bug is nearly impossible to catch by reading the code; it only surfaces under test.

**Pagination skipping page 1 entirely (BUG-002).**
`offset = page * limit` is a 0-based formula. The route layer defaults to `page=1`, meaning `offset = 1 * 10 = 10` on the very first page request. The first 10 tasks are permanently inaccessible through normal pagination. What's subtle is that this bug is invisible when the total dataset is smaller than `limit` (all results fit on one page regardless), so it would only manifest under realistic data volumes.

**`completeTask` overwriting `priority` (BUG-003).**
A hardcoded `priority: 'medium'` inside an object spread is easy to overlook. The `...task` spread already copies the original priority, so the explicit `priority: 'medium'` silently wins. The most likely explanation is a developer testing with a known state and forgetting to remove the override. Because there was no test coverage, it shipped undetected.

---

### Questions I'd ask before shipping to production

**Persistence strategy.** The in-memory store resets on every process restart — not viable in production. What's the database target? A relational store (PostgreSQL) would change task IDs from UUIDs to sequences (or keep UUIDs as PKs), require migrations, and introduce connection pooling concerns. A document store (MongoDB) would be more schema-flexible but complicates relational queries like the overdue count.

**Authentication & authorisation on `/assign`.** Who is allowed to assign a task? Should an assignee be validated against a users service? Can a task be reassigned freely, or does that require a specific role? Without answers here, the current endpoint accepts any arbitrary string as `assignee`, which is fine for a demo but wrong for a real product.

**Assignee identity model.** Is `assignee` a free-text display name, a username, or a user ID that maps to a Users service? Storing a mutable display name directly on the task creates a consistency problem if the user renames their account. A user ID + a lookup-on-read pattern would be more robust.

**Rate limiting & DoS hardening.** There is no rate limiting, request size limit, or input length cap beyond the `assignee` 100-char guard added in Step 3. In production, `express-rate-limit` and an explicit `express.json({ limit: '10kb' })` body size cap should be added at the app level.

**Logging & observability.** The only instrumentation today is `console.error` in the global error handler. For production: structured request logging (e.g., `pino` + `pino-http`), distributed tracing IDs on each request, and a metrics endpoint (Prometheus `/metrics`) or APM integration would be required to diagnose issues without SSH access.

**Error response contract.** Validation errors return `{ error: "string" }`. Should the schema be richer — e.g., `{ code: "VALIDATION_ERROR", field: "assignee", message: "..." }` — so API clients can handle errors programmatically rather than string-matching? This is a one-way door decision once consumers are deployed against it.

**Graceful shutdown.** There is no `SIGTERM` handler. In a containerised environment, a process killed by the orchestrator mid-request will drop in-flight responses. A `process.on('SIGTERM', () => server.close(...))` pattern (with a drain timeout) should be added before production deploy.
