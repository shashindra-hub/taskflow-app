import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import App from '../src/App.jsx';
import { api } from '../src/api.js';

vi.mock('../src/api.js', () => ({
  api: {
    listTasks: vi.fn(),
    createTask: vi.fn(),
    toggleTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
  },
}));

const sampleTasks = [
  { id: '1', title: 'Write report', description: '', completed: false },
  { id: '2', title: 'Review PR', description: '', completed: true },
];

describe('App', () => {
  beforeEach(() => {
    api.listTasks.mockResolvedValue(sampleTasks);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('loads and displays tasks on mount', async () => {
    render(<App />);

    expect(screen.getByTestId('loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByTestId('task-item')).toHaveLength(2));
    expect(api.listTasks).toHaveBeenCalledWith(undefined);
    expect(screen.getByTestId('active-count')).toHaveTextContent('1 task(s) remaining');
  });

  test('shows a load error when the API call fails', async () => {
    api.listTasks.mockRejectedValueOnce(new Error('Network down'));
    render(<App />);

    expect(await screen.findByTestId('load-error')).toHaveTextContent('Network down');
  });

  test('adding a task calls the API and appends it to the list', async () => {
    const user = userEvent.setup();
    const newTask = { id: '3', title: 'New task', description: '', completed: false };
    api.createTask.mockResolvedValue(newTask);
    render(<App />);

    await waitFor(() => expect(screen.getAllByTestId('task-item')).toHaveLength(2));

    await user.type(screen.getByTestId('task-title-input'), 'New task');
    await user.click(screen.getByTestId('add-task-button'));

    await waitFor(() => expect(screen.getAllByTestId('task-item')).toHaveLength(3));
    expect(api.createTask).toHaveBeenCalledWith({ title: 'New task', description: '' });
  });

  test('refetches with the status filter when a filter button is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(screen.getAllByTestId('task-item')).toHaveLength(2));

    api.listTasks.mockResolvedValue([sampleTasks[1]]);
    await user.click(screen.getByTestId('filter-completed'));

    await waitFor(() => expect(api.listTasks).toHaveBeenLastCalledWith('completed'));
  });

  test('deleting a task removes it from the list', async () => {
    const user = userEvent.setup();
    api.deleteTask.mockResolvedValue(null);
    render(<App />);
    await waitFor(() => expect(screen.getAllByTestId('task-item')).toHaveLength(2));

    await user.click(screen.getAllByTestId('delete-task-button')[0]);

    await waitFor(() => expect(screen.getAllByTestId('task-item')).toHaveLength(1));
    expect(api.deleteTask).toHaveBeenCalledWith('1');
  });
});
