import { Check, Trash2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

export interface Item {
  id: string;
  thumbnailUrl: string;
  title: string;
  selected: boolean;
  brand?: string;
  description?: string;
  sourceUrl?: string;
}

interface ItemTileProps {
  item: Item;
  onClick: (id: string) => void;
  onDelete?: (id: string) => void;
  expanded?: boolean;
  onToggleExpand?: (id: string) => void;
  showActions?: boolean;
}

export function ItemTile({
  item,
  onClick,
  onDelete,
  expanded = false,
  onToggleExpand,
  showActions = true
}: ItemTileProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) onDelete(item.id);
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleExpand) onToggleExpand(item.id);
  };

  const hasDetails = item.brand || item.description || item.sourceUrl;

  return (
    <div
      className={`
        relative bg-white rounded-lg overflow-hidden
        transition-all duration-200 ease-out
        border
        ${item.selected ? 'border-purple-500 ring-2 ring-purple-500 ring-opacity-50' : 'border-gray-200 hover:border-gray-300'}
      `}
    >
      <div
        onClick={() => onClick(item.id)}
        className="flex items-center gap-3 p-2 cursor-pointer"
      >
        {/* Thumbnail */}
        <div className="relative w-12 h-12 rounded bg-gray-100 overflow-hidden flex-shrink-0">
          <img
            src={item.thumbnailUrl}
            alt={item.title}
            className="w-full h-full object-cover"
          />
          {item.selected && (
            <div className="absolute top-0.5 right-0.5 bg-purple-500 text-white rounded-full p-0.5 shadow-md">
              <Check className="w-3 h-3" />
            </div>
          )}
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900 truncate">{item.title}</p>
          {item.brand && !expanded && (
            <p className="text-xs text-gray-500 truncate">{item.brand}</p>
          )}
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {hasDetails && onToggleExpand && (
              <button
                onClick={handleToggleExpand}
                className="w-7 h-7 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center transition-colors"
              >
                {expanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-gray-600" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
                )}
              </button>
            )}
            {onDelete && (
              <button
                onClick={handleDelete}
                className="w-7 h-7 bg-gray-100 hover:bg-red-100 rounded flex items-center justify-center transition-colors group"
              >
                <Trash2 className="w-3.5 h-3.5 text-gray-500 group-hover:text-red-600" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {expanded && hasDetails && (
        <div className="px-2 pb-2 pt-0 border-t border-gray-100 mt-1">
          <div className="bg-gray-50 rounded p-2 space-y-1.5">
            {item.brand && (
              <div>
                <p className="text-xs font-medium text-gray-700">Brand</p>
                <p className="text-xs text-gray-600">{item.brand}</p>
              </div>
            )}
            {item.description && (
              <div>
                <p className="text-xs font-medium text-gray-700">Description</p>
                <p className="text-xs text-gray-600">{item.description}</p>
              </div>
            )}
            {item.sourceUrl && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 hover:underline"
              >
                View Source
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
