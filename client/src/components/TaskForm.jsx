import { useState } from 'react';

export default function TaskForm({ onAdd }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setError('');
    try {
      await onAdd({ title, description });
      setTitle('');
      setDescription('');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="task-form" onSubmit={handleSubmit} data-testid="task-form">
      <input
        type="text"
        placeholder="What needs to be done?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Task title"
        data-testid="task-title-input"
      />
      <input
        type="text"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        aria-label="Task description"
        data-testid="task-description-input"
      />
      <button type="submit" data-testid="add-task-button">
        Add task
      </button>
      {error && (
        <p className="error" role="alert" data-testid="form-error">
          {error}
        </p>
      )}
    </form>
  );
}
