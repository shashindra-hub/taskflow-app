import express from 'express';
import cors from 'cors';
import { taskStore as defaultStore, ValidationError } from './taskStore.js';

/**
 * Builds an Express app. Accepts an optional store so unit/integration tests
 * can inject a fresh, isolated TaskStore instead of sharing global state.
 */
export function createApp(store = defaultStore) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/tasks', (req, res) => {
    const { status } = req.query;
    if (status !== undefined && !['active', 'completed'].includes(status)) {
      return res.status(400).json({ error: "status must be 'active' or 'completed'" });
    }
    res.json(store.list({ status }));
  });

  app.get('/api/tasks/:id', (req, res) => {
    const task = store.getById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  });

  app.post('/api/tasks', (req, res) => {
    try {
      const task = store.create(req.body ?? {});
      res.status(201).json(task);
    } catch (err) {
      if (err instanceof ValidationError) {
        return res.status(400).json({ error: err.message });
      }
      throw err;
    }
  });

  app.put('/api/tasks/:id', (req, res) => {
    try {
      const updated = store.update(req.params.id, req.body ?? {});
      if (!updated) return res.status(404).json({ error: 'Task not found' });
      res.json(updated);
    } catch (err) {
      if (err instanceof ValidationError) {
        return res.status(400).json({ error: err.message });
      }
      throw err;
    }
  });

  app.patch('/api/tasks/:id/toggle', (req, res) => {
    const updated = store.toggle(req.params.id);
    if (!updated) return res.status(404).json({ error: 'Task not found' });
    res.json(updated);
  });

  app.delete('/api/tasks/:id', (req, res) => {
    const existed = store.remove(req.params.id);
    if (!existed) return res.status(404).json({ error: 'Task not found' });
    res.status(204).send();
  });

  // Centralized error handler as a safety net for anything unexpected.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
