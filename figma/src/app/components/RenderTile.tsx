import { Check, X, Info } from 'lucide-react';

export type RenderState = 'yes' | 'no' | 'maybe';

export interface Render {
  id: string;
  imageUrl: string;
  label?: string;
  state: RenderState;
  itemIds?: string[];
}

interface RenderTileProps {
  render: Render;
  onClick: (id: string) => void;
  onInfoClick?: (id: string) => void;
}

export function RenderTile({ render, onClick, onInfoClick }: RenderTileProps) {
  const handleInfoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onInfoClick) onInfoClick(render.id);
  };

  const getStateStyles = () => {
    switch (render.state) {
      case 'yes':
        return {
          container: 'ring-2 ring-green-600 shadow-lg scale-[1.02]',
          overlay: 'border-green-600',
          indicator: (
            <div className="absolute top-3 right-3 bg-green-600 text-white rounded-full p-1.5 shadow-md">
              <Check className="w-4 h-4" />
            </div>
          ),
        };
      case 'no':
        return {
          container: 'opacity-40 grayscale',
          overlay: 'border-gray-300',
          indicator: (
            <div className="absolute top-3 right-3 bg-gray-500 text-white rounded-full p-1.5 shadow-md">
              <X className="w-4 h-4" />
            </div>
          ),
        };
      default:
        return {
          container: 'hover:ring-1 hover:ring-gray-300',
          overlay: 'border-gray-200',
          indicator: null,
        };
    }
  };

  const styles = getStateStyles();

  return (
    <div
      onClick={() => onClick(render.id)}
      className={`
        relative bg-white rounded-lg overflow-hidden cursor-pointer
        transition-all duration-200 ease-out
        border ${styles.overlay}
        ${styles.container}
        group
      `}
    >
      {styles.indicator}

      {/* Info Button */}
      {onInfoClick && (
        <button
          onClick={handleInfoClick}
          className="absolute top-3 left-3 bg-white bg-opacity-90 hover:bg-opacity-100 text-gray-700 rounded-full p-1.5 shadow-md transition-all opacity-0 group-hover:opacity-100"
        >
          <Info className="w-4 h-4" />
        </button>
      )}

      <div className="aspect-[4/3] overflow-hidden bg-gray-100">
        <img
          src={render.imageUrl}
          alt={render.label || `Render ${render.id}`}
          className="w-full h-full object-cover"
        />
      </div>

      {render.label && (
        <div className="px-3 py-2 border-t border-gray-100">
          <p className="text-sm text-gray-600 truncate">{render.label}</p>
        </div>
      )}
    </div>
  );
}
