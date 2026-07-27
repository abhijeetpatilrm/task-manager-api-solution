const VALID_STATUSES = ['todo', 'in_progress', 'done'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];

const validateCreateTask = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Request body must be a valid JSON object';
  }
  if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
    return 'title is required and must be a non-empty string';
  }
  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return `status must be one of: ${VALID_STATUSES.join(', ')}`;
  }
  if (body.priority && !VALID_PRIORITIES.includes(body.priority)) {
    return `priority must be one of: ${VALID_PRIORITIES.join(', ')}`;
  }
  if (body.dueDate != null && isNaN(Date.parse(body.dueDate))) {
    return 'dueDate must be a valid ISO date string';
  }
  return null;
};

const validateUpdateTask = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Request body must be a valid JSON object';
  }
  if (body.title !== undefined && (typeof body.title !== 'string' || body.title.trim() === '')) {
    return 'title must be a non-empty string';
  }
  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return `status must be one of: ${VALID_STATUSES.join(', ')}`;
  }
  if (body.priority && !VALID_PRIORITIES.includes(body.priority)) {
    return `priority must be one of: ${VALID_PRIORITIES.join(', ')}`;
  }
  if (body.dueDate != null && isNaN(Date.parse(body.dueDate))) {
    return 'dueDate must be a valid ISO date string';
  }
  return null;
};

const MAX_ASSIGNEE_LENGTH = 100;

const validateAssignee = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Request body must be a valid JSON object';
  }
  if (body.assignee === undefined || body.assignee === null) {
    return 'assignee is required';
  }
  if (typeof body.assignee !== 'string') {
    return 'assignee must be a string';
  }
  if (body.assignee.trim().length === 0) {
    return 'assignee must not be empty or whitespace';
  }
  if (body.assignee.length > MAX_ASSIGNEE_LENGTH) {
    return `assignee must not exceed ${MAX_ASSIGNEE_LENGTH} characters`;
  }
  return null;
};

module.exports = { validateCreateTask, validateUpdateTask, validateAssignee };
