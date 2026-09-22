import { TaskStore, ValidationError } from '../src/taskStore.js';

describe('TaskStore', () => {
  let store;

  beforeEach(() => {
    store = new TaskStore();
  });

  describe('create', () => {
    test('creates a task with defaults', () => {
      const task = store.create({ title: 'Write tests' });
      expect(task).toMatchObject({
        title: 'Write tests',
        description: '',
        completed: false,
      });
      expect(task.id).toBeDefined();
      expect(task.createdAt).toBeDefined();
    });

    test('trims whitespace from title and description', () => {
      const task = store.create({ title: '  Buy milk  ', description: '  2%  ' });
      expect(task.title).toBe('Buy milk');
      expect(task.description).toBe('2%');
    });

    test('rejects an empty title', () => {
      expect(() => store.create({ title: '' })).toThrow(ValidationError);
      expect(() => store.create({ title: '   ' })).toThrow(ValidationError);
    });

    test('rejects a missing title', () => {
      expect(() => store.create({})).toThrow(ValidationError);
    });

    test('rejects a title over the max length', () => {
      const longTitle = 'x'.repeat(201);
      expect(() => store.create({ title: longTitle })).toThrow(ValidationError);
    });

    test('rejects a non-string description', () => {
      expect(() => store.create({ title: 'ok', description: 42 })).toThrow(ValidationError);
    });
  });

  describe('list', () => {
    beforeEach(() => {
      const a = store.create({ title: 'A' });
      const b = store.create({ title: 'B' });
      store.create({ title: 'C' });
      store.toggle(a.id);
      store.toggle(b.id);
    });

    test('returns all tasks by default', () => {
      expect(store.list()).toHaveLength(3);
    });

    test('filters active tasks', () => {
      const active = store.list({ status: 'active' });
      expect(active).toHaveLength(1);
      expect(active[0].title).toBe('C');
    });

    test('filters completed tasks', () => {
      const completed = store.list({ status: 'completed' });
      expect(completed).toHaveLength(2);
      expect(completed.map((t) => t.title).sort()).toEqual(['A', 'B']);
    });
  });

  describe('getById', () => {
    test('returns the task when found', () => {
      const created = store.create({ title: 'Find me' });
      expect(store.getById(created.id)).toEqual(created);
    });

    test('returns null when not found', () => {
      expect(store.getById('does-not-exist')).toBeNull();
    });
  });

  describe('update', () => {
    test('updates provided fields only', async () => {
      const created = store.create({ title: 'Original' });
      const updated = store.update(created.id, { description: 'New description' });
      expect(updated.title).toBe('Original');
      expect(updated.description).toBe('New description');
      expect(updated.updatedAt).toBeDefined();
    });

    test('returns null for an unknown id', () => {
      expect(store.update('missing', { title: 'x' })).toBeNull();
    });

    test('validates updated title', () => {
      const created = store.create({ title: 'Original' });
      expect(() => store.update(created.id, { title: '' })).toThrow(ValidationError);
    });

    test('clears the description when given null', () => {
      const created = store.create({ title: 'Original', description: 'Old' });
      expect(store.update(created.id, { description: null }).description).toBe('');
    });

    test('rejects a non-boolean completed value', () => {
      const created = store.create({ title: 'Original' });
      expect(() => store.update(created.id, { completed: 'false' })).toThrow(ValidationError);
      expect(store.getById(created.id).completed).toBe(false);
    });
  });

  describe('toggle', () => {
    test('flips completed state', () => {
      const created = store.create({ title: 'Toggle me' });
      const toggled = store.toggle(created.id);
      expect(toggled.completed).toBe(true);
      const toggledAgain = store.toggle(created.id);
      expect(toggledAgain.completed).toBe(false);
    });

    test('returns null for an unknown id', () => {
      expect(store.toggle('missing')).toBeNull();
    });
  });

  describe('remove', () => {
    test('deletes an existing task and returns true', () => {
      const created = store.create({ title: 'Delete me' });
      expect(store.remove(created.id)).toBe(true);
      expect(store.getById(created.id)).toBeNull();
    });

    test('returns false for an unknown id', () => {
      expect(store.remove('missing')).toBe(false);
    });
  });

  describe('count', () => {
    test('tracks the number of tasks', () => {
      expect(store.count()).toBe(0);
      store.create({ title: 'One' });
      store.create({ title: 'Two' });
      expect(store.count()).toBe(2);
    });
  });
});
