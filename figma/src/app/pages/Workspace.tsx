import { useState, useMemo } from 'react';
import { Sparkles, Undo2, ChevronLeft } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { RenderTile, type Render, type RenderState } from '../components/RenderTile';
import { FilterTabs } from '../components/FilterTabs';
import { WorkspaceSidebar, type SidebarView } from '../components/WorkspaceSidebar';
import { type Item } from '../components/ItemTile';
import { type RenderJob, type RenderJobState } from '../components/RenderJobStatus';

// Mock data for renders
const initialRenders: Render[] = [
  {
    id: '1',
    imageUrl: 'https://images.unsplash.com/photo-1705321963943-de94bb3f0dd3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBpbnRlcmlvciUyMGRlc2lnbiUyMGxpdmluZyUyMHJvb218ZW58MXx8fHwxNzc1MzgxNzkyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    label: 'Living Room A',
    state: 'maybe',
    itemIds: ['item-1', 'item-2', 'item-3'],
  },
  {
    id: '2',
    imageUrl: 'https://images.unsplash.com/photo-1758548157243-f4ef3e614684?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb250ZW1wb3JhcnklMjBraXRjaGVuJTIwd2hpdGUlMjBtYXJibGV8ZW58MXx8fHwxNzc1NDIxNjUxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    label: 'Kitchen B',
    state: 'maybe',
    itemIds: ['item-2', 'item-4'],
  },
  {
    id: '3',
    imageUrl: 'https://images.unsplash.com/photo-1610307522657-8c0304960189?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwYmVkcm9vbSUyMGRlc2lnbnxlbnwxfHx8fDE3NzU0MjE2NTF8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    label: 'Bedroom C',
    state: 'maybe',
    itemIds: ['item-1', 'item-4'],
  },
  {
    id: '4',
    imageUrl: 'https://images.unsplash.com/photo-1623679072629-3aaa0192a391?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBvZmZpY2UlMjB3b3Jrc3BhY2UlMjBkZXNrfGVufDF8fHx8MTc3NTMzMzAyNnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    label: 'Office D',
    state: 'maybe',
    itemIds: ['item-2', 'item-3', 'item-4'],
  },
  {
    id: '5',
    imageUrl: 'https://images.unsplash.com/photo-1625578324458-a106197ff141?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBiYXRocm9vbSUyMGludGVyaW9yfGVufDF8fHx8MTc3NTM2NTc4NXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    label: 'Bathroom E',
    state: 'maybe',
    itemIds: ['item-3'],
  },
  {
    id: '6',
    imageUrl: 'https://images.unsplash.com/photo-1685644201646-9e836c398c92?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb250ZW1wb3JhcnklMjBkaW5pbmclMjByb29tfGVufDF8fHx8MTc3NTM3NTU3OXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    label: 'Dining Room F',
    state: 'maybe',
    itemIds: ['item-1', 'item-2'],
  },
  {
    id: '7',
    imageUrl: 'https://images.unsplash.com/photo-1681216868987-b7268753b81c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBhcmNoaXRlY3R1cmUlMjBleHRlcmlvcnxlbnwxfHx8fDE3NzU0MjE2NTJ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    label: 'Exterior G',
    state: 'maybe',
    itemIds: ['item-4'],
  },
  {
    id: '8',
    imageUrl: 'https://images.unsplash.com/photo-1724582586413-6b69e1c94a17?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzY2FuZGluYXZpYW4lMjBpbnRlcmlvciUyMGRlc2lnbnxlbnwxfHx8fDE3NzU0MjE2NTJ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    label: 'Lounge H',
    state: 'maybe',
    itemIds: ['item-1', 'item-3', 'item-4'],
  },
  {
    id: '9',
    imageUrl: 'https://images.unsplash.com/photo-1658893136904-63914a6b372c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBsb3VuZ2UlMjBmdXJuaXR1cmV8ZW58MXx8fHwxNzc1NDIxNjUzfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    label: 'Furniture I',
    state: 'maybe',
    itemIds: ['item-1', 'item-2', 'item-3', 'item-4'],
  },
];

// Mock items data
const initialItems: Item[] = [
  {
    id: 'item-1',
    thumbnailUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=200',
    title: 'Modern Sofa',
    selected: false,
    brand: 'West Elm',
    description: 'Mid-century modern sofa with clean lines and tufted cushions',
    sourceUrl: 'https://example.com/sofa',
  },
  {
    id: 'item-2',
    thumbnailUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=200',
    title: 'Wooden Table',
    selected: false,
    brand: 'CB2',
    description: 'Solid oak dining table with natural finish',
    sourceUrl: 'https://example.com/table',
  },
  {
    id: 'item-3',
    thumbnailUrl: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=200',
    title: 'Wall Art',
    selected: false,
    brand: 'Artful',
    description: 'Abstract canvas print with geometric patterns',
    sourceUrl: 'https://example.com/art',
  },
  {
    id: 'item-4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1540932239986-30128078f3c5?w=200',
    title: 'Floor Lamp',
    selected: false,
    brand: 'IKEA',
    description: 'Minimalist floor lamp with adjustable head',
    sourceUrl: 'https://example.com/lamp',
  },
];

type FilterTab = 'all' | RenderState;

