import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import FilterBar from '../src/components/FilterBar.jsx';

describe('FilterBar', () => {
  test('marks the current filter as active', () => {
    render(<FilterBar current="active" onChange={vi.fn()} />);
    expect(screen.getByTestId('filter-active')).toHaveClass('active');
    expect(screen.getByTestId('filter-all')).not.toHaveClass('active');
  });

  test('calls onChange with the clicked filter value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterBar current="all" onChange={onChange} />);

    await user.click(screen.getByTestId('filter-completed'));
    expect(onChange).toHaveBeenCalledWith('completed');
  });
});
