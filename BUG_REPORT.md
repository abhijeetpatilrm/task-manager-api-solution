# BUG_REPORT.md — Task API: Discovered Defects

**Project:** Task Manager API  
**Audit Date:** 2026-07-27  
**Engineer:** Senior Principal Software Engineer  
**Total Bugs Found:** 5 (2 Critical, 3 Medium)  
**Files Affected:** `src/services/taskService.js`, `src/utils/validators.js`

---

## Summary Table

| ID | Severity | File | Line(s) | Description |
|----|----------|------|---------|-------------|
| [BUG-001](#bug-001) | 🔴 Critical | `taskService.js` | 9 | `getByStatus` uses substring match instead of strict equality |
| [BUG-002](#bug-002) | 🔴 Critical | `taskService.js` | 12 | Off-by-one pagination — `offset = page * limit` skips page 1 |
| [BUG-003](#bug-003) | 🟡 Medium | `taskService.js` | 69 | `completeTask` silently resets `priority` to `'medium'` |
| [BUG-004](#bug-004) | 🟡 Medium | `validators.js` | 4, 20 | No null/undefined guard on `body` causes unhandled `TypeError` |
| [BUG-005](#bug-005) | 🟡 Medium | `validators.js` | 14, 30 | Empty-string `dueDate` bypasses validation due to falsy check |

---

## BUG-001

**Severity:** 🔴 Critical  
**File:** `src/services/taskService.js`  
**Line:** 9

### Description

`getByStatus` uses JavaScript's `String.prototype.includes()` to match tasks by status. This performs a **substring search** on the status string rather than a strict equality comparison.

### Expected Behaviour

Querying `GET /tasks?status=todo` should return **only** tasks whose `status` field is exactly `"todo"`.

### Actual Behaviour

Because `"todo".includes("do")` → `true` and `"done".includes("do")` → `true`, querying `?status=do` returns **all** `todo` and `done` tasks. Querying `?status=in` returns all `in_progress` tasks. Any partial string silently matches multiple statuses.

### Root Cause Analysis

```js
// BUGGY — L9
const getByStatus = (status) => tasks.filter((t) => t.status.includes(status));
```

`String.prototype.includes(searchString)` checks whether `searchString` appears **anywhere** within the string. It was most likely a copy-paste error where the developer intended to filter an array with `Array.prototype.includes()` (e.g., `validStatuses.includes(status)`), but accidentally called `.includes` on the status string itself.

### Recommended Fix

```js
// FIXED — strict equality
const getByStatus = (status) => tasks.filter((t) => t.status === status);
```

---

## BUG-002

**Severity:** 🔴 Critical  
**File:** `src/services/taskService.js`  
**Line:** 12

### Description

The `getPaginated` function calculates the array slice offset using `page * limit` instead of the correct 1-based formula `(page - 1) * limit`. The route layer passes `page=1` as the first page (1-indexed), but the service treats pages as 0-indexed.

### Expected Behaviour

`GET /tasks?page=1&limit=2` should return the **first 2 tasks** (indices 0–1).

### Actual Behaviour

With 5 tasks in storage:
- `page=1, limit=2` → `offset = 1 * 2 = 2` → returns tasks at indices 2–3 (skips page 1 entirely)
- `page=2, limit=2` → `offset = 2 * 2 = 4` → returns only task at index 4 (1 result instead of 2)
- The **first page of data is never accessible** via `page=1`.

### Root Cause Analysis

```js
// BUGGY — L11-13
const getPaginated = (page, limit) => {
  const offset = page * limit;  // 0-based formula used with 1-based input
  return tasks.slice(offset, offset + limit);
};
```

The route layer defaults to `page=1` (`parseInt(page) || 1`), implying a 1-based API contract. The service formula is designed for 0-based indexing. There is a semantic mismatch between the two layers.

### Recommended Fix

```js
// FIXED — 1-based page input
const getPaginated = (page, limit) => {
  const offset = (page - 1) * limit;
  return tasks.slice(offset, offset + limit);
};
```

---

## BUG-003

**Severity:** 🟡 Medium  
**File:** `src/services/taskService.js`  
**Line:** 69

### Description

`completeTask` unconditionally overwrites the task's `priority` field to `'medium'` whenever a task is marked complete, regardless of the task's original priority.

### Expected Behaviour

Completing a task should set `status = 'done'` and `completedAt = <timestamp>`. The `priority` field should remain unchanged.

### Actual Behaviour

Any task completed via `PATCH /tasks/:id/complete` has its `priority` silently overwritten to `'medium'`, causing permanent, unrecoverable data loss for `high` and `low` priority tasks.

### Root Cause Analysis

```js
// BUGGY — L67-72
const updated = {
  ...task,
  priority: 'medium',         // destructive; not part of the "complete" operation
  status: 'done',
  completedAt: new Date().toISOString(),
};
```

This appears to be an accidental inclusion — the developer was likely testing with a hardcoded value and never removed it. The spread `...task` already carries the original priority, so the explicit `priority: 'medium'` line overrides it.

### Recommended Fix

```js
// FIXED — remove priority override entirely
const updated = {
  ...task,
  status: 'done',
  completedAt: new Date().toISOString(),
};
```

---

## BUG-004

**Severity:** 🟡 Medium  
**File:** `src/utils/validators.js`  
**Lines:** 4, 20

### Description

Both `validateCreateTask` and `validateUpdateTask` assume `body` is a non-null object and immediately access properties on it. If `body` is `null` or `undefined` (e.g., a request sent without `Content-Type: application/json`, or with a malformed JSON payload), the function throws an unhandled `TypeError` before Express's error-handler middleware can intercept it.

### Expected Behaviour

If the request body is `null`, `undefined`, or not an object, the validator should return a descriptive error string — not throw.

### Actual Behaviour

```
TypeError: Cannot read properties of null (reading 'title')
    at validateCreateTask (src/utils/validators.js:5)
```

The error propagates as an unhandled exception. In production, this may manifest as a hung request, a 500 without a meaningful error body, or process termination in strict environments.

### Root Cause Analysis

```js
// BUGGY — no null guard before property access
const validateCreateTask = (body) => {
  if (!body.title || ...) { ... }  // crashes if body is null/undefined
```

The route handler passes `req.body` directly without verifying that Express JSON middleware successfully parsed the body into an object.

### Recommended Fix

```js
// FIXED — guard at the top of each validator
const validateCreateTask = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Request body must be a valid JSON object';
  }
  // ... existing validation
};
```

---

## BUG-005

**Severity:** 🟡 Medium  
**File:** `src/utils/validators.js`  
**Lines:** 14, 30

### Description

Both validators use `if (body.dueDate && isNaN(Date.parse(body.dueDate)))`. The leading `body.dueDate &&` guard is **falsy-based**, meaning any falsy value for `dueDate` (including an empty string `""`) silently bypasses date validation. An empty string is an invalid date but passes without an error because `""` is falsy in JavaScript.

### Expected Behaviour

`dueDate: ""` should fail validation with `'dueDate must be a valid ISO date string'`.

### Actual Behaviour

`dueDate: ""` is treated as "not provided" and passes validation silently. The task is created with `dueDate: ""` stored (or inherits the default `null` from destructuring, masking the issue at service level while the API accepts an invalid value).

### Root Cause Analysis

```js
// BUGGY — empty string is falsy, bypasses isNaN check
if (body.dueDate && isNaN(Date.parse(body.dueDate))) { ... }
//  ^^^^^^^^^^^^^ "" evaluates to false → validation block never entered
```

### Recommended Fix

```js
// FIXED — explicit undefined/null check preserves intentional omission
if (body.dueDate != null && isNaN(Date.parse(body.dueDate))) {
  return 'dueDate must be a valid ISO date string';
}
```

---

## Fix Verification

After applying all fixes:

```
Test Suites: 3 passed, 3 total
Tests:       145 passed, 0 failed
Coverage:    >= 97% statements / >= 96% branches / >= 92% functions / >= 96% lines
```
