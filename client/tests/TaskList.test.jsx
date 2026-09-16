import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import TaskList from '../src/components/TaskList.jsx';

const tasks = [
  { id: '1', title: 'First task', description: '', completed: false },
  { id: '2', title: 'Second task', description: 'with details', completed: true },
];

describe('TaskList', () => {
  test('shows an empty state when there are no tasks', () => {
    render(<TaskList tasks={[]} onToggle={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  test('renders each task', () => {
    render(<TaskList tasks={tasks} onToggle={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getAllByTestId('task-item')).toHaveLength(2);
    expect(screen.getByText('First task')).toBeInTheDocument();
    expect(screen.getByText('with details')).toBeInTheDocument();
  });

  test('calls onToggle when the checkbox is clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<TaskList tasks={tasks} onToggle={onToggle} onDelete={vi.fn()} />);

    await user.click(screen.getAllByTestId('task-toggle')[0]);
    expect(onToggle).toHaveBeenCalledWith('1');
  });

  test('calls onDelete when the delete button is clicked', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<TaskList tasks={tasks} onToggle={vi.fn()} onDelete={onDelete} />);

    await user.click(screen.getAllByTestId('delete-task-button')[1]);
    expect(onDelete).toHaveBeenCalledWith('2');
  });
});
