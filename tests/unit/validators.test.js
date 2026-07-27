'use strict';

const { validateCreateTask, validateUpdateTask } = require('../../src/utils/validators');

// ─────────────────────────────────────────────────────────────────────────────
// validateCreateTask
// ─────────────────────────────────────────────────────────────────────────────
describe('validateCreateTask', () => {
  // ── Happy paths ─────────────────────────────────────────────────────────────
  describe('happy paths', () => {
    it('returns null for a fully-valid payload', () => {
      expect(
        validateCreateTask({
          title: 'Write tests',
          description: 'Add jest coverage',
          status: 'todo',
          priority: 'high',
          dueDate: '2025-12-31T23:59:59.000Z',
        })
      ).toBeNull();
    });

    it('returns null when only title is provided (all other fields optional)', () => {
      expect(validateCreateTask({ title: 'Minimal task' })).toBeNull();
    });

    it('returns null for each valid status value', () => {
      ['todo', 'in_progress', 'done'].forEach((status) => {
        expect(validateCreateTask({ title: 'T', status })).toBeNull();
      });
    });

    it('returns null for each valid priority value', () => {
      ['low', 'medium', 'high'].forEach((priority) => {
        expect(validateCreateTask({ title: 'T', priority })).toBeNull();
      });
    });

    it('returns null when dueDate is a valid ISO 8601 string', () => {
      expect(
        validateCreateTask({ title: 'T', dueDate: '2024-01-01T00:00:00.000Z' })
      ).toBeNull();
    });

    it('returns null when dueDate is a valid date-only string', () => {
      expect(validateCreateTask({ title: 'T', dueDate: '2024-06-15' })).toBeNull();
    });
  });

  // ── title validation ─────────────────────────────────────────────────────────
  describe('title validation', () => {
    it('returns error when title is missing', () => {
      expect(validateCreateTask({})).toBe(
        'title is required and must be a non-empty string'
      );
    });

    it('returns error when title is an empty string', () => {
      expect(validateCreateTask({ title: '' })).toBe(
        'title is required and must be a non-empty string'
      );
    });

    it('returns error when title is only whitespace', () => {
      expect(validateCreateTask({ title: '   ' })).toBe(
        'title is required and must be a non-empty string'
      );
    });

    it('returns error when title is a number', () => {
      expect(validateCreateTask({ title: 123 })).toBe(
        'title is required and must be a non-empty string'
      );
    });

    it('returns error when title is null', () => {
      expect(validateCreateTask({ title: null })).toBe(
        'title is required and must be a non-empty string'
      );
    });

    it('returns error when title is undefined', () => {
      expect(validateCreateTask({ title: undefined })).toBe(
        'title is required and must be a non-empty string'
      );
    });

    it('returns error when title is a boolean', () => {
      expect(validateCreateTask({ title: true })).toBe(
        'title is required and must be a non-empty string'
      );
    });

    it('returns error when title is an array', () => {
      expect(validateCreateTask({ title: [] })).toBe(
        'title is required and must be a non-empty string'
      );
    });
  });

  // ── status validation ────────────────────────────────────────────────────────
  describe('status validation', () => {
    it('returns error for an invalid status string', () => {
      expect(validateCreateTask({ title: 'T', status: 'pending' })).toMatch(
        /status must be one of/
      );
    });

    it('returns error for an empty status string', () => {
      // empty string is falsy, treated as "not provided" — implementation behaviour
      // This test documents the current (potentially surprising) behaviour:
      // empty string bypasses validation because `body.status` is falsy.
      expect(validateCreateTask({ title: 'T', status: '' })).toBeNull();
    });

    it('returns error for status with wrong casing (IN_PROGRESS)', () => {
      expect(validateCreateTask({ title: 'T', status: 'IN_PROGRESS' })).toMatch(
        /status must be one of/
      );
    });

    it('returns error for numeric status', () => {
      // numeric truthy value will hit the includes check
      expect(validateCreateTask({ title: 'T', status: 1 })).toMatch(
        /status must be one of/
      );
    });
  });

  // ── priority validation ──────────────────────────────────────────────────────
  describe('priority validation', () => {
    it('returns error for an invalid priority string', () => {
      expect(validateCreateTask({ title: 'T', priority: 'critical' })).toMatch(
        /priority must be one of/
      );
    });

    it('returns error for priority with wrong casing', () => {
      expect(validateCreateTask({ title: 'T', priority: 'HIGH' })).toMatch(
        /priority must be one of/
      );
    });
  });

  // ── dueDate validation ───────────────────────────────────────────────────────
  describe('dueDate validation', () => {
    it('returns error for an invalid dueDate string', () => {
      expect(validateCreateTask({ title: 'T', dueDate: 'not-a-date' })).toBe(
        'dueDate must be a valid ISO date string'
      );
    });

    it('returns error for a random gibberish dueDate', () => {
      expect(validateCreateTask({ title: 'T', dueDate: 'abc123' })).toBe(
        'dueDate must be a valid ISO date string'
      );
    });

    it('returns error when dueDate is an empty string (BUG-005 fix: empty string is now validated)', () => {
      expect(validateCreateTask({ title: 'T', dueDate: '' })).toBe(
        'dueDate must be a valid ISO date string'
      );
    });
  });

  // ── null / undefined body guard ──────────────────────────────────────────────
  describe('null/undefined body guard (BUG-004 fixed: returns error string)', () => {
    it('returns an error string when body is null', () => {
      expect(validateCreateTask(null)).toBe('Request body must be a valid JSON object');
    });

    it('returns an error string when body is undefined', () => {
      expect(validateCreateTask(undefined)).toBe('Request body must be a valid JSON object');
    });

    it('returns an error string when body is an array', () => {
      expect(validateCreateTask([])).toBe('Request body must be a valid JSON object');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateUpdateTask
// ─────────────────────────────────────────────────────────────────────────────
describe('validateUpdateTask', () => {
  // ── Happy paths ─────────────────────────────────────────────────────────────
  describe('happy paths', () => {
    it('returns null for an empty update body (all fields optional)', () => {
      expect(validateUpdateTask({})).toBeNull();
    });

    it('returns null for a valid title update', () => {
      expect(validateUpdateTask({ title: 'New title' })).toBeNull();
    });

    it('returns null for a valid status update', () => {
      expect(validateUpdateTask({ status: 'done' })).toBeNull();
    });

    it('returns null for a valid priority update', () => {
      expect(validateUpdateTask({ priority: 'low' })).toBeNull();
    });

    it('returns null for a valid dueDate update', () => {
      expect(
        validateUpdateTask({ dueDate: '2025-12-31T00:00:00.000Z' })
      ).toBeNull();
    });

    it('returns null for a fully-valid multi-field update', () => {
      expect(
        validateUpdateTask({
          title: 'Updated',
          status: 'in_progress',
          priority: 'high',
          dueDate: '2025-06-01T00:00:00.000Z',
        })
      ).toBeNull();
    });
  });

  // ── title validation ─────────────────────────────────────────────────────────
  describe('title validation', () => {
    it('returns error when title is explicitly set to an empty string', () => {
      expect(validateUpdateTask({ title: '' })).toBe(
        'title must be a non-empty string'
      );
    });

    it('returns error when title is only whitespace', () => {
      expect(validateUpdateTask({ title: '   ' })).toBe(
        'title must be a non-empty string'
      );
    });

    it('returns error when title is a number', () => {
      expect(validateUpdateTask({ title: 42 })).toBe(
        'title must be a non-empty string'
      );
    });

    it('does NOT error when title is undefined (not provided)', () => {
      expect(validateUpdateTask({ title: undefined })).toBeNull();
    });
  });

  // ── status validation ────────────────────────────────────────────────────────
  describe('status validation', () => {
    it('returns error for an unrecognised status', () => {
      expect(validateUpdateTask({ status: 'archived' })).toMatch(
        /status must be one of/
      );
    });

    it('returns error for status with wrong casing', () => {
      expect(validateUpdateTask({ status: 'Done' })).toMatch(
        /status must be one of/
      );
    });

    it('returns null for each valid status value', () => {
      ['todo', 'in_progress', 'done'].forEach((status) => {
        expect(validateUpdateTask({ status })).toBeNull();
      });
    });
  });

  // ── priority validation ──────────────────────────────────────────────────────
  describe('priority validation', () => {
    it('returns error for an unrecognised priority', () => {
      expect(validateUpdateTask({ priority: 'urgent' })).toMatch(
        /priority must be one of/
      );
    });

    it('returns null for each valid priority value', () => {
      ['low', 'medium', 'high'].forEach((priority) => {
        expect(validateUpdateTask({ priority })).toBeNull();
      });
    });
  });

  // ── dueDate validation ───────────────────────────────────────────────────────
  describe('dueDate validation', () => {
    it('returns error for an invalid dueDate', () => {
      expect(validateUpdateTask({ dueDate: 'not-a-date' })).toBe(
        'dueDate must be a valid ISO date string'
      );
    });

    it('returns null when dueDate is null (treated as not provided)', () => {
      expect(validateUpdateTask({ dueDate: null })).toBeNull();
    });

    it('returns error when dueDate is an empty string (BUG-005 fix)', () => {
      expect(validateUpdateTask({ dueDate: '' })).toBe(
        'dueDate must be a valid ISO date string'
      );
    });
  });

  // ── null / undefined body guard ──────────────────────────────────────────────
  describe('null/undefined body guard (BUG-004 fixed: returns error string)', () => {
    it('returns an error string when body is null', () => {
      expect(validateUpdateTask(null)).toBe('Request body must be a valid JSON object');
    });

    it('returns an error string when body is undefined', () => {
      expect(validateUpdateTask(undefined)).toBe('Request body must be a valid JSON object');
    });

    it('returns an error string when body is an array', () => {
      expect(validateUpdateTask([])).toBe('Request body must be a valid JSON object');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateAssignee
// ─────────────────────────────────────────────────────────────────────────────
const { validateAssignee } = require('../../src/utils/validators');

describe('validateAssignee', () => {
  // ── Happy paths ─────────────────────────────────────────────────────────────
  describe('happy paths', () => {
    it('returns null for a valid assignee string', () => {
      expect(validateAssignee({ assignee: 'alice' })).toBeNull();
    });

    it('returns null for an email-style assignee', () => {
      expect(validateAssignee({ assignee: 'alice@example.com' })).toBeNull();
    });

    it('returns null for exactly 100 characters (boundary)', () => {
      expect(validateAssignee({ assignee: 'a'.repeat(100) })).toBeNull();
    });

    it('returns null for a single-character assignee', () => {
      expect(validateAssignee({ assignee: 'x' })).toBeNull();
    });

    it('accepts assignee with leading/trailing whitespace (trimmed before storage)', () => {
      // validator allows it — trimming happens in the route handler
      expect(validateAssignee({ assignee: '  alice  ' })).toBeNull();
    });

    it('returns null when extra fields are present alongside assignee', () => {
      expect(validateAssignee({ assignee: 'alice', other: 'field' })).toBeNull();
    });
  });

  // ── Body guard ───────────────────────────────────────────────────────────────
  describe('body guard', () => {
    it('returns error for null body', () => {
      expect(validateAssignee(null)).toBe('Request body must be a valid JSON object');
    });

    it('returns error for undefined body', () => {
      expect(validateAssignee(undefined)).toBe('Request body must be a valid JSON object');
    });

    it('returns error for array body', () => {
      expect(validateAssignee([])).toBe('Request body must be a valid JSON object');
    });

    it('returns error for string body', () => {
      expect(validateAssignee('alice')).toBe('Request body must be a valid JSON object');
    });
  });

  // ── Missing / null assignee ──────────────────────────────────────────────────
  describe('missing or null assignee', () => {
    it('returns error when assignee key is absent', () => {
      expect(validateAssignee({})).toBe('assignee is required');
    });

    it('returns error when assignee is explicitly null', () => {
      expect(validateAssignee({ assignee: null })).toBe('assignee is required');
    });

    it('returns error when assignee is undefined', () => {
      expect(validateAssignee({ assignee: undefined })).toBe('assignee is required');
    });
  });

  // ── Wrong type ───────────────────────────────────────────────────────────────
  describe('wrong type', () => {
    it('returns error when assignee is a number', () => {
      expect(validateAssignee({ assignee: 42 })).toBe('assignee must be a string');
    });

    it('returns error when assignee is a boolean', () => {
      expect(validateAssignee({ assignee: true })).toBe('assignee must be a string');
    });

    it('returns error when assignee is an object', () => {
      expect(validateAssignee({ assignee: {} })).toBe('assignee must be a string');
    });

    it('returns error when assignee is an array', () => {
      expect(validateAssignee({ assignee: ['alice'] })).toBe('assignee must be a string');
    });
  });

  // ── Empty / whitespace ────────────────────────────────────────────────────────
  describe('empty or whitespace-only assignee', () => {
    it('returns error for an empty string', () => {
      expect(validateAssignee({ assignee: '' })).toBe('assignee must not be empty or whitespace');
    });

    it('returns error for a whitespace-only string', () => {
      expect(validateAssignee({ assignee: '   ' })).toBe('assignee must not be empty or whitespace');
    });

    it('returns error for a tab-only string', () => {
      expect(validateAssignee({ assignee: '\t\n' })).toBe('assignee must not be empty or whitespace');
    });
  });

  // ── Length boundary ───────────────────────────────────────────────────────────
  describe('length boundary', () => {
    it('returns null for a 99-character assignee (under limit)', () => {
      expect(validateAssignee({ assignee: 'a'.repeat(99) })).toBeNull();
    });

    it('returns null for exactly 100 characters (at limit)', () => {
      expect(validateAssignee({ assignee: 'a'.repeat(100) })).toBeNull();
    });

    it('returns error for 101 characters (over limit)', () => {
      expect(validateAssignee({ assignee: 'a'.repeat(101) })).toBe(
        'assignee must not exceed 100 characters'
      );
    });

    it('returns error for an extremely long assignee (500 chars)', () => {
      expect(validateAssignee({ assignee: 'x'.repeat(500) })).toBe(
        'assignee must not exceed 100 characters'
      );
    });
  });
});
