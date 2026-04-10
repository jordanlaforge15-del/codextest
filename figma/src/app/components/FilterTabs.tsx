import { RenderState } from './RenderTile';

type FilterTab = 'all' | RenderState;

interface FilterTabsProps {
  activeFilter: FilterTab;
  onFilterChange: (filter: FilterTab) => void;
  counts: {
    all: number;
    yes: number;
    maybe: number;
    no: number;
  };
}

export function FilterTabs({ activeFilter, onFilterChange, counts }: FilterTabsProps) {
  const tabs: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'yes', label: 'Yes' },
    { id: 'maybe', label: 'Maybe' },
    { id: 'no', label: 'No' },
  ];

  return (
    <div className="flex gap-1 border-b border-gray-200">
      {tabs.map((tab) => {
        const isActive = activeFilter === tab.id;
        const count = counts[tab.id];

        return (
          <button
            key={tab.id}
            onClick={() => onFilterChange(tab.id)}
            className={`
              px-4 py-2.5 text-sm font-medium transition-colors relative
              ${
                isActive
                  ? 'text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }
            `}
          >
            {tab.label}
            <span className="ml-1.5 text-xs text-gray-400">({count})</span>
            {isActive && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
            )}
          </button>
        );
      })}
    </div>
  );
}
