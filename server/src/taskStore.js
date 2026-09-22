import { randomUUID } from 'crypto';

/**
 * ValidationError is thrown when task input data fails validation.
 * Routes catch this and respond with HTTP 400.
 */
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;

function validateTitle(title) {
  if (typeof title !== 'string' || title.trim().length === 0) {
    throw new ValidationError('Title is required and must be a non-empty string.');
  }
  if (title.trim().length > MAX_TITLE_LENGTH) {
    throw new ValidationError(`Title must be ${MAX_TITLE_LENGTH} characters or fewer.`);
  }
}

function validateDescription(description) {
  if (description === undefined || description === null) return;
  if (typeof description !== 'string') {
    throw new ValidationError('Description must be a string.');
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new ValidationError(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`);
  }
}

/**
 * TaskStore is an in-memory repository of tasks. Kept dependency-free so it is
 * trivial to unit test and to swap for a real database later without touching
 * the route layer (routes only call these methods).
 */
export class TaskStore {
  constructor() {
    this.reset();
  }

  reset() {
    this.tasks = new Map();
  }

  list({ status } = {}) {
    const all = Array.from(this.tasks.values());
    if (status === 'active') return all.filter((t) => !t.completed);
    if (status === 'completed') return all.filter((t) => t.completed);
    return all;
  }

  getById(id) {
    return this.tasks.get(id) ?? null;
  }

  create({ title, description = '' }) {
    validateTitle(title);
    validateDescription(description);

    const now = new Date().toISOString();
    const task = {
      id: randomUUID(),
      title: title.trim(),
      description: description ? description.trim() : '',
      completed: false,
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(task.id, task);
    return task;
  }

  update(id, updates) {
    const existing = this.tasks.get(id);
    if (!existing) return null;

    if (updates.title !== undefined) validateTitle(updates.title);
    if (updates.description !== undefined) validateDescription(updates.description);
    if (updates.completed !== undefined && typeof updates.completed !== 'boolean') {
      throw new ValidationError('Completed must be a boolean.');
    }

    const updated = {
      ...existing,
      ...(updates.title !== undefined ? { title: updates.title.trim() } : {}),
      ...(updates.description !== undefined ? { description: (updates.description ?? '').trim() } : {}),
      ...(updates.completed !== undefined ? { completed: updates.completed } : {}),
      updatedAt: new Date().toISOString(),
    };
    this.tasks.set(id, updated);
    return updated;
  }

  toggle(id) {
    const existing = this.tasks.get(id);
    if (!existing) return null;
    return this.update(id, { completed: !existing.completed });
  }

  remove(id) {
    return this.tasks.delete(id);
  }

  count() {
    return this.tasks.size;
  }
}

// A shared singleton used by the running server. Tests create their own
// isolated TaskStore instances instead of relying on this one.
export const taskStore = new TaskStore();
