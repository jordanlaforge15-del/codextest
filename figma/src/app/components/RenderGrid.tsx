import { RenderTile, type Render } from './RenderTile';

interface RenderGridProps {
  renders: Render[];
  onTileClick: (id: string) => void;
}

export function RenderGrid({ renders, onTileClick }: RenderGridProps) {
  return (
    <section aria-label="Render options">
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {renders.map((render) => (
          <li key={render.id}>
            <RenderTile render={render} onClick={onTileClick} />
          </li>
        ))}
      </ul>
    </section>
  );
}
