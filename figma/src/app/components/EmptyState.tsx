import { Sparkles } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  onReset: () => void;
}

export function EmptyState({ onReset }: EmptyStateProps) {
  return (
    <section className="py-16 text-center">
      <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        <Sparkles className="h-8 w-8 text-gray-400" />
      </div>
      <p className="text-gray-500">No renders in this category</p>
      <div className="mt-2">
        <Button variant="link" className="min-h-0 px-0 py-0 text-sm" onClick={onReset}>
          View all renders
        </Button>
      </div>
    </section>
  );
}
