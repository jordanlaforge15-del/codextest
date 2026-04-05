import { Sparkles, Undo2 } from 'lucide-react';
import { Button } from './Button';

interface WorkspaceHeaderProps {
  canUndo: boolean;
  historyCount: number;
  selectedCount: number;
  onUndo: () => void;
  onNarrowDown: () => void;
}

export function WorkspaceHeader({
  canUndo,
  historyCount,
  selectedCount,
  onUndo,
  onNarrowDown
}: WorkspaceHeaderProps) {
  return (
    <header className="border-b border-gray-200 bg-white px-6 py-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 p-2">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-gray-900">Design Options</h1>
            <p className="text-sm text-gray-500">Select your favorites</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canUndo ? (
            <Button variant="secondary" icon={<Undo2 className="h-4 w-4" />} onClick={onUndo}>
              {historyCount > 1 ? `Undo (${historyCount})` : 'Undo'}
            </Button>
          ) : null}
          <Button onClick={onNarrowDown} disabled={selectedCount === 0}>
            Narrow Down
          </Button>
        </div>
      </div>
    </header>
  );
}
