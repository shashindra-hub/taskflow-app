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

  async function handleToggle(id) {
    const updated = await api.toggleTask(id);
    setTasks((prev) => {
      if (filter === 'all') {
        return prev.map((t) => (t.id === id ? updated : t));
      }
      // If a filter is active, a toggled task may need to leave the list.
      return prev
        .map((t) => (t.id === id ? updated : t))
        .filter((t) => (filter === 'active' ? !t.completed : t.completed));
    });
  }

  async function handleDelete(id) {
    await api.deleteTask(id);
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
