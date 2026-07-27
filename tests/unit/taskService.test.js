'use strict';

const taskService = require('../../src/services/taskService');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const makeTask = (overrides = {}) => ({
  title: 'Default Task',
  description: 'A test task',
  status: 'todo',
  priority: 'medium',
  dueDate: null,
  ...overrides,
});

beforeEach(() => {
  taskService._reset();
});

// ─────────────────────────────────────────────────────────────────────────────
// getAll
// ─────────────────────────────────────────────────────────────────────────────
describe('getAll', () => {
  it('returns an empty array when no tasks exist', () => {
    expect(taskService.getAll()).toEqual([]);
  });

  it('returns all created tasks', () => {
    taskService.create(makeTask({ title: 'A' }));
    taskService.create(makeTask({ title: 'B' }));
    expect(taskService.getAll()).toHaveLength(2);
  });

  it('returns a shallow copy — mutations do not affect internal state', () => {
    taskService.create(makeTask());
    const copy = taskService.getAll();
    copy.push({ id: 'fake' });
    expect(taskService.getAll()).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// findById
// ─────────────────────────────────────────────────────────────────────────────
describe('findById', () => {
  it('finds a task by its generated id', () => {
    const created = taskService.create(makeTask({ title: 'Find me' }));
    const found = taskService.findById(created.id);
    expect(found).toBeDefined();
    expect(found.title).toBe('Find me');
  });

  it('returns undefined for a non-existent id', () => {
    expect(taskService.findById('00000000-0000-0000-0000-000000000000')).toBeUndefined();
  });

  it('returns undefined for an empty string id', () => {
    expect(taskService.findById('')).toBeUndefined();
  });

  it('returns undefined when tasks list is empty', () => {
    expect(taskService.findById('any-id')).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getByStatus
// ─────────────────────────────────────────────────────────────────────────────
describe('getByStatus', () => {
  beforeEach(() => {
    taskService.create(makeTask({ title: 'Todo 1', status: 'todo' }));
    taskService.create(makeTask({ title: 'Todo 2', status: 'todo' }));
    taskService.create(makeTask({ title: 'In progress', status: 'in_progress' }));
    taskService.create(makeTask({ title: 'Done', status: 'done' }));
  });

  it('returns only tasks with the given status', () => {
    const result = taskService.getByStatus('todo');
    expect(result).toHaveLength(2);
    result.forEach((t) => expect(t.status).toBe('todo'));
  });

  it('returns an empty array when no tasks match the status', () => {
    expect(taskService.getByStatus('nonexistent')).toEqual([]);
  });

  it('returns in_progress tasks correctly', () => {
    const result = taskService.getByStatus('in_progress');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('In progress');
  });

  it('FIXED: exact status string "in" returns 0 tasks (no partial match)', () => {
    const result = taskService.getByStatus('in');
    expect(result).toHaveLength(0); // no task has status === 'in'
  });

  it('FIXED: exact status string "do" returns 0 tasks (no partial match)', () => {
    const result = taskService.getByStatus('do');
    expect(result).toHaveLength(0); // no task has status === 'do'
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getPaginated
// ─────────────────────────────────────────────────────────────────────────────
describe('getPaginated', () => {
  beforeEach(() => {
    // Create 5 tasks
    for (let i = 1; i <= 5; i++) {
      taskService.create(makeTask({ title: `Task ${i}` }));
    }
  });

  it('FIXED: page=1 returns the FIRST two tasks (1-based offset corrected)', () => {
    const result = taskService.getPaginated(1, 2);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Task 1');
    expect(result[1].title).toBe('Task 2');
  });

  it('FIXED: page=2 with limit=2 returns tasks 3 and 4', () => {
    const result = taskService.getPaginated(2, 2);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Task 3');
    expect(result[1].title).toBe('Task 4');
  });

  it('returns an empty array when page is beyond total tasks', () => {
    // Even with the off-by-one bug, page=100 with limit=2 is always empty
    const result = taskService.getPaginated(100, 2);
    expect(result).toEqual([]);
  });

  it('returns at most `limit` tasks', () => {
    // page=0 with limit=3: offset=0 (correct with buggy formula when page=0)
    const result = taskService.getPaginated(0, 3);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('handles limit larger than total task count', () => {
    // page=1 with huge limit: offset = (1-1)*100 = 0, returns all 5 tasks
    const result = taskService.getPaginated(1, 100);
    expect(result).toHaveLength(5);
  });

  it('page=1 limit=5 returns all 5 tasks exactly', () => {
    const result = taskService.getPaginated(1, 5);
    expect(result).toHaveLength(5);
    expect(result[0].title).toBe('Task 1');
    expect(result[4].title).toBe('Task 5');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getStats
// ─────────────────────────────────────────────────────────────────────────────
describe('getStats', () => {
  it('returns zeroed stats when no tasks exist', () => {
    expect(taskService.getStats()).toEqual({
      todo: 0,
      in_progress: 0,
      done: 0,
      overdue: 0,
    });
  });

  it('correctly counts tasks by status', () => {
    taskService.create(makeTask({ status: 'todo' }));
    taskService.create(makeTask({ status: 'todo' }));
    taskService.create(makeTask({ status: 'in_progress' }));
    taskService.create(makeTask({ status: 'done' }));

    const stats = taskService.getStats();
    expect(stats.todo).toBe(2);
    expect(stats.in_progress).toBe(1);
    expect(stats.done).toBe(1);
  });

  it('counts overdue tasks (non-done tasks with a past dueDate)', () => {
    taskService.create(
      makeTask({ status: 'todo', dueDate: '2000-01-01T00:00:00.000Z' }) // past
    );
    taskService.create(
      makeTask({ status: 'in_progress', dueDate: '2000-06-01T00:00:00.000Z' }) // past
    );
    taskService.create(
      makeTask({ status: 'done', dueDate: '2000-01-01T00:00:00.000Z' }) // done → not overdue
    );

    const stats = taskService.getStats();
    expect(stats.overdue).toBe(2);
  });

  it('does not count future-dated tasks as overdue', () => {
    taskService.create(
      makeTask({ status: 'todo', dueDate: '2999-01-01T00:00:00.000Z' })
    );
    expect(taskService.getStats().overdue).toBe(0);
  });

  it('does not count tasks without a dueDate as overdue', () => {
    taskService.create(makeTask({ status: 'todo', dueDate: null }));
    expect(taskService.getStats().overdue).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// create
// ─────────────────────────────────────────────────────────────────────────────
describe('create', () => {
  it('returns a task with a generated uuid id', () => {
    const task = taskService.create(makeTask());
    expect(task.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('persists the task so getAll returns it', () => {
    taskService.create(makeTask({ title: 'Persist me' }));
    expect(taskService.getAll()[0].title).toBe('Persist me');
  });

  it('sets default status to todo', () => {
    const task = taskService.create({ title: 'Defaults' });
    expect(task.status).toBe('todo');
  });

  it('sets default priority to medium', () => {
    const task = taskService.create({ title: 'Defaults' });
    expect(task.priority).toBe('medium');
  });

  it('sets default description to empty string', () => {
    const task = taskService.create({ title: 'Defaults' });
    expect(task.description).toBe('');
  });

  it('sets default dueDate to null', () => {
    const task = taskService.create({ title: 'Defaults' });
    expect(task.dueDate).toBeNull();
  });

  it('sets completedAt to null on creation', () => {
    const task = taskService.create(makeTask());
    expect(task.completedAt).toBeNull();
  });

  it('sets createdAt as a valid ISO string', () => {
    const task = taskService.create(makeTask());
    expect(() => new Date(task.createdAt)).not.toThrow();
    expect(new Date(task.createdAt).toISOString()).toBe(task.createdAt);
  });

  it('accepts and stores custom status, priority, dueDate', () => {
    const task = taskService.create(
      makeTask({ status: 'in_progress', priority: 'high', dueDate: '2025-12-31' })
    );
    expect(task.status).toBe('in_progress');
    expect(task.priority).toBe('high');
    expect(task.dueDate).toBe('2025-12-31');
  });

  it('generates unique ids for each task', () => {
    const a = taskService.create(makeTask());
    const b = taskService.create(makeTask());
    expect(a.id).not.toBe(b.id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// update
// ─────────────────────────────────────────────────────────────────────────────
describe('update', () => {
  let existingTask;

  beforeEach(() => {
    existingTask = taskService.create(makeTask({ title: 'Original' }));
  });

  it('returns null for a non-existent id', () => {
    expect(taskService.update('00000000-0000-0000-0000-000000000000', { title: 'X' })).toBeNull();
  });

  it('updates the title field', () => {
    const updated = taskService.update(existingTask.id, { title: 'Updated' });
    expect(updated.title).toBe('Updated');
  });

  it('updates the status field', () => {
    const updated = taskService.update(existingTask.id, { status: 'done' });
    expect(updated.status).toBe('done');
  });

  it('merges fields rather than replacing the whole task', () => {
    const updated = taskService.update(existingTask.id, { status: 'in_progress' });
    expect(updated.title).toBe('Original'); // title preserved
    expect(updated.status).toBe('in_progress');
  });

  it('persists the update so subsequent calls return updated data', () => {
    taskService.update(existingTask.id, { title: 'Persisted' });
    expect(taskService.findById(existingTask.id).title).toBe('Persisted');
  });

  it('returns the updated task object', () => {
    const result = taskService.update(existingTask.id, { priority: 'low' });
    expect(result).not.toBeNull();
    expect(result.priority).toBe('low');
  });

  it('returns null for empty string id', () => {
    expect(taskService.update('', { title: 'X' })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// remove
// ─────────────────────────────────────────────────────────────────────────────
describe('remove', () => {
  let existingTask;

  beforeEach(() => {
    existingTask = taskService.create(makeTask());
  });

  it('returns true when a task is successfully removed', () => {
    expect(taskService.remove(existingTask.id)).toBe(true);
  });

  it('removes the task from storage', () => {
    taskService.remove(existingTask.id);
    expect(taskService.findById(existingTask.id)).toBeUndefined();
    expect(taskService.getAll()).toHaveLength(0);
  });

  it('returns false for a non-existent id', () => {
    expect(taskService.remove('00000000-0000-0000-0000-000000000000')).toBe(false);
  });

  it('returns false for an empty string id', () => {
    expect(taskService.remove('')).toBe(false);
  });

  it('only removes the targeted task, leaving others intact', () => {
    const second = taskService.create(makeTask({ title: 'Keep me' }));
    taskService.remove(existingTask.id);
    expect(taskService.getAll()).toHaveLength(1);
    expect(taskService.findById(second.id)).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// completeTask
// ─────────────────────────────────────────────────────────────────────────────
describe('completeTask', () => {
  let existingTask;

  beforeEach(() => {
    existingTask = taskService.create(makeTask({ priority: 'high' }));
  });

  it('returns null for a non-existent id', () => {
    expect(taskService.completeTask('00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('sets status to done', () => {
    const result = taskService.completeTask(existingTask.id);
    expect(result.status).toBe('done');
  });

  it('sets completedAt to a valid ISO string', () => {
    const result = taskService.completeTask(existingTask.id);
    expect(result.completedAt).not.toBeNull();
    expect(new Date(result.completedAt).toISOString()).toBe(result.completedAt);
  });

  it('persists the completion so subsequent findById reflects it', () => {
    taskService.completeTask(existingTask.id);
    const found = taskService.findById(existingTask.id);
    expect(found.status).toBe('done');
    expect(found.completedAt).not.toBeNull();
  });

  it('FIXED: completeTask preserves original priority (no longer resets to medium)', () => {
    const result = taskService.completeTask(existingTask.id);
    expect(result.priority).toBe('high'); // original priority preserved
  });

  it('returns null for empty string id', () => {
    expect(taskService.completeTask('')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// _reset
// ─────────────────────────────────────────────────────────────────────────────
describe('_reset', () => {
  it('clears all tasks', () => {
    taskService.create(makeTask());
    taskService.create(makeTask());
    taskService._reset();
    expect(taskService.getAll()).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// assignTask
// ─────────────────────────────────────────────────────────────────────────────
describe('assignTask', () => {
  let existingTask;

  beforeEach(() => {
    existingTask = taskService.create(makeTask({ title: 'Assignable task', priority: 'high' }));
  });

  // ── Happy paths ─────────────────────────────────────────────────────────────
  it('returns the updated task with the new assignee', () => {
    const result = taskService.assignTask(existingTask.id, 'alice@example.com');
    expect(result).not.toBeNull();
    expect(result.assignee).toBe('alice@example.com');
  });

  it('persists the assignee so subsequent findById reflects it', () => {
    taskService.assignTask(existingTask.id, 'bob');
    const found = taskService.findById(existingTask.id);
    expect(found.assignee).toBe('bob');
  });

  it('reassigning an already-assigned task updates the assignee', () => {
    taskService.assignTask(existingTask.id, 'alice');
    const result = taskService.assignTask(existingTask.id, 'charlie');
    expect(result.assignee).toBe('charlie');
  });

  it('does not mutate other fields when assigning', () => {
    const result = taskService.assignTask(existingTask.id, 'diana');
    expect(result.title).toBe('Assignable task');
    expect(result.priority).toBe('high');
    expect(result.status).toBe('todo');
    expect(result.id).toBe(existingTask.id);
  });

  it('new tasks start with assignee: null', () => {
    const task = taskService.create(makeTask());
    expect(task.assignee).toBeNull();
  });

  it('assignee field is present in getAll() results after assignment', () => {
    taskService.assignTask(existingTask.id, 'eve');
    const all = taskService.getAll();
    expect(all[0].assignee).toBe('eve');
  });

  // ── Error cases ──────────────────────────────────────────────────────────────
  it('returns null for a non-existent id', () => {
    expect(taskService.assignTask('00000000-0000-0000-0000-000000000000', 'ghost')).toBeNull();
  });

  it('returns null for an empty string id', () => {
    expect(taskService.assignTask('', 'nobody')).toBeNull();
  });

  it('returns null when tasks list is empty', () => {
    taskService._reset();
    expect(taskService.assignTask(existingTask.id, 'orphan')).toBeNull();
  });
});
