import { Check, X } from 'lucide-react';
import { Card } from './Card';
import { ImageWithFallback } from './figma/ImageWithFallback';

export type RenderState = 'yes' | 'no' | 'maybe';

export interface Render {
  id: string;
  imageUrl: string;
  label?: string;
  state: RenderState;
}

interface RenderTileProps {
  render: Render;
  onClick: (id: string) => void;
}

export function RenderTile({ render, onClick }: RenderTileProps) {
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
          )
        };
      case 'no':
        return {
          container: 'opacity-40 grayscale',
          overlay: 'border-gray-300',
          indicator: (
            <div className="absolute top-3 right-3 bg-gray-500 text-white rounded-full p-1.5 shadow-md">
              <X className="w-4 h-4" />
            </div>
          )
        };
      default:
        return {
          container: 'hover:ring-1 hover:ring-gray-300',
          overlay: 'border-gray-200',
          indicator: null
        };
    }
  };

  const styles = getStateStyles();

  return (
    <button
      type="button"
      onClick={() => onClick(render.id)}
      className="block w-full cursor-pointer text-left"
      aria-pressed={render.state === 'yes'}
    >
      <Card
        className={`
          relative transition-all duration-200 ease-out
          ${styles.overlay}
          ${styles.container}
        `}
      >
        {styles.indicator}

        <div className="aspect-[4/3] overflow-hidden bg-gray-100">
          <ImageWithFallback
            src={render.imageUrl}
            alt={render.label || `Render ${render.id}`}
            className="h-full w-full object-cover"
          />
        </div>

        {render.label ? (
          <div className="border-t border-gray-100 px-4 py-2">
            <p className="truncate text-sm text-gray-600">{render.label}</p>
          </div>
        ) : null}
      </Card>
    </button>
  );
}
