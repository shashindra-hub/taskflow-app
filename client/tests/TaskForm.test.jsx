import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import TaskForm from '../src/components/TaskForm.jsx';

describe('TaskForm', () => {
  test('calls onAdd with title and description, then clears the fields', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue({});
    render(<TaskForm onAdd={onAdd} />);

    await user.type(screen.getByTestId('task-title-input'), 'Buy milk');
    await user.type(screen.getByTestId('task-description-input'), '2%');
    await user.click(screen.getByTestId('add-task-button'));

    expect(onAdd).toHaveBeenCalledWith({ title: 'Buy milk', description: '2%' });
    expect(screen.getByTestId('task-title-input')).toHaveValue('');
    expect(screen.getByTestId('task-description-input')).toHaveValue('');
  });

  test('shows a validation error and does not call onAdd when title is empty', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<TaskForm onAdd={onAdd} />);

    await user.click(screen.getByTestId('add-task-button'));

    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByTestId('form-error')).toHaveTextContent(/title is required/i);
  });

  test('surfaces an error thrown by onAdd', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockRejectedValue(new Error('Server exploded'));
    render(<TaskForm onAdd={onAdd} />);

    await user.type(screen.getByTestId('task-title-input'), 'Anything');
    await user.click(screen.getByTestId('add-task-button'));

    expect(await screen.findByTestId('form-error')).toHaveTextContent('Server exploded');
  });
});
