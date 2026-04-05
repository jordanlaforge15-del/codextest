import type { HTMLAttributes } from 'react';
import { cn } from './ui/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('overflow-hidden rounded-lg border border-gray-200 bg-white', className)}
      {...props}
    />
  );
}
