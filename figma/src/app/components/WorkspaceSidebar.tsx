import { X, ChevronLeft, ChevronRight, Sparkles, ArrowLeft } from 'lucide-react';
import { ItemTile, type Item } from './ItemTile';
import { RenderJobStatus, type RenderJob } from './RenderJobStatus';

export type SidebarView =
  | { type: 'default' }
  | { type: 'render-detail'; renderId: string; renderLabel?: string };

interface WorkspaceSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  items: Item[];
  onItemClick: (id: string) => void;
  onItemDelete: (id: string) => void;
  onRenderRequest: () => void;
  renderJobs: RenderJob[];
  hasSelectedItems: boolean;
  view: SidebarView;
  onViewChange: (view: SidebarView) => void;
  expandedItemId?: string;
  onToggleItemExpand: (id: string) => void;
}

export function WorkspaceSidebar({
  isOpen,
  onToggle,
  items,
  onItemClick,
  onItemDelete,
  onRenderRequest,
  renderJobs,
  hasSelectedItems,
  view,
  onViewChange,
  expandedItemId,
  onToggleItemExpand,
}: WorkspaceSidebarProps) {
  const isDefaultView = view.type === 'default';

  return (
    <>
      {/* Toggle Button */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed right-6 top-24 z-40 bg-white border border-gray-200 rounded-lg p-2 shadow-lg hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed right-0 top-0 h-full bg-white border-l border-gray-200 shadow-xl
          transition-transform duration-300 ease-in-out z-50
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
          w-80 flex flex-col
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            {!isDefaultView && (
              <button
                onClick={() => onViewChange({ type: 'default' })}
                className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-gray-600" />
              </button>
            )}
            <h2 className="font-semibold text-gray-900">
              {isDefaultView ? 'Items & Renders' : view.renderLabel || 'Render Details'}
            </h2>
          </div>
          <button
            onClick={onToggle}
            className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isDefaultView ? (
            <>
              {/* Items Section */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-700">Items ({items.length})</h3>
                </div>

                {items.length > 0 ? (
                  <div className="space-y-2">
                    {items.map((item) => (
                      <ItemTile
                        key={item.id}
                        item={item}
                        onClick={onItemClick}
                        onDelete={onItemDelete}
                        expanded={expandedItemId === item.id}
                        onToggleExpand={onToggleItemExpand}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No items added yet
                  </div>
                )}

                {/* Render Button */}
                <button
                  onClick={onRenderRequest}
                  disabled={!hasSelectedItems}
                  className="
                    w-full mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium
                    hover:bg-gray-800 transition-colors
                    disabled:opacity-40 disabled:cursor-not-allowed
                    flex items-center justify-center gap-2
                  "
                >
                  <Sparkles className="w-4 h-4" />
                  Request Render
                </button>
              </div>

              {/* Render Jobs Section */}
              {renderJobs.length > 0 && (
                <div className="p-4 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Render Jobs</h3>
                  <div className="space-y-2">
                    {renderJobs.map((job) => (
                      <RenderJobStatus key={job.id} job={job} />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Render Detail View */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-700">
                    Items Used ({items.length})
                  </h3>
                </div>

                {items.length > 0 ? (
                  <div className="space-y-2">
                    {items.map((item) => (
                      <ItemTile
                        key={item.id}
                        item={item}
                        onClick={() => {}}
                        expanded={expandedItemId === item.id}
                        onToggleExpand={onToggleItemExpand}
                        showActions={false}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No items associated with this render
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
