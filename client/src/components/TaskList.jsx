import TaskItem from './TaskItem.jsx';

export default function TaskList({ tasks, onToggle, onDelete }) {
  if (tasks.length === 0) {
    return (
      <p className="empty-state" data-testid="empty-state">
        No tasks here yet.
      </p>
    );
  }

  return (
    <ul className="task-list" data-testid="task-list">
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} />
      ))}
    </ul>
  );
}
