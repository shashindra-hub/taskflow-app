import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import TaskForm from './components/TaskForm.jsx';
import TaskList from './components/TaskList.jsx';
import FilterBar from './components/FilterBar.jsx';
import './App.css';

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const loadTasks = useCallback(async (status) => {
    setLoading(true);
    setError('');
    try {
      const result = await api.listTasks(status === 'all' ? undefined : status);
      setTasks(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks(filter);
  }, [filter, loadTasks]);

  async function handleAdd({ title, description }) {
    const created = await api.createTask({ title, description });
    if (filter === 'all' || filter === 'active') {
      setTasks((prev) => [...prev, created]);
    }
  }

  // If a filter is active, a toggled task may need to leave the list.
  function visibleOnly(list) {
    if (filter === 'all') return list;
    return list.filter((t) => (filter === 'active' ? !t.completed : t.completed));
  }

  async function handleToggle(id) {
    setActionError('');
    const previous = tasks;
    // Flip it right away so the checkbox responds to the click (a controlled
    // checkbox otherwise snaps back until the server answers), then confirm.
    setTasks(visibleOnly(tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))));
    try {
      const updated = await api.toggleTask(id);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (err) {
      setTasks(previous);
      setActionError(err.message);
    }
  }

  async function handleDelete(id) {
    setActionError('');
    try {
      await api.deleteTask(id);
    } catch (err) {
      setActionError(err.message);
      return;
    }
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const activeCount = tasks.filter((t) => !t.completed).length;

  return (
    <div className="app">
      <header>
        <h1>TaskFlow</h1>
        <p className="subtitle">A small, fully tested task manager</p>
      </header>

      <main>
        <TaskForm onAdd={handleAdd} />
        <FilterBar current={filter} onChange={setFilter} />

        {loading && <p data-testid="loading">Loading tasks…</p>}
        {error && (
          <p className="error" role="alert" data-testid="load-error">
            {error}
          </p>
        )}
        {actionError && (
          <p className="error" role="alert" data-testid="action-error">
            {actionError}
          </p>
        )}
        {!loading && !error && (
          <TaskList tasks={tasks} onToggle={handleToggle} onDelete={handleDelete} />
        )}
      </main>

      <footer>
        <span data-testid="active-count">{activeCount} task(s) remaining</span>
      </footer>
    </div>
  );
}
