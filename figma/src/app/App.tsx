import { useState, useMemo } from 'react';
import { type Render, type RenderState } from './components/RenderTile';
import { EmptyState } from './components/EmptyState';
import { FilterTabs } from './components/FilterTabs';
import { RenderGrid } from './components/RenderGrid';
import { WorkspaceHeader } from './components/WorkspaceHeader';

// Mock data for renders
const initialRenders: Render[] = [
  {
    id: '1',
    imageUrl:
      'https://images.unsplash.com/photo-1705321963943-de94bb3f0dd3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBpbnRlcmlvciUyMGRlc2lnbiUyMGxpdmluZyUyMHJvb218ZW58MXx8fHwxNzc1MzgxNzkyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    label: 'Living Room A',
    state: 'maybe'
  },
  {
    id: '2',
    imageUrl:
      'https://images.unsplash.com/photo-1758548157243-f4ef3e614684?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb250ZW1wb3JhcnklMjBraXRjaGVuJTIwd2hpdGUlMjBtYXJibGV8ZW58MXx8fHwxNzc1NDIxNjUxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    label: 'Kitchen B',
    state: 'maybe'
  },
  {
    id: '3',
    imageUrl:
      'https://images.unsplash.com/photo-1610307522657-8c0304960189?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwYmVkcm9vbSUyMGRlc2lnbnxlbnwxfHx8fDE3NzU0MjE2NTF8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    label: 'Bedroom C',
    state: 'maybe'
  },
  {
    id: '4',
    imageUrl:
      'https://images.unsplash.com/photo-1623679072629-3aaa0192a391?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBvZmZpY2UlMjB3b3Jrc3BhY2UlMjBkZXNrfGVufDF8fHx8MTc3NTMzMzAyNnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    label: 'Office D',
    state: 'maybe'
  },
  {
    id: '5',
    imageUrl:
      'https://images.unsplash.com/photo-1625578324458-a106197ff141?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBiYXRocm9vbSUyMGludGVyaW9yfGVufDF8fHx8MTc3NTM2NTc4NXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    label: 'Bathroom E',
    state: 'maybe'
  },
  {
    id: '6',
    imageUrl:
      'https://images.unsplash.com/photo-1685644201646-9e836c398c92?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb250ZW1wb3JhcnklMjBkaW5pbmclMjByb29tfGVufDF8fHx8MTc3NTM3NTU3OXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    label: 'Dining Room F',
    state: 'maybe'
  },
  {
    id: '7',
    imageUrl:
      'https://images.unsplash.com/photo-1681216868987-b7268753b81c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBhcmNoaXRlY3R1cmUlMjBleHRlcmlvcnxlbnwxfHx8fDE3NzU0MjE2NTJ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    label: 'Exterior G',
    state: 'maybe'
  },
  {
    id: '8',
    imageUrl:
      'https://images.unsplash.com/photo-1724582586413-6b69e1c94a17?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzY2FuZGluYXZpYW4lMjBpbnRlcmlvciUyMGRlc2lnbnxlbnwxfHx8fDE3NzU0MjE2NTJ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    label: 'Lounge H',
    state: 'maybe'
  },
  {
    id: '9',
    imageUrl:
      'https://images.unsplash.com/photo-1658893136904-63914a6b372c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBsb3VuZ2UlMjBmdXJuaXR1cmV8ZW58MXx8fHwxNzc1NDIxNjUzfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    label: 'Furniture I',
    state: 'maybe'
  }
];

type FilterTab = 'all' | RenderState;

function App() {
  const [renders, setRenders] = useState<Render[]>(initialRenders);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [history, setHistory] = useState<Render[][]>([]);

  // Cycle through states: maybe -> yes -> no -> maybe
  const handleTileClick = (id: string) => {
    setRenders((prev) =>
      prev.map((render) => {
        if (render.id !== id) return render;

        const stateOrder: RenderState[] = ['maybe', 'yes', 'no'];
        const currentIndex = stateOrder.indexOf(render.state);
        const nextIndex = (currentIndex + 1) % stateOrder.length;

        return { ...render, state: stateOrder[nextIndex] };
      })
    );
  };

  // Filter renders based on active filter
  const filteredRenders = useMemo(() => {
    if (activeFilter === 'all') return renders;
    return renders.filter((render) => render.state === activeFilter);
  }, [renders, activeFilter]);

  // Calculate counts for each filter
  const counts = useMemo(() => {
    return {
      all: renders.length,
      yes: renders.filter((r) => r.state === 'yes').length,
      maybe: renders.filter((r) => r.state === 'maybe').length,
      no: renders.filter((r) => r.state === 'no').length
    };
  }, [renders]);

  const handleNarrowDown = () => {
    // Filter to keep only "yes" items
    const yesRenders = renders.filter((r) => r.state === 'yes');
    if (yesRenders.length > 0) {
      // Save current state to history
      setHistory((prev) => [...prev, renders]);
      setRenders(yesRenders.map((r) => ({ ...r, state: 'maybe' as RenderState })));
      setActiveFilter('all');
    }
  };

  const handleUndo = () => {
    if (history.length > 0) {
      // Get the last state from history
      const previousState = history[history.length - 1];
      setRenders(previousState);
      // Remove the last state from history
      setHistory((prev) => prev.slice(0, -1));
      setActiveFilter('all');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <WorkspaceHeader
        canUndo={history.length > 0}
        historyCount={history.length}
        selectedCount={counts.yes}
        onUndo={handleUndo}
        onNarrowDown={handleNarrowDown}
      />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <FilterTabs
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            counts={counts}
          />
        </div>

        {filteredRenders.length > 0 ? (
          <RenderGrid renders={filteredRenders} onTileClick={handleTileClick} />
        ) : (
          <EmptyState onReset={() => setActiveFilter('all')} />
        )}
      </main>
    </div>
  );
}

export default App;
