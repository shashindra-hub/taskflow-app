import request from 'supertest';
import { createApp } from '../src/app.js';
import { TaskStore } from '../src/taskStore.js';

// Each test gets a fresh app + store so tests never leak state into one another.
function makeApp() {
  const store = new TaskStore();
  return { app: createApp(store), store };
}

describe('GET /api/health', () => {
  test('returns ok status', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('POST /api/tasks', () => {
  test('creates a task and returns 201', async () => {
    const { app } = makeApp();
    const res = await request(app).post('/api/tasks').send({ title: 'Ship feature' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Ship feature', completed: false });
    expect(res.body.id).toBeDefined();
  });

  test('rejects a task with no title with 400', async () => {
    const { app } = makeApp();
    const res = await request(app).post('/api/tasks').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/i);
  });
});

describe('GET /api/tasks', () => {
  test('lists all tasks', async () => {
    const { app } = makeApp();
    await request(app).post('/api/tasks').send({ title: 'A' });
    await request(app).post('/api/tasks').send({ title: 'B' });

    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test('filters by status', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/tasks').send({ title: 'A' });
    await request(app).post('/api/tasks').send({ title: 'B' });
    await request(app).patch(`/api/tasks/${created.body.id}/toggle`);

    const completed = await request(app).get('/api/tasks?status=completed');
    expect(completed.body).toHaveLength(1);
    expect(completed.body[0].title).toBe('A');

    const active = await request(app).get('/api/tasks?status=active');
    expect(active.body).toHaveLength(1);
    expect(active.body[0].title).toBe('B');
  });

  test('rejects an invalid status filter', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/tasks?status=bogus');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/tasks/:id', () => {
  test('returns 404 for an unknown task', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/tasks/unknown-id');
    expect(res.status).toBe(404);
  });

  test('returns the task when found', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/tasks').send({ title: 'Findable' });
    const res = await request(app).get(`/api/tasks/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Findable');
  });
});

describe('PUT /api/tasks/:id', () => {
  test('updates an existing task', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/tasks').send({ title: 'Old title' });
    const res = await request(app)
      .put(`/api/tasks/${created.body.id}`)
      .send({ title: 'New title' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New title');
  });

  test('returns 404 for an unknown task', async () => {
    const { app } = makeApp();
    const res = await request(app).put('/api/tasks/unknown-id').send({ title: 'x' });
    expect(res.status).toBe(404);
  });

  test('returns 400 for invalid updates', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/tasks').send({ title: 'Valid' });
    const res = await request(app).put(`/api/tasks/${created.body.id}`).send({ title: '' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/tasks/:id/toggle', () => {
  test('toggles completion state', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/tasks').send({ title: 'Toggle' });
    const res = await request(app).patch(`/api/tasks/${created.body.id}/toggle`);
    expect(res.status).toBe(200);
    expect(res.body.completed).toBe(true);
  });

  test('returns 404 for an unknown task', async () => {
    const { app } = makeApp();
    const res = await request(app).patch('/api/tasks/unknown-id/toggle');
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/tasks/:id', () => {
  test('deletes an existing task', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/tasks').send({ title: 'Delete me' });
    const res = await request(app).delete(`/api/tasks/${created.body.id}`);
    expect(res.status).toBe(204);

    const getRes = await request(app).get(`/api/tasks/${created.body.id}`);
    expect(getRes.status).toBe(404);
  });

  test('returns 404 for an unknown task', async () => {
    const { app } = makeApp();
    const res = await request(app).delete('/api/tasks/unknown-id');
    expect(res.status).toBe(404);
  });
});
