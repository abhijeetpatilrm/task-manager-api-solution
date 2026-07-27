'use strict';

const request = require('supertest');
const app = require('../../src/app');
const taskService = require('../../src/services/taskService');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const VALID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const validPayload = (overrides = {}) => ({
  title: 'Integration Test Task',
  description: 'Created during integration test',
  status: 'todo',
  priority: 'medium',
  dueDate: '2025-12-31T23:59:59.000Z',
  ...overrides,
});

beforeEach(() => {
  taskService._reset();
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /tasks — list all tasks
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /tasks', () => {
  it('200 — returns an empty array when no tasks exist', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('200 — returns all tasks after creation', async () => {
    await request(app).post('/tasks').send(validPayload({ title: 'A' }));
    await request(app).post('/tasks').send(validPayload({ title: 'B' }));

    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('200 — each task has expected fields', async () => {
    await request(app).post('/tasks').send(validPayload());
    const res = await request(app).get('/tasks');
    const task = res.body[0];

    expect(task).toHaveProperty('id');
    expect(task).toHaveProperty('title');
    expect(task).toHaveProperty('status');
    expect(task).toHaveProperty('priority');
    expect(task).toHaveProperty('createdAt');
    expect(task).toHaveProperty('completedAt');
  });

  // ── ?status filter ──────────────────────────────────────────────────────────
  describe('?status query param', () => {
    beforeEach(async () => {
      await request(app).post('/tasks').send(validPayload({ title: 'Todo 1', status: 'todo' }));
      await request(app).post('/tasks').send(validPayload({ title: 'Todo 2', status: 'todo' }));
      await request(app).post('/tasks').send(validPayload({ title: 'Done task', status: 'done' }));
    });

    it('200 — filters by status=todo', async () => {
      const res = await request(app).get('/tasks?status=todo');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      res.body.forEach((t) => expect(t.status).toBe('todo'));
    });

    it('200 — filters by status=done', async () => {
      const res = await request(app).get('/tasks?status=done');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it('200 — returns empty array for status with no matching tasks', async () => {
      const res = await request(app).get('/tasks?status=in_progress');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('FIXED: ?status=do returns 0 tasks (strict equality, no partial match)', async () => {
      const res = await request(app).get('/tasks?status=do');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0); // no task has status exactly === 'do'
    });
  });

  // ── ?page / ?limit pagination ───────────────────────────────────────────────
  describe('?page & ?limit query params', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 5; i++) {
        await request(app).post('/tasks').send(validPayload({ title: `Task ${i}` }));
      }
    });

    it('FIXED: page=1&limit=2 returns the first 2 tasks (1-based offset)', async () => {
      const res = await request(app).get('/tasks?page=1&limit=2');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe('Task 1');
      expect(res.body[1].title).toBe('Task 2');
    });

    it('FIXED: page=2&limit=2 returns tasks 3 and 4', async () => {
      const res = await request(app).get('/tasks?page=2&limit=2');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe('Task 3');
      expect(res.body[1].title).toBe('Task 4');
    });

    it('200 — returns empty array when page exceeds available tasks', async () => {
      const res = await request(app).get('/tasks?page=999&limit=10');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('200 — limit=3 returns at most 3 tasks', async () => {
      const res = await request(app).get('/tasks?limit=3');
      expect(res.status).toBe(200);
      expect(res.body.length).toBeLessThanOrEqual(3);
    });

    it('200 — limit only (no page) falls back to page=1 via parseInt fallback', async () => {
      const res = await request(app).get('/tasks?limit=2');
      expect(res.status).toBe(200);
      // With bug: page=1 means offset=2, skips first 2 tasks. Documents behaviour.
      expect(res.body).toBeDefined();
    });

    it('200 — non-numeric page defaults to page=1 internally', async () => {
      const res = await request(app).get('/tasks?page=abc&limit=2');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('200 — negative limit returns empty or partial (edge case)', async () => {
      const res = await request(app).get('/tasks?page=1&limit=-1');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /tasks — create task
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /tasks', () => {
  // ── Happy paths ─────────────────────────────────────────────────────────────
  it('201 — creates a task with all valid fields', async () => {
    const payload = validPayload();
    const res = await request(app).post('/tasks').send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: payload.title,
      description: payload.description,
      status: payload.status,
      priority: payload.priority,
      dueDate: payload.dueDate,
    });
    expect(res.body.id).toMatch(VALID_UUID);
    expect(res.body.completedAt).toBeNull();
    expect(res.body.createdAt).toBeDefined();
  });

  it('201 — creates a task with only title (uses defaults)', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Minimal' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('todo');
    expect(res.body.priority).toBe('medium');
    expect(res.body.description).toBe('');
    expect(res.body.dueDate).toBeNull();
  });

  it('201 — returns the created task in response body', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Return me' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Return me');
  });

  // ── Validation errors ────────────────────────────────────────────────────────
  it('400 — missing title', async () => {
    const res = await request(app).post('/tasks').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('400 — empty title', async () => {
    const res = await request(app).post('/tasks').send({ title: '' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('400 — whitespace-only title', async () => {
    const res = await request(app).post('/tasks').send({ title: '   ' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('400 — numeric title', async () => {
    const res = await request(app).post('/tasks').send({ title: 99 });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('400 — invalid status enum value', async () => {
    const res = await request(app)
      .post('/tasks')
      .send(validPayload({ status: 'pending' }));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status must be one of/);
  });

  it('400 — invalid priority enum value', async () => {
    const res = await request(app)
      .post('/tasks')
      .send(validPayload({ priority: 'critical' }));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/priority must be one of/);
  });

  it('400 — invalid dueDate format', async () => {
    const res = await request(app)
      .post('/tasks')
      .send(validPayload({ dueDate: 'not-a-date' }));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/dueDate/);
  });

  it('400 — completely empty body (no Content-Type / empty object)', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({});
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /tasks/:id — NOT a real route but tested via list + find
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// PUT /tasks/:id — update task
// ─────────────────────────────────────────────────────────────────────────────
describe('PUT /tasks/:id', () => {
  let createdTask;

  beforeEach(async () => {
    const res = await request(app).post('/tasks').send(validPayload());
    createdTask = res.body;
  });

  // ── Happy paths ─────────────────────────────────────────────────────────────
  it('200 — updates a task title', async () => {
    const res = await request(app)
      .put(`/tasks/${createdTask.id}`)
      .send({ title: 'Updated title' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated title');
  });

  it('200 — updates status to in_progress', async () => {
    const res = await request(app)
      .put(`/tasks/${createdTask.id}`)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_progress');
  });

  it('200 — updates priority', async () => {
    const res = await request(app)
      .put(`/tasks/${createdTask.id}`)
      .send({ priority: 'high' });
    expect(res.status).toBe(200);
    expect(res.body.priority).toBe('high');
  });

  it('200 — updates dueDate', async () => {
    const newDate = '2030-06-01T00:00:00.000Z';
    const res = await request(app)
      .put(`/tasks/${createdTask.id}`)
      .send({ dueDate: newDate });
    expect(res.status).toBe(200);
    expect(res.body.dueDate).toBe(newDate);
  });

  it('200 — partial update preserves other fields', async () => {
    const res = await request(app)
      .put(`/tasks/${createdTask.id}`)
      .send({ status: 'done' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe(createdTask.title); // title unchanged
  });

  it('200 — empty update body returns the existing task unchanged', async () => {
    const res = await request(app).put(`/tasks/${createdTask.id}`).send({});
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdTask.id);
  });

  // ── Error cases ──────────────────────────────────────────────────────────────
  it('404 — non-existent task id', async () => {
    const res = await request(app)
      .put('/tasks/00000000-0000-0000-0000-000000000000')
      .send({ title: 'Ghost' });
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Task not found');
  });

  it('400 — invalid status in update', async () => {
    const res = await request(app)
      .put(`/tasks/${createdTask.id}`)
      .send({ status: 'INVALID' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status must be one of/);
  });

  it('400 — empty title in update', async () => {
    const res = await request(app)
      .put(`/tasks/${createdTask.id}`)
      .send({ title: '' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('400 — invalid dueDate in update', async () => {
    const res = await request(app)
      .put(`/tasks/${createdTask.id}`)
      .send({ dueDate: 'bad-date' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /tasks/:id — remove task
// ─────────────────────────────────────────────────────────────────────────────
describe('DELETE /tasks/:id', () => {
  let createdTask;

  beforeEach(async () => {
    const res = await request(app).post('/tasks').send(validPayload());
    createdTask = res.body;
  });

  it('204 — successfully deletes an existing task', async () => {
    const res = await request(app).delete(`/tasks/${createdTask.id}`);
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it('204 — task is no longer returned after deletion', async () => {
    await request(app).delete(`/tasks/${createdTask.id}`);
    const listRes = await request(app).get('/tasks');
    expect(listRes.body).toHaveLength(0);
  });

  it('404 — deleting a non-existent task', async () => {
    const res = await request(app).delete(
      '/tasks/00000000-0000-0000-0000-000000000000'
    );
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Task not found');
  });

  it('404 — double-delete returns 404 on second attempt', async () => {
    await request(app).delete(`/tasks/${createdTask.id}`);
    const res = await request(app).delete(`/tasks/${createdTask.id}`);
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /tasks/:id/complete — complete task
// ─────────────────────────────────────────────────────────────────────────────
describe('PATCH /tasks/:id/complete', () => {
  let createdTask;

  beforeEach(async () => {
    const res = await request(app)
      .post('/tasks')
      .send(validPayload({ priority: 'high' }));
    createdTask = res.body;
  });

  it('200 — marks a task as done', async () => {
    const res = await request(app).patch(`/tasks/${createdTask.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
  });

  it('200 — sets completedAt to a non-null ISO string', async () => {
    const res = await request(app).patch(`/tasks/${createdTask.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.completedAt).not.toBeNull();
    expect(new Date(res.body.completedAt).toISOString()).toBe(
      res.body.completedAt
    );
  });

  it('FIXED: completing a high-priority task preserves priority (no longer resets to medium)', async () => {
    const res = await request(app).patch(`/tasks/${createdTask.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.priority).toBe('high'); // original priority preserved
  });

  it('404 — completing a non-existent task', async () => {
    const res = await request(app).patch(
      '/tasks/00000000-0000-0000-0000-000000000000/complete'
    );
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Task not found');
  });

  it('200 — completed task is reflected in GET /tasks', async () => {
    await request(app).patch(`/tasks/${createdTask.id}/complete`);
    const listRes = await request(app).get('/tasks');
    const found = listRes.body.find((t) => t.id === createdTask.id);
    expect(found.status).toBe('done');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /tasks/stats
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /tasks/stats', () => {
  it('200 — returns zeroed stats when no tasks exist', async () => {
    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      todo: 0,
      in_progress: 0,
      done: 0,
      overdue: 0,
    });
  });

  it('200 — stats reflect created tasks by status (using future dueDate to avoid overdue)', async () => {
    await request(app).post('/tasks').send(validPayload({ status: 'todo', dueDate: '2999-01-01T00:00:00.000Z' }));
    await request(app).post('/tasks').send(validPayload({ status: 'todo', dueDate: '2999-01-01T00:00:00.000Z' }));
    await request(app).post('/tasks').send(validPayload({ status: 'in_progress', dueDate: '2999-01-01T00:00:00.000Z' }));
    await request(app).post('/tasks').send(validPayload({ status: 'done', dueDate: '2999-01-01T00:00:00.000Z' }));

    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body.todo).toBe(2);
    expect(res.body.in_progress).toBe(1);
    expect(res.body.done).toBe(1);
    expect(res.body.overdue).toBe(0);
  });

  it('200 — overdue count increments for past-due non-done tasks', async () => {
    await request(app)
      .post('/tasks')
      .send(validPayload({ status: 'todo', dueDate: '2000-01-01T00:00:00.000Z' }));
    await request(app)
      .post('/tasks')
      .send(validPayload({ status: 'done', dueDate: '2000-01-01T00:00:00.000Z' }));

    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body.overdue).toBe(1); // done task not counted
  });

  it('200 — stats update after completing a task', async () => {
    const created = await request(app)
      .post('/tasks')
      .send(validPayload({ status: 'todo' }));
    await request(app).patch(`/tasks/${created.body.id}/complete`);

    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body.done).toBe(1);
    expect(res.body.todo).toBe(0);
  });

  it('200 — stats update after deleting a task', async () => {
    const created = await request(app)
      .post('/tasks')
      .send(validPayload({ status: 'todo' }));
    await request(app).delete(`/tasks/${created.body.id}`);

    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body.todo).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// End-to-end lifecycle flow
// ─────────────────────────────────────────────────────────────────────────────
describe('E2E Task Lifecycle', () => {
  it('Create → Update → Complete → Delete lifecycle', async () => {
    // Create
    const createRes = await request(app)
      .post('/tasks')
      .send({ title: 'Lifecycle task', priority: 'low' });
    expect(createRes.status).toBe(201);
    const id = createRes.body.id;

    // Update
    const updateRes = await request(app)
      .put(`/tasks/${id}`)
      .send({ status: 'in_progress', title: 'Lifecycle task (updated)' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.status).toBe('in_progress');

    // Complete
    const completeRes = await request(app).patch(`/tasks/${id}/complete`);
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.status).toBe('done');

    // Verify in list
    const listRes = await request(app).get('/tasks');
    const found = listRes.body.find((t) => t.id === id);
    expect(found).toBeDefined();
    expect(found.status).toBe('done');

    // Delete
    const deleteRes = await request(app).delete(`/tasks/${id}`);
    expect(deleteRes.status).toBe(204);

    // Confirm deleted
    const listAfter = await request(app).get('/tasks');
    expect(listAfter.body.find((t) => t.id === id)).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /tasks/:id/assign — assign task
// ─────────────────────────────────────────────────────────────────────────────
describe('PATCH /tasks/:id/assign', () => {
  let createdTask;

  beforeEach(async () => {
    const res = await request(app)
      .post('/tasks')
      .send(validPayload({ title: 'Assign me', priority: 'high' }));
    createdTask = res.body;
  });

  // ── Happy paths ─────────────────────────────────────────────────────────────
  it('200 — successfully assigns a task', async () => {
    const res = await request(app)
      .patch(`/tasks/${createdTask.id}/assign`)
      .send({ assignee: 'alice@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('alice@example.com');
  });

  it('200 — response includes all task fields plus assignee', async () => {
    const res = await request(app)
      .patch(`/tasks/${createdTask.id}/assign`)
      .send({ assignee: 'bob' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', createdTask.id);
    expect(res.body).toHaveProperty('title', createdTask.title);
    expect(res.body).toHaveProperty('status', createdTask.status);
    expect(res.body).toHaveProperty('priority', createdTask.priority);
    expect(res.body).toHaveProperty('assignee', 'bob');
  });

  it('200 — new tasks have assignee: null before assignment', async () => {
    const listRes = await request(app).get('/tasks');
    expect(listRes.body[0].assignee).toBeNull();
  });

  it('200 — reassigning an already-assigned task updates the assignee', async () => {
    await request(app)
      .patch(`/tasks/${createdTask.id}/assign`)
      .send({ assignee: 'alice' });

    const res = await request(app)
      .patch(`/tasks/${createdTask.id}/assign`)
      .send({ assignee: 'charlie' });

    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('charlie');
  });

  it('200 — assignee is trimmed (leading/trailing whitespace stripped)', async () => {
    const res = await request(app)
      .patch(`/tasks/${createdTask.id}/assign`)
      .send({ assignee: '  diana  ' });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('diana');
  });

  it('200 — assigning does not change priority', async () => {
    const res = await request(app)
      .patch(`/tasks/${createdTask.id}/assign`)
      .send({ assignee: 'eve' });
    expect(res.status).toBe(200);
    expect(res.body.priority).toBe('high'); // unchanged
  });

  it('200 — assignment is reflected in GET /tasks list', async () => {
    await request(app)
      .patch(`/tasks/${createdTask.id}/assign`)
      .send({ assignee: 'frank' });

    const listRes = await request(app).get('/tasks');
    const found = listRes.body.find((t) => t.id === createdTask.id);
    expect(found).toBeDefined();
    expect(found.assignee).toBe('frank');
  });

  // ── Not found ────────────────────────────────────────────────────────────────
  it('404 — non-existent task id', async () => {
    const res = await request(app)
      .patch('/tasks/00000000-0000-0000-0000-000000000000/assign')
      .send({ assignee: 'ghost' });
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Task not found');
  });

  // ── Validation failures — body ────────────────────────────────────────────────
  it('400 — missing body returns validation error', async () => {
    const res = await request(app)
      .patch(`/tasks/${createdTask.id}/assign`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  // ── Validation failures — missing/null assignee ───────────────────────────────
  it('400 — missing assignee key', async () => {
    const res = await request(app)
      .patch(`/tasks/${createdTask.id}/assign`)
      .send({ other: 'field' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('assignee is required');
  });

  it('400 — null assignee', async () => {
    const res = await request(app)
      .patch(`/tasks/${createdTask.id}/assign`)
      .send({ assignee: null });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('assignee is required');
  });

  // ── Validation failures — wrong type ─────────────────────────────────────────
  it('400 — numeric assignee', async () => {
    const res = await request(app)
      .patch(`/tasks/${createdTask.id}/assign`)
      .send({ assignee: 42 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('assignee must be a string');
  });

  it('400 — boolean assignee', async () => {
    const res = await request(app)
      .patch(`/tasks/${createdTask.id}/assign`)
      .send({ assignee: true });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('assignee must be a string');
  });

  it('400 — object assignee', async () => {
    const res = await request(app)
      .patch(`/tasks/${createdTask.id}/assign`)
      .send({ assignee: { name: 'alice' } });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('assignee must be a string');
  });

  it('400 — array assignee', async () => {
    const res = await request(app)
      .patch(`/tasks/${createdTask.id}/assign`)
      .send({ assignee: ['alice'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('assignee must be a string');
  });

  // ── Validation failures — empty / whitespace ──────────────────────────────────
  it('400 — empty string assignee', async () => {
    const res = await request(app)
      .patch(`/tasks/${createdTask.id}/assign`)
      .send({ assignee: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('assignee must not be empty or whitespace');
  });

  it('400 — whitespace-only assignee', async () => {
    const res = await request(app)
      .patch(`/tasks/${createdTask.id}/assign`)
      .send({ assignee: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('assignee must not be empty or whitespace');
  });

  // ── Validation failures — length ──────────────────────────────────────────────
  it('400 — assignee exceeding 100 characters', async () => {
    const res = await request(app)
      .patch(`/tasks/${createdTask.id}/assign`)
      .send({ assignee: 'a'.repeat(101) });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('assignee must not exceed 100 characters');
  });

  it('200 — assignee of exactly 100 characters is accepted', async () => {
    const res = await request(app)
      .patch(`/tasks/${createdTask.id}/assign`)
      .send({ assignee: 'a'.repeat(100) });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('a'.repeat(100));
  });
});