// Mock workspace names
const workspaceNames: Record<string, string> = {
  '1': 'Living Room Collection',
  '2': 'Kitchen Concepts',
  '3': 'Bedroom Designs',
  '4': 'Office Workspace',
  '5': 'Bathroom Ideas',
  '6': 'Dining Spaces',
};

export function Workspace() {
  const { id } = useParams();
  const workspaceName = id ? workspaceNames[id] || 'Design Options' : 'Design Options';
  const [renders, setRenders] = useState<Render[]>(initialRenders);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [history, setHistory] = useState<Render[][]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [items, setItems] = useState<Item[]>(initialItems);
  const [renderJobs, setRenderJobs] = useState<RenderJob[]>([]);
  const [sidebarView, setSidebarView] = useState<SidebarView>({ type: 'default' });
  const [expandedItemId, setExpandedItemId] = useState<string>();

  // Cycle through states: maybe -> yes -> no -> maybe
  const handleTileClick = (renderId: string) => {
    setRenders((prev) =>
      prev.map((render) => {
        if (render.id !== renderId) return render;

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
      no: renders.filter((r) => r.state === 'no').length,
    };
  }, [renders]);

  const handleNarrowDown = () => {
    // Filter to keep only "yes" items
    const yesRenders = renders.filter((r) => r.state === 'yes');
    if (yesRenders.length > 0) {
      // Save current state to history
      setHistory((prev) => [...prev, renders]);
      setRenders(yesRenders.map(r => ({ ...r, state: 'maybe' as RenderState })));
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

  // Item handlers
  const handleItemClick = (itemId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleItemDelete = (itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const handleRenderRequest = () => {
    const selectedItems = items.filter((item) => item.selected);
    if (selectedItems.length === 0) return;

    // Create a new render job
    const newJob: RenderJob = {
      id: `job-${Date.now()}`,
      status: 'enqueued',
      itemCount: selectedItems.length,
      createdAt: new Date(),
    };

    setRenderJobs((prev) => [newJob, ...prev]);

    // Simulate job progression
    setTimeout(() => {
      setRenderJobs((prev) =>
        prev.map((job) =>
          job.id === newJob.id ? { ...job, status: 'in_progress' as RenderJobState } : job
        )
      );

      setTimeout(() => {
        setRenderJobs((prev) =>
          prev.map((job) =>
            job.id === newJob.id ? { ...job, status: 'completed' as RenderJobState } : job
          )
        );
      }, 3000);
    }, 2000);

    // Deselect all items
    setItems((prev) => prev.map((item) => ({ ...item, selected: false })));
  };

  const hasSelectedItems = useMemo(() => items.some((item) => item.selected), [items]);

  const handleRenderInfoClick = (renderId: string) => {
    const render = renders.find((r) => r.id === renderId);

    // Reset expanded item when switching to a different render
    setExpandedItemId(undefined);

    setSidebarView({
      type: 'render-detail',
      renderId,
      renderLabel: render?.label,
    });
    setIsSidebarOpen(true);
  };

  const handleToggleItemExpand = (itemId: string) => {
    setExpandedItemId((prev) => (prev === itemId ? undefined : itemId));
  };

  const sidebarItems = useMemo(() => {
    if (sidebarView.type === 'render-detail') {
      const render = renders.find((r) => r.id === sidebarView.renderId);
      return render?.itemIds
        ? items.filter((item) => render.itemIds?.includes(item.id))
        : [];
    }
    return items;
  }, [sidebarView, renders, items]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg p-2">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{workspaceName}</h1>
              <p className="text-sm text-gray-500">Select your favorites</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={handleUndo}
                className="
                  px-4 py-2 bg-white text-gray-700 rounded-lg text-sm font-medium
                  border border-gray-300 hover:bg-gray-50 transition-colors
                  flex items-center gap-2
                "
              >
                <Undo2 className="w-4 h-4" />
                Undo {history.length > 1 && `(${history.length})`}
              </button>
            )}
            <button
              onClick={handleNarrowDown}
              disabled={counts.yes === 0}
              className="
                px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium
                hover:bg-gray-800 transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed
              "
            >
              Narrow Down
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Filter Tabs */}
        <div className="mb-6">
          <FilterTabs
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            counts={counts}
          />
        </div>

        {/* Renders Grid */}
        {filteredRenders.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredRenders.map((render) => (
              <RenderTile
                key={render.id}
                render={render}
                onClick={handleTileClick}
                onInfoClick={handleRenderInfoClick}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <Sparkles className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500">No renders in this category</p>
            <button
              onClick={() => setActiveFilter('all')}
              className="mt-2 text-sm text-gray-600 hover:text-gray-900 underline"
            >
              View all renders
            </button>
          </div>
        )}
      </main>

      {/* Sidebar */}
      <WorkspaceSidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        items={sidebarItems}
        onItemClick={handleItemClick}
        onItemDelete={handleItemDelete}
        onRenderRequest={handleRenderRequest}
        renderJobs={renderJobs}
        hasSelectedItems={hasSelectedItems}
        view={sidebarView}
        onViewChange={setSidebarView}
        expandedItemId={expandedItemId}
        onToggleItemExpand={handleToggleItemExpand}
      />
    </div>
  );
}
