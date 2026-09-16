export default function TaskItem({ task, onToggle, onDelete }) {
  return (
    <li className={`task-item ${task.completed ? 'completed' : ''}`} data-testid="task-item">
      <label>
        <input
          type="checkbox"
          checked={task.completed}
          onChange={() => onToggle(task.id)}
          aria-label={`Mark "${task.title}" as ${task.completed ? 'active' : 'complete'}`}
          data-testid="task-toggle"
        />
        <span className="task-title" data-testid="task-title">
          {task.title}
        </span>
      </label>
      {task.description && <p className="task-description">{task.description}</p>}
      <button
        type="button"
        className="delete-button"
        onClick={() => onDelete(task.id)}
        aria-label={`Delete "${task.title}"`}
        data-testid="delete-task-button"
      >
        Delete
      </button>
    </li>
  );
}
