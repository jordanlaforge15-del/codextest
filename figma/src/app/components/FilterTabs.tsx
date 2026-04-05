import { RenderState } from './RenderTile';
import { SidebarItem } from './SidebarItem';

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
    { id: 'no', label: 'No' }
  ];

  return (
    <nav aria-label="Render filters" className="border-b border-gray-200">
      <div className="flex gap-1">
        {tabs.map((tab) => (
          <SidebarItem
            key={tab.id}
            active={activeFilter === tab.id}
            count={counts[tab.id]}
            label={tab.label}
            onClick={() => onFilterChange(tab.id)}
          />
        ))}
      </div>
    </nav>
  );
}
