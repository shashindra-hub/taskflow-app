const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
];

export default function FilterBar({ current, onChange }) {
  return (
    <div className="filter-bar" role="group" aria-label="Filter tasks" data-testid="filter-bar">
      {FILTERS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          className={current === value ? 'active' : ''}
          onClick={() => onChange(value)}
          data-testid={`filter-${value}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
